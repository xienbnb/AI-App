import { Router, type Request, type Response } from "express";
import { db } from "../storage/database/client.js";
import { users, books, outlines, userSettings, agentConversations, agentMemories } from "../storage/database/shared/schema.js";
import { eq, and, desc, sql } from "drizzle-orm";
import { findTool, getToolsSystemPrompt, getBookInfo, type ToolResult } from "../utils/agent-tools.js";
import { createProvider } from "../utils/ai-provider.js";

const router = Router();

// 工具调用最大轮次
const MAX_TOOL_ROUNDS = 15;

// ============================================================
// 工具调用检测与执行
// ============================================================

/**
 * 从 LLM 输出中检测工具调用指令
 * 工具调用格式: ```json\n{"tool": "工具名", "args": {...}}\n```
 */
/**
 * 通过大括号计数从文本中提取完整的 JSON 对象（支持嵌套）
 */
function extractJsonObject(text: string, startIndex: number): { json: string; endIndex: number } | null {
  let braceCount = 0;
  let inString = false;
  let escapeNext = false;
  for (let i = startIndex; i < text.length; i++) {
    const ch = text[i];
    if (escapeNext) { escapeNext = false; continue; }
    if (ch === '\\') { escapeNext = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') { braceCount++; }
    else if (ch === '}') {
      braceCount--;
      if (braceCount === 0) {
        return { json: text.slice(startIndex, i + 1), endIndex: i + 1 };
      }
    }
  }
  return null;
}

function detectToolCall(text: string): { tool: string; args: Record<string, any>; rawJson: string; startIndex: number; endIndex: number } | null {
  // 先找 ```json 代码块
  const jsonBlockStart = text.indexOf('```json');
  if (jsonBlockStart !== -1) {
    const contentStart = text.indexOf('{', jsonBlockStart);
    if (contentStart !== -1) {
      const extracted = extractJsonObject(text, contentStart);
      if (extracted) {
        try {
          const parsed = JSON.parse(extracted.json);
          if (parsed.tool && typeof parsed.tool === 'string') {
            // 找到代码块结束位置
            const blockEnd = text.indexOf('```', extracted.endIndex);
            const realEnd = blockEnd !== -1 ? blockEnd + 3 : extracted.endIndex;
            return { tool: parsed.tool, args: parsed.args || {}, rawJson: text.slice(jsonBlockStart, realEnd), startIndex: jsonBlockStart, endIndex: realEnd };
          }
        } catch {}
      }
    }
  }

  // 再找裸 JSON（以 {"tool": 开头）
  const toolIdx = text.indexOf('{"tool"');
  if (toolIdx !== -1) {
    const extracted = extractJsonObject(text, toolIdx);
    if (extracted) {
      try {
        const parsed = JSON.parse(extracted.json);
        if (parsed.tool && typeof parsed.tool === 'string') {
          return { tool: parsed.tool, args: parsed.args || {}, rawJson: extracted.json, startIndex: toolIdx, endIndex: extracted.endIndex };
        }
      } catch {}
    }
  }

  return null;
}

// ============================================================
// Agent 系统提示
// ============================================================

const AGENT_SYSTEM_PROMPT = `你是"创作大师"——小说创作 AI 助手。

## 核心规则
1. 如果系统注入了「当前挂载书籍」，则用户操作针对该书，先调 get_book_info 读取数据后再创作
2. 挂载书籍时严禁 create_book（系统已拦截）
3. 无挂载书籍且用户要新作品 → create_book(title/category/description)
4. 创作基于大纲和设定，不凭空编造
5. 一次只调用一个工具，等待结果后再做下一步
6. 敏感操作（删书、改VIP、增减字数等）已被系统强制拦截
7. 第一章节1500-3000字，含主角引入→背景交代→主线触发→悬念

${getToolsSystemPrompt()}

## 工作流程
规划卷结构(create_volume) → 构建世界观(save_world_setting) → 大纲(save_outline) → 编写章节(create_chapter)，每步完成后告知用户。`;

// ============================================================
// POST /api/v1/agent/execute — SSE 流式 Agent 执行
// ============================================================

router.post("/execute", async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "未登录" });
    }
    const userId = req.user.id;
    const { message, conversationId, model, bookId, skillPrompt, skillName, mode } = req.body;
    const agentMode = mode || "agent"; // agent / chat / plan

    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "message 是必填参数" });
    }

    // SSE 头设置
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-store, no-transform, must-revalidate");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    // ---- 1. 加载或创建对话 ----
    let conversation: any;
    let messages: any[] = [];

    if (conversationId) {
      const [existing] = await db
        .select()
        .from(agentConversations)
        .where(eq(agentConversations.id, conversationId as any))
        .limit(1);
      if (existing) {
        conversation = existing;
        messages = (existing.messages as any[]) || [];
      }
    }

    if (!conversation) {
      // 自动从消息生成标题
      const title = message.length > 30 ? message.slice(0, 30) + "..." : message;
      const [newConv] = await db
        .insert(agentConversations)
        .values({ userId, title, messages: [] })
        .returning();
      conversation = newConv;
      messages = [];
    }

    // ---- 2. 添加用户消息 ----
    messages.push({ role: "user", content: message, timestamp: new Date().toISOString() });

    // ---- 3. 查询长期记忆并注入到系统提示 ----
    let memoryContext = "";
    try {
      const memories = await db
        .select()
        .from(agentMemories)
        .where(eq(agentMemories.userId, userId))
        .orderBy(desc(agentMemories.updatedAt))
        .limit(10);

      if (memories.length > 0) {
        memoryContext = "\n\n## 你对该用户的长期记忆\n以下是你之前与该用户交互中记住的关键信息：\n";
        for (const mem of memories) {
          memoryContext += `- [${mem.key}] ${mem.content}\n`;
        }
        memoryContext += "\n以上记忆仅供参考，如果与当前对话上下文矛盾，以当前对话为准。";
      }
    } catch (err) {
      // 记忆查询失败不影响主流程
      console.warn("Memory query failed:", (err as Error).message);
    }

    // ---- 4. 构建 LLM 消息 ----
    const baseSystemPrompt = AGENT_SYSTEM_PROMPT + memoryContext;
    const llmMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: baseSystemPrompt },
    ];

    // 技能约束注入
    if (skillPrompt) {
      llmMessages.push({ role: "system", content: `## 当前技能约束\n你当前处于「${skillName || "自定义"}」技能模式。请严格遵守以下职责范围：\n${skillPrompt}\n\n【技能规则】在此模式下，你只能执行与上述职责相关的操作。超出职责范围的请求应礼貌拒绝。` });
    }

    // 模式处理
    if (agentMode === "chat") {
      llmMessages.push({ role: "system", content: "【对话模式】你处于纯对话模式。请直接回答用户的问题，不要输出任何工具调用 JSON。保持自然对话风格。" });
    } else if (agentMode === "plan") {
      llmMessages.push({ role: "system", content: "【计划模式】在回答之前，请先输出一个结构化计划（包含编号步骤），然后在每个步骤完成时标注执行状态。格式：\n\n## 计划\n1. 步骤一...\n2. 步骤二...\n...\n\n然后逐步执行。每完成一步在末尾标注 ✅ 或 ❌。" });
    }

    // 添加上下文（最多保留最近20条）
    const recentMessages = messages.slice(-20);
    for (const msg of recentMessages) {
      if (msg.role === "user" || msg.role === "assistant") {
        // 如果是工具结果消息，包装一下
        let content = msg.content;
        if (msg.isToolResult) {
          content = `【工具结果】\n${content}`;
        } else if (msg.isToolCall) {
          content = `【工具调用】\n${content}`;
        }
        llmMessages.push({ role: msg.role, content });
      }
    }

    // ---- 4. 加载挂载书籍信息（完整上下文） ----
    if (bookId) {
      try {
        const [book] = await db
          .select({
            id: books.id,
            title: books.title,
            genre: books.category,
            outline: books.outline,
            volumes: books.volumes,
          })
          .from(books)
          .where(eq(books.id, bookId))
          .limit(1);
        if (book) {
          // 读取角色/设定
          const [settingsRow] = await db.select({ data: userSettings.data }).from(userSettings).where(eq(userSettings.bookId, bookId)).limit(1);
          const worldSettings = (settingsRow?.data as any[]) || [];

          // 读取结构化大纲（outlines 表）
          const [outlineRow] = await db.select({ content: outlines.content }).from(outlines).where(eq(outlines.bookId, bookId)).limit(1);
          let outlineItems: any[] = [];
          if (outlineRow?.content) {
            try { outlineItems = JSON.parse(outlineRow.content); } catch {}
          }

          // 构建书籍上下文文本
          const volumesList = (book.volumes as any[]) || [];
          const volumesText = volumesList.length > 0
            ? volumesList.map((v: any) => `【卷】${v.title}（章节: ${v.chapters?.length || 0}）`).join("\n")
            : "暂无卷结构";

          const outlineText = outlineItems.length > 0
            ? outlineItems.map((i: any) => `[${i.type}] ${i.title}: ${i.content?.slice(0, 100) || ""}`).join("\n")
            : (book.outline || "暂无大纲");

          const settingsText = worldSettings.length > 0
            ? worldSettings.map((s: any) => {
                if (typeof s === "string") return s;
                if (s.name) return `${s.name}: ${s.description || s.content || ""}`;
                if (s.role) return `${s.role}: ${s.description || ""}`;
                return JSON.stringify(s);
              }).join("\n")
            : "暂无设定数据";

          const bookContext = `## 当前挂载书籍
用户已挂载书籍《${book.title}》（ID: ${bookId}）。
该书籍共 ${volumesList.length} 卷、${outlineItems.length} 条大纲、${worldSettings.length} 项设定。

如需详情请调 get_book_info。`;

          llmMessages.push({ role: "system", content: bookContext });
        }
      } catch (e) {
        console.error("加载挂载书籍失败:", e);
      }
    }

    // ---- 5. 缓存 + 意图预判 ----
    const bookInfoCache: Record<string, string> = {}; // 缓存 bookId → get_book_info 结果
    let preToolResult: string | null = null;

    // 意图预判：根据用户消息内容，直接命中目标工具
    const userMsg = message || "";
    if (bookId) {
      const lower = userMsg.toLowerCase();
      // "读取/查看/查询/有什么" → 立即调用 get_book_info
      if (/读[取取]?|查看|查询|有什么|信息|设定|角色|大纲/.test(userMsg)) {
        const bookData = await getBookInfo(bookId);
        bookInfoCache[bookId] = JSON.stringify(bookData, null, 2);
        preToolResult = `## 书籍信息（自动加载）\n\`\`\`json\n${bookInfoCache[bookId]}\n\`\`\``;
        llmMessages.push({ role: "system", content: preToolResult });
        res.write(`data: ${JSON.stringify({ type: "action_start", content: "正在为你读取书籍信息..." })}\n\n`);
      }
      // "创建/新建" → 禁止（已挂载书籍）
      else if (/创建|新建/.test(userMsg)) {
        preToolResult = "用户已挂载书籍，请使用已有书籍，不要创建新书。";
        llmMessages.push({ role: "system", content: preToolResult });
      }
    }

    // ---- 6. Agent 主循环 ----
    const provider = await createProvider(userId, model);
    let toolRound = 0;
    let fullResponse = "";

    while (toolRound < MAX_TOOL_ROUNDS) {
      toolRound++;
      let currentResponse = "";

      // 流式调用 LLM
      const stream = provider.generateStream(llmMessages, {
        model: model || provider.defaultModel,
        temperature: 0.8,
      });

      for await (const chunk of stream) {
        if (chunk.content) {
          const text = chunk.content.toString();
          currentResponse += text;
          // 逐块流式发送，用户能看到实时生成的内容
          res.write(`data: ${JSON.stringify({ type: "text", content: text })}\n\n`);
        }
      }

      fullResponse += currentResponse;

      // 【对话模式】文本已流式发送完毕，直接跳出
      if (agentMode === "chat") {
        break;
      }

      // 检测是否有工具调用，有则切除 JSON 后通过 text_replace 修正 UI
      const toolCall = detectToolCall(currentResponse);
      if (toolCall) {
        const before = currentResponse.slice(0, toolCall.startIndex);
        const after = currentResponse.slice(toolCall.endIndex);
        const cleanText = (before + after).trim();
        if (cleanText) {
          // text_replace 会用干净文本替换掉之前流式发送的内容（包括其中的 JSON）
          res.write(`data: ${JSON.stringify({ type: "text_replace", content: cleanText })}\n\n`);
        }
      }

      if (!toolCall) {
        // 没有工具调用 = LLM 回复完毕
        break;
      }

      // ---- 5. 执行工具调用 ----
      const toolDef = findTool(toolCall.tool);
      if (!toolDef) {
        // 未知工具，通知 LLM
        const errorMsg = `❌ 未知工具 "${toolCall.tool}"，请使用可用工具列表中的工具。`;
        res.write(`data: ${JSON.stringify({ type: "action", content: errorMsg })}\n\n`);
        llmMessages.push({ role: "assistant", content: currentResponse });
        llmMessages.push({ role: "user", content: errorMsg });
        continue;
      }

      // 【硬拦截：挂载书籍时禁止创建新书】
      if (bookId && toolCall.tool === "create_book") {
        const errorMsg = `❌ 当前已挂载书籍，无需创建新书。用户的所有操作都应针对当前挂载的书籍。请调用 get_book_info 工具读取书籍信息。`;
        res.write(`data: ${JSON.stringify({ type: "action", content: errorMsg })}\n\n`);
        llmMessages.push({ role: "assistant", content: currentResponse });
        llmMessages.push({ role: "user", content: errorMsg });
        continue;
      }

      // 工具中文名映射
      const TOOL_NAMES: Record<string, string> = {
        get_book_info: "读取书籍信息", create_book: "创建书籍", save_outline: "保存大纲",
        create_volume: "创建卷", create_chapter: "创建章节", save_world_setting: "保存设定",
        get_characters: "读取角色", get_volumes: "读取卷信息", continue_chapter: "续写章节",
      };
      // 工具执行时面向用户的中文提示
      const TOOL_PROMPTS: Record<string, string> = {
        create_book: "正在创建书籍...",
        save_outline: "正在生成大纲...",
        create_chapter: "正在创作章节...",
        create_volume: "正在规划卷...",
        save_world_setting: "正在构建世界观...",
        get_book_info: "正在加载作品信息...",
        get_characters: "正在读取角色...",
        get_volumes: "正在整理目录...",
        continue_chapter: "正在续写章节...",
      };
      const toolLabel = TOOL_NAMES[toolCall.tool] || toolCall.tool;
      const toolPrompt = TOOL_PROMPTS[toolCall.tool] || `正在${toolLabel}...`;

      // 通知前端开始执行工具（友好中文提示，不暴露技术参数）
      res.write(`data: ${JSON.stringify({ type: "action_start", content: toolPrompt })}\n\n`);

      // 执行工具（get_book_info 走缓存）
      let result: ToolResult;
      if (toolCall.tool === "get_book_info" && bookInfoCache[toolCall.args?.bookId || bookId]) {
        const cached = bookInfoCache[toolCall.args?.bookId || bookId];
        const parsed = JSON.parse(cached);
        result = { success: true, message: "书籍信息已加载（缓存）", data: parsed };
      } else {
        result = await toolDef.handler(userId, toolCall.args);
        // 缓存 get_book_info 结果
        if (toolCall.tool === "get_book_info" && result.data) {
          bookInfoCache[toolCall.args?.bookId || bookId] = JSON.stringify(result.data);
        }
      }

      // 通知前端工具执行结果（摘要版）
      const summaryMsg = result.message.length > 200 ? result.message.slice(0, 200) + "..." : result.message;
      res.write(`data: ${JSON.stringify({ type: "action_result", tool: toolCall.tool, success: result.success, message: summaryMsg })}\n\n`);

      // 工具结果摘要（裁剪长数据，只给LLM关键信息）
      const trimmedMsg = result.message.length > 500 ? result.message.slice(0, 500) + `\n...（内容较长，共${result.message.length}字符，如需完整数据请调用相应工具）` : result.message;
      llmMessages.push({ role: "assistant", content: currentResponse });
      llmMessages.push({ role: "user", content: `【${toolLabel}】\n${trimmedMsg}` });

      // 保存到内存消息
      messages.push({ role: "assistant", content: currentResponse, isToolCall: true, tool: toolCall.tool });
      messages.push({ role: "user", content: summaryMsg, isToolResult: true, tool: toolCall.tool });
    }

    if (toolRound >= MAX_TOOL_ROUNDS) {
      res.write(`data: ${JSON.stringify({ type: "text", content: "\n\n⚠️ 已执行过多操作，请继续给我指令。" })}\n\n`);
    }

    // ---- 6. 计算 Token 消耗 ----
    let inputChars = 0;
    let outputChars = 0;
    for (const m of llmMessages) {
      inputChars += (m.content || "").length;
    }
    outputChars = fullResponse.length;

    // 粗略估算：中文约1.5字符/token
    const promptTokens = Math.ceil(inputChars / 1.5);
    const completionTokens = Math.ceil(outputChars / 1.5);
    const totalTokens = promptTokens + completionTokens;

    // 发送 Token 消耗
    res.write(`data: ${JSON.stringify({
      type: "usage",
      promptTokens,
      completionTokens,
      totalTokens,
      inputChars,
      outputChars,
    })}\n\n`);

    // ---- 7. 保存到数据库 ----
    messages.push({ role: "assistant", content: fullResponse, timestamp: new Date().toISOString() });

    await db
      .update(agentConversations)
      .set({
        messages: messages as any,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(agentConversations.id, conversation.id));

    // 发送完成信号（含 conversationId）
    res.write(`data: ${JSON.stringify({ type: "done", conversationId: conversation.id })}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err: any) {
    console.error("[Agent] Error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Agent 处理失败: " + err.message });
    } else {
      res.write(`data: ${JSON.stringify({ type: "error", error: err.message })}\n\n`);
      res.write("data: [DONE]\n\n");
      res.end();
    }
  }
});

// ============================================================
// GET /api/v1/agent/conversations — 获取对话列表
// ============================================================

router.get("/conversations", async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: "未登录" });
    const userId = req.user.id;

    const list = await db
      .select({
        id: agentConversations.id,
        title: agentConversations.title,
        createdAt: agentConversations.createdAt,
        updatedAt: agentConversations.updatedAt,
        messageCount: agentConversations.messages,
      })
      .from(agentConversations)
      .where(eq(agentConversations.userId, userId))
      .orderBy(agentConversations.updatedAt)
      .limit(50);

    const result = list.map((item: any) => ({
      id: item.id,
      title: item.title,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      messageCount: (item.messageCount as any[])?.length || 0,
    }));

    res.json({ conversations: result });
  } catch (err: any) {
    console.error("[Agent] List error:", err);
    res.status(500).json({ error: "获取对话列表失败" });
  }
});

// ============================================================
// GET /api/v1/agent/conversations/:id — 获取单条对话详情
// ============================================================

router.get("/conversations/:id", async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: "未登录" });
    const userId = req.user.id;
    const convId = req.params.id;

    const [conv] = await db
      .select()
      .from(agentConversations)
      .where(eq(agentConversations.id, convId as any))
      .limit(1);

    if (!conv) return res.status(404).json({ error: "对话不存在" });
    if (conv.userId !== userId) return res.status(403).json({ error: "无权访问" });

    res.json({ conversation: conv });
  } catch (err: any) {
    console.error("[Agent] Get error:", err);
    res.status(500).json({ error: "获取对话失败" });
  }
});

// ============================================================
// DELETE /api/v1/agent/conversations/:id — 删除对话
// ============================================================

router.delete("/conversations/:id", async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: "未登录" });
    const userId = req.user.id;
    const convId = req.params.id;

    const [conv] = await db
      .select({ userId: agentConversations.userId })
      .from(agentConversations)
      .where(eq(agentConversations.id, convId as any))
      .limit(1);

    if (!conv) return res.status(404).json({ error: "对话不存在" });
    if (conv.userId !== userId) return res.status(403).json({ error: "无权删除" });

    await db.delete(agentConversations).where(eq(agentConversations.id, convId as any));
    res.json({ success: true });
  } catch (err: any) {
    console.error("[Agent] Delete error:", err);
    res.status(500).json({ error: "删除对话失败" });
  }
});

export default router;