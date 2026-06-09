import { Router, type Request, type Response } from "express";
import { getLLMClient, getUserLLMClient, createImageClient, getUserImageClient } from "../utils/ai-client.js";
import type { LLMConfig } from "coze-coding-dev-sdk";
import {
  generateJSON,
  streamJSON,
  generateNovelOutline,
  generateCharacters,
  generateChapter,
  streamChapter,
  polishChapter,
  generateWorldBuilding,
  detectContent,
} from "../services/ai-workflow.service.js";

const router = Router();

// 获取用户ID
function getUserId(req: Request): string | undefined {
  return req.user?.id;
}

// Helper: SSE write
function sseWrite(res: Response, content: string) {
  res.write(`data: ${JSON.stringify({ content })}\n\n`);
}

// Helper: stream LLM response
async function streamLLM(
  res: Response,
  messages: { role: string; content: string }[],
  systemPrompt: string,
  options: { model?: string; temperature?: number } = {},
  userId?: string
) {
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-store, no-transform, must-revalidate");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  // 监听客户端断开
  let clientDisconnected = false;
  res.on("close", () => {
    clientDisconnected = true;
  });

  const allMessages = [
    { role: "system" as const, content: systemPrompt },
    ...messages.map((m) => ({
      role: (m.role === "system" ? "system" : m.role === "assistant" ? "assistant" : "user") as "system" | "assistant" | "user",
      content: m.content,
    })),
  ];

  try {
    const llmConfig: LLMConfig = {
      model: options.model || "doubao-seed-2-0-lite-260215",
      temperature: options.temperature ?? 0.8,
    };
    const llmClient = userId ? await getUserLLMClient(userId) : getLLMClient();
    const stream = llmClient.stream(allMessages, llmConfig);
    for await (const chunk of stream) {
      if (clientDisconnected) break;
      if (chunk.content && typeof chunk.content === "string") {
        sseWrite(res, chunk.content);
      }
    }
  } catch (err: any) {
    console.error("LLM stream error:", err.message);
    if (!clientDisconnected && !res.writableEnded) {
      sseWrite(res, `\n\n> ⚠️ AI 服务出错，请重试: ${err.message}`);
    }
  }

  if (!clientDisconnected && !res.writableEnded) {
    res.write(`data: [DONE]\n\n`);
    res.end();
  }
}

// ============ 1. AI角色库 ============
// POST /api/v1/ai/character
router.post("/character", async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const { genre, style, count } = req.body;
  const systemPrompt = `你是顶级网文角色创作专家。根据用户提供的类型和风格，生成${count || 3}个原创小说角色。

每个角色包含：
- 角色名
- 身份/背景
- 性格特点（2-3个关键词）
- 外貌特征
- 核心能力或特长
- 角色定位（主角/女主/反派/配角）
- 人物小传（2-3句话）

格式要求：
- 用 **角色名** 作小标题
- 每个角色用分隔线 --- 隔开
- 风格需要匹配用户指定的类型`;
  await streamLLM(res, [{ role: "user", content: `类型：${genre}，风格：${style || "不限"}` }], systemPrompt, {}, userId);
});

// ============ 2. 大纲助手 ============
// POST /api/v1/ai/outline
router.post("/outline", async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const { title, genre, description, detail } = req.body;
  const systemPrompt = `你是顶级网文大纲创作专家。根据用户提供的小说信息，生成一份完整的故事大纲。

大纲结构：
1. **故事背景** - 时代、世界观
2. **核心设定** - 独特的规则或体系
3. **主要角色** - 主角、重要配角
4. **故事主线** - 按卷/阶段划分的剧情发展
5. **分章大纲** - 每章标题 + 核心事件（约5-8章）

格式：
- 使用清晰的层级结构（## 一级标题，### 二级标题）
- 用 > 标注重要伏笔或反转
- 每卷给出明确的核心冲突`;
  await streamLLM(res, [{ role: "user", content: `书名：${title || "未定"}，类型：${genre}，简介：${description || "暂无"}，详细：${detail || "无"}` }], systemPrompt, {}, userId);
});

// ============ 3. AI检测 ============
// POST /api/v1/ai/detect
router.post("/detect", async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const { text } = req.body;
  const systemPrompt = `你是一位专业的AI生成文本检测专家。请对用户提交的文本进行专业分析，判断是否由AI生成。

分析维度：
1. **AI生成概率**（百分比）
2. **判断依据**（列3-5条具体理由）
3. **可疑特征**（如：句式重复、逻辑跳跃、用词模式等）
4. **修改建议**（如何改写得更像人类写作）

格式：
- 先用一个总体判断（"✅ 极可能为人类创作" / "⚠️ 疑似AI生成，概率XX%" / "❌ 极可能为AI生成"）
- 然后逐项分析
- 建议至少给出3条修改意见`;
  await streamLLM(res, [{ role: "user", content: `请分析以下文本：\n\n${text?.substring(0, 3000) || "无文本"}` }], systemPrompt, {}, userId);
});

