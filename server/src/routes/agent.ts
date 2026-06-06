import { Router, type Request, type Response } from "express";
import { LLMClient, Config, HeaderUtils } from "coze-coding-dev-sdk";
import { db } from "../storage/database/client.js";
import { users, agentConversations } from "../storage/database/shared/schema.js";
import { eq } from "drizzle-orm";
import { findTool, getToolsSystemPrompt, type ToolResult } from "../utils/agent-tools.js";

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
function detectToolCall(text: string): { tool: string; args: Record<string, any> } | null {
  // 匹配 ```json ... ``` 中的工具调用
  const jsonBlockRegex = /```(?:json)?\s*(\{[\s\S]*?"tool"[\s\S]*?\})\s*```/;
  const match = text.match(jsonBlockRegex);
  if (match) {
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed.tool && typeof parsed.tool === "string") {
        return { tool: parsed.tool, args: parsed.args || {} };
      }
    } catch {}
  }

  // 也尝试直接匹配裸 JSON
  const bareRegex = /\{\s*"tool"\s*:\s*"([^"]+)"\s*,\s*"args"\s*:\s*(\{[\s\S]*?\})\s*\}/;
  const bareMatch = text.match(bareRegex);
  if (bareMatch) {
    try {
      const args = JSON.parse(bareMatch[2]);
      return { tool: bareMatch[1], args };
    } catch {}
  }

  return null;
}

/**
 * 获取用户的 LLM 客户端（含自定义模型配置）
 */
function getUserLLMClient(userId: string): LLMClient {
  const config = new Config();
  return new LLMClient(config);
}

/**
 * 获取用户的首选模型
 */
async function getUserPreferredModel(userId: string): Promise<string> {
  try {
    const [userRow] = await db
      .select({ aiSettings: users.aiSettings })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (userRow?.aiSettings && typeof userRow.aiSettings === "object") {
      const settings = userRow.aiSettings as Record<string, any>;
      if (settings.aiModel) return settings.aiModel;
    }
  } catch {}
  return "doubao-seed-2-0-pro-260215";
}

// ============================================================
// Agent 系统提示
// ============================================================

const AGENT_SYSTEM_PROMPT = `你是"创作大师"——一个专业的小说创作 AI 助手。

## 你的角色
你是一位资深编辑兼作家，擅长帮助作者从零开始构建完整的小说世界。
你可以帮助用户：
1. 根据创意自动创建书籍、构建大纲、设定角色、编写章节
2. 分析已有书籍，提供续写、修改建议
3. 保持连贯的世界观和人物性格

## 工作流程（严格按以下顺序执行）
1. 首先充分理解用户的创作意图（题材、风格、核心设定、脑洞）
2. 【创建书籍】→ 用 create_book 创建书籍（必须）
3. 【规划卷结构】→ 用 create_volume 创建多个卷（一般3-5卷）
4. 【构建世界观】→ 用 save_world_setting 一次性保存所有设定：
   - "角色": 主角、重要配角、反派（含境界、武器、功法、法宝、性格、背景）
   - "金手指": 系统、传承、法宝、天赋等（含功能、限制、成长路径）
   - "物品": 丹药、法器、材料、神秘物品等
   - "世界背景": 修炼体系、势力分布、地理环境、历史传说
5. 【创作大纲】→ 用 save_outline 保存结构化大纲（每卷对应多项"大纲/细纲"项，含章节规划）
6. 【编写章节】→ 用 create_chapter 在每个卷下创建章节（每章正文要完整充实）
7. 每一步完成后告知用户进展，根据反馈调整

## 重要规则
- 一次只调用一个工具，等待结果后再做下一步
- 工具调用必须使用指定 JSON 格式
- 创作内容要丰富具体，避免空洞的套话
- 对修仙/玄幻小说，角色设定必须包含：境界修为、修炼功法、武器法宝
- 对金手指必须描述：功能效果、获取方式、成长限制
- 第一章节字数建议控制在1500-3000字，包含: 引入主角、交代背景、触发主线、设置悬念
- 尊重用户的创作意愿，给出专业建议但不强加
- 调用工具后，工具返回的结果会以 【工具结果】 的形式呈现，请根据结果继续

## 禁止操作 ⚠️
- 严禁修改用户VIP等级、会员状态
- 严禁删除书籍、注销账号、修改密码
- 严禁增加或修改用户Token/次数余额
- 严禁执行任何财务相关操作
- 严禁修改系统设置或安全配置
- 只能在用户明确要求下执行修改操作

${getToolsSystemPrompt()}

## 响应格式
- 正常对话回复：直接回复文本
- 需要调用工具时：在回复的最后附加工具调用 JSON 块
  例如：
  \`\`\`json
  {"tool": "create_book", "args": {"title": "我的第一本书", "category": "玄幻"}}
  \`\`\`
`;

// ============================================================
// POST /api/v1/agent/execute — SSE 流式 Agent 执行
// ============================================================

router.post("/execute", async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "未登录" });
    }
    const userId = req.user.id;
    const { message, conversationId, model } = req.body;

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

    // ---- 3. 构建 LLM 消息 ----
    const llmMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: AGENT_SYSTEM_PROMPT },
    ];

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

    // ---- 4. Agent 主循环 ----
    const selectedModel = model || (await getUserPreferredModel(userId));
    const llmClient = getUserLLMClient(userId);
    let toolRound = 0;
    let fullResponse = "";

    while (toolRound < MAX_TOOL_ROUNDS) {
      toolRound++;
      let currentResponse = "";

      // 流式调用 LLM
      const stream = llmClient.stream(llmMessages, {
        model: selectedModel,
        temperature: 0.8,
      });

      for await (const chunk of stream) {
        if (chunk.content) {
          const text = chunk.content.toString();
          currentResponse += text;
          // SSE 发送文本块
          res.write(`data: ${JSON.stringify({ type: "text", content: text })}\n\n`);
        }
      }

      fullResponse += currentResponse;

      // 检测是否有工具调用
      const toolCall = detectToolCall(currentResponse);

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

      // 通知前端开始执行工具
      res.write(`data: ${JSON.stringify({ type: "action_start", tool: toolCall.tool, args: toolCall.args })}\n\n`);

      // 执行工具
      const result: ToolResult = await toolDef.handler(userId, toolCall.args);

      // 通知前端工具执行结果
      res.write(`data: ${JSON.stringify({ type: "action_result", tool: toolCall.tool, success: result.success, message: result.message, data: result.data })}\n\n`);

      // 把工具调用和结果加入对话上下文
      llmMessages.push({ role: "assistant", content: currentResponse });
      llmMessages.push({ role: "user", content: `【工具结果】\n${result.message}` });

      // 保存到内存消息
      messages.push({ role: "assistant", content: currentResponse, isToolCall: true, tool: toolCall.tool });
      messages.push({ role: "user", content: result.message, isToolResult: true, tool: toolCall.tool });
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