// ============ 4. 人物关系网 ============
// POST /api/v1/ai/relationship
router.post("/relationship", async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const { title, genre, characters } = req.body;
  const systemPrompt = `你是小说人物关系设计专家。根据用户提供的小说信息和角色列表，构建完整的人物关系网络。

请详细描述：
1. **关系总览** - 用关系图的方式列出所有角色及其关联
2. **核心关系链** - 主角与各方势力的关系
3. **情感关系** - 爱情、友情、亲情、仇敌等
4. **势力划分** - 不同阵营或团体
5. **关系演变** - 随剧情发展关系如何变化

格式要求：
- 用文字关系网表示：角色A --(关系类型)--> 角色B
- 对关键关系进行详细说明
- 给出关系发展的关键转折点`;
  await streamLLM(res, [{ role: "user", content: `书名：${title || "未定"}，类型：${genre}，角色：${characters || "待定"}` }], systemPrompt, {}, userId);
});

// ============ 5. 封面生成器 ============
// POST /api/v1/ai/cover
router.post("/cover", async (req: Request, res: Response) => {
  try {
    const { title, genre, style, description } = req.body;
    const userId = getUserId(req);
    const customHeaders = req.headers as Record<string, string>;
    const imgClient = await getUserImageClient(userId, customHeaders);

    let prompt = `小说封面设计，书籍标题"${title || "未命名"}"`;
    if (genre) prompt += `，类型：${genre}`;
    if (style) prompt += `，风格：${style}`;
    if (description) prompt += `，\n核心元素：${description}`;
    prompt += `\n要求：竖版书籍封面，精美的插画风格，在画面中嵌入书名"${title || "未命名"}"`;

    const response = await imgClient.generate({
      prompt,
      size: "2560x1440",
    });

    const helper = imgClient.getResponseHelper(response);
    if (helper.success) {
      res.json({ success: true, imageUrl: helper.imageUrls[0] });
    } else {
      res.json({ success: false, errors: helper.errorMessages });
    }
  } catch (err: any) {
    console.error("Cover generation error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============ 6. 地图生成器 ============
// POST /api/v1/ai/map
router.post("/map", async (req: Request, res: Response) => {
  try {
    const { worldName, genre, features } = req.body;
    const userId = getUserId(req);
    const customHeaders = req.headers as Record<string, string>;
    const imgClient = await getUserImageClient(userId, customHeaders);

    const prompt = `奇幻世界地图，世界观设定：${features || ""}。地图名称"${worldName || "幻想大陆"}"，风格：${genre || "幻想"}风格。需要包含：大陆轮廓、山川河流、城市标记、区域名称标注。地图绘制风格：古风/奇幻地图风格，羊皮纸底色。`;

    const response = await imgClient.generate({
      prompt,
      size: "3840x2160",
    });

    const helper = imgClient.getResponseHelper(response);
    if (helper.success) {
      res.json({ success: true, imageUrl: helper.imageUrls[0] });
    } else {
      res.json({ success: false, errors: helper.errorMessages });
    }
  } catch (err: any) {
    console.error("Map generation error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============ 7. 图片生成 ============
// POST /api/v1/ai/generate-image
router.post("/generate-image", async (req: Request, res: Response) => {
  try {
    const { prompt, style, aspectRatio } = req.body;
    const userId = getUserId(req);
    const customHeaders = req.headers as Record<string, string>;
    const imgClient = await getUserImageClient(userId, customHeaders);

    const fullPrompt = `小说插画：${prompt}${style ? `，风格：${style}` : ""}，精美高质量插画`;
    const size = aspectRatio === "square" ? "2560x2560" : "3840x2160";

    const response = await imgClient.generate({
      prompt: fullPrompt,
      size,
    });

    const helper = imgClient.getResponseHelper(response);
    if (helper.success) {
      res.json({ success: true, imageUrl: helper.imageUrls[0] });
    } else {
      res.json({ success: false, errors: helper.errorMessages });
    }
  } catch (err: any) {
    console.error("Image generation error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============ 8. 结构化大纲生成 ============
// POST /api/v1/ai/outline/structured
router.post("/outline/structured", async (req: Request, res: Response) => {
  try {
    const { title, genre, description, volumeCount, chaptersPerVolume } = req.body;
    const userId = getUserId(req);
    const result = await generateNovelOutline({
      title: title || "未定",
      genre: genre || "玄幻",
      description: description || "",
      volumeCount,
      chaptersPerVolume,
      userId,
    });
    res.json({ success: true, data: result });
  } catch (err: any) {
    console.error("Structured outline error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============ 9. 结构化角色生成 ============
// POST /api/v1/ai/character/structured
router.post("/character/structured", async (req: Request, res: Response) => {
  try {
    const { bookTitle, genre, description, count, roleType } = req.body;
    const userId = getUserId(req);
    const result = await generateCharacters({
      bookTitle: bookTitle || "未定",
      genre: genre || "玄幻",
      description: description || "",
      count: count || 5,
      roleType: roleType || 'all',
      userId,
    });
    res.json({ success: true, data: result });
  } catch (err: any) {
    console.error("Structured character error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============ 10. 结构化世界观生成 ============
// POST /api/v1/ai/worldbuilding/structured
router.post("/worldbuilding/structured", async (req: Request, res: Response) => {
  try {
    const { bookTitle, genre, description } = req.body;
    const userId = getUserId(req);
    const result = await generateWorldBuilding({
      bookTitle: bookTitle || "未定",
      genre: genre || "玄幻",
      description: description || "",
      userId,
    });
    res.json({ success: true, data: result });
  } catch (err: any) {
    console.error("World building error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============ 11. 生成章节内容（质量优化版） ============
// POST /api/v1/ai/chapter
router.post("/chapter", async (req: Request, res: Response) => {
  try {
    const { bookTitle, chapterTitle, chapterSummary, previousContent, genre, wordCount, style } = req.body;
    const userId = getUserId(req);
    const result = await generateChapter({
      bookTitle: bookTitle || "未定",
      chapterTitle: chapterTitle || "第一章",
      chapterSummary: chapterSummary || "",
      previousContent,
      genre: genre || "玄幻",
      wordCount: wordCount || 2000,
      style: style || 'normal',
      userId,
    });
    res.json({ success: true, data: result });
  } catch (err: any) {
    console.error("Chapter generation error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============ 12. 流式生成章节 ============
// POST /api/v1/ai/chapter/stream
router.post("/chapter/stream", async (req: Request, res: Response) => {
  try {
    const { bookTitle, chapterTitle, chapterSummary, previousContent, genre, wordCount, style } = req.body;
    const userId = getUserId(req);
    
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-store, no-transform, must-revalidate");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    let clientDisconnected = false;
    res.on("close", () => {
      clientDisconnected = true;
    });

    const stream = streamChapter({
      bookTitle: bookTitle || "未定",
      chapterTitle: chapterTitle || "第一章",
      chapterSummary: chapterSummary || "",
      previousContent,
      genre: genre || "玄幻",
      wordCount: wordCount || 2000,
      style: style || 'normal',
      userId,
    });

    for await (const chunk of stream) {
      if (clientDisconnected) break;
      res.write(`data: ${JSON.stringify({ content: chunk.content, step: chunk.step, totalSteps: chunk.totalSteps })}\n\n`);
    }

    if (!clientDisconnected && !res.writableEnded) {
      res.write(`data: [DONE]\n\n`);
      res.end();
    }
  } catch (err: any) {
    console.error("Stream chapter error:", err.message);
    if (!res.writableEnded) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
});

// ============ 13. 章节润色 ============
// POST /api/v1/ai/polish
router.post("/polish", async (req: Request, res: Response) => {
  try {
    const { content, polishType, instruction } = req.body;
    if (!content) {
      return res.status(400).json({ success: false, error: "内容不能为空" });
    }

    const userId = getUserId(req);
    const result = await polishChapter({
      content,
      polishType: polishType || 'style',
      instruction,
      userId,
    });
    res.json({ success: true, data: result });
  } catch (err: any) {
    console.error("Polish error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============ 14. 内容检测（结构化） ============
// POST /api/v1/ai/detect/structured
router.post("/detect/structured", async (req: Request, res: Response) => {
  try {
    const { content } = req.body;
    if (!content) {
      return res.status(400).json({ success: false, error: "内容不能为空" });
    }

    const result = await detectContent({ content });
    res.json({ success: true, data: result });
  } catch (err: any) {
    console.error("Detect content error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============ 15. 测试 AI 连接 ============
// POST /api/v1/ai/test-connection
router.post("/test-connection", async (req: Request, res: Response) => {
  try {
    const { apiKey, baseUrl, modelId } = req.body;
    if (!apiKey || !baseUrl || !modelId) {
      return res.status(400).json({ success: false, error: "缺少参数：apiKey、baseUrl、modelId 为必填" });
    }

    const url = `${baseUrl.replace(/\/+$/, "")}/chat/completions`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: "user", content: "Hello" }],
        max_tokens: 5,
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      return res.json({
        success: false,
        error: `HTTP ${response.status}${errorBody ? `: ${errorBody.substring(0, 200)}` : ""}`,
      });
    }

    const data: any = await response.json();
    if (data?.choices?.[0]?.message?.content !== undefined) {
      return res.json({ success: true, message: "连接成功，API 可正常使用" });
    } else {
      return res.json({ success: false, error: "响应格式异常，无法解析返回内容" });
    }
  } catch (err: any) {
    console.error("Test connection error:", err.message);
    return res.json({ success: false, error: `连接失败: ${err.message}` });
  }
});

export default router;