import { Router, type Request, type Response } from "express";
import { LLMClient } from "coze-coding-dev-sdk";
import type { LLMConfig } from "coze-coding-dev-sdk";
import multer from "multer";
import { getSupabaseClient } from "../storage/database/supabase-client.js";
import { toCamelCase } from "../utils/case-transform.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const router = Router();

function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

// --- Types ---
interface Chapter {
  id: string;
  title: string;
  wordCount: number;
  createdAt: string;
  content: string;
  volumeId: string;
}

interface Volume {
  id: string;
  title: string;
  order: number;
  chapters: Chapter[];
  collapsed?: boolean;
}

interface Book {
  id: string;
  title: string;
  category: string;
  status: string;
  cover: string;
  coverImage?: string;
  description: string;
  createdAt: string;
  wordCount: number;
  volumes: Volume[];
  outline?: string;
  outlineAnalysis?: string;
  outlineCharacters?: Array<{ name: string; desc: string }>;
  outlineWorldBuilding?: string;
}

// --- Helper ---
function countWords(text: string): number {
  return text.replace(/\s/g, "").length;
}

// === Books CRUD ===
router.get("/", async (_req: Request, res: Response) => {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from("books")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw new Error(`查询书籍失败: ${error.message}`);
    res.json({ success: true, data: toCamelCase(data || []) });
  } catch (err: any) {
    console.error("查询书籍错误:", err);
    res.status(500).json({ success: false, message: err.message || "服务器错误" });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from("books")
      .select("*")
      .eq("id", req.params.id)
      .maybeSingle();

    if (error) throw new Error(`查询书籍失败: ${error.message}`);
    if (!data) return res.status(404).json({ success: false, message: "未找到书籍" });
    res.json({ success: true, data: toCamelCase(data) });
  } catch (err: any) {
    console.error("查询书籍错误:", err);
    res.status(500).json({ success: false, message: err.message || "服务器错误" });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const { title, description, cover, coverImage, category, volumes } = req.body;
    if (!title) return res.status(400).json({ success: false, message: "书名不能为空" });

    const volumeId = generateId();
    const chapters = volumes && volumes.length > 0
      ? volumes[0]?.chapters || []
      : [];

    const newBook = {
      title,
      category: category || "其他",
      status: "draft",
      cover: cover || "from-purple-500 to-blue-500",
      cover_image: coverImage || "",
      description: description || "",
      word_count: 0,
      chapter_count: chapters.length,
      volumes: volumes && volumes.length > 0
        ? volumes.map((v: any, vi: number) => ({
            id: v.id || generateId(),
            title: v.title || `第${vi + 1}卷`,
            order: v.order || vi + 1,
            chapters: (v.chapters || []).map((c: any, ci: number) => ({
              id: c.id || generateId(),
              title: c.title || `第${ci + 1}章`,
              wordCount: c.wordCount || 0,
              createdAt: c.createdAt || new Date().toISOString().split("T")[0],
              content: c.content || "",
              volumeId: v.id || "",
            })),
          }))
        : [{ id: volumeId, title: "第一卷", order: 1, chapters: [] }],
    };

    const client = getSupabaseClient();
    const { data, error } = await client
      .from("books")
      .insert(newBook)
      .select()
      .single();

    if (error) throw new Error(`创建书籍失败: ${error.message}`);
    res.json({ success: true, data: toCamelCase(data) });
  } catch (err: any) {
    console.error("创建书籍错误:", err);
    res.status(500).json({ success: false, message: err.message || "服务器错误" });
  }
});

// POST /api/v1/writing/ai-generate - AI自动创建书籍
router.post("/ai-generate", async (req: Request, res: Response) => {
  try {
    const { topic } = req.body;
    if (!topic) return res.status(400).json({ success: false, message: "请输入创作主题" });

    const client = new LLMClient();
    const prompt = `你是一位资深网文作家。根据用户提供的主题"${topic}"，创作一部完整的小说方案。

请严格按照以下JSON格式返回，不要包含任何其他文字：
{
  "title": "小说书名（要有吸引力）",
  "category": "分类（从以下选择：玄幻、仙侠、都市、科幻、历史、言情、悬疑、游戏、武侠、奇幻）",
  "description": "小说简介（100字以内）",
  "volumes": [
    {
      "title": "第一卷标题",
      "order": 1,
      "chapters": [
        {"title": "第一章标题", "wordCount": 0, "content": "本章简要内容概述（50字左右）"},
        {"title": "第二章标题", "wordCount": 0, "content": "本章简要内容概述（50字左右）"}
      ]
    }
  ],
  "outline": "全书大纲（Markdown格式，包含故事背景、主要角色、剧情主线）"
}`;

    const stream = client.stream(
      [{ role: "user", content: prompt }],
      { model: "doubao-seed-2-0-lite-260215", temperature: 0.9 }
    );

    let fullContent = "";
    for await (const chunk of stream) {
      if (chunk.content) {
        fullContent += chunk.content;
      }
    }

    let bookData: any;
    try {
      const cleaned = fullContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      bookData = JSON.parse(cleaned);
    } catch {
      throw new Error("AI 返回格式错误，请重试");
    }

    const sb = getSupabaseClient();
    const volumeId = generateId();
    const chapters = bookData.volumes?.[0]?.chapters || [];

    const { data, error } = await sb.from("books").insert({
      title: bookData.title || topic,
      category: bookData.category || "其他",
      status: "draft",
      description: bookData.description || "",
      outline: bookData.outline || "",
      word_count: 0,
      chapter_count: chapters.length,
      volumes: bookData.volumes?.length > 0
        ? bookData.volumes.map((v: any, vi: number) => ({
            id: v.id || generateId(),
            title: v.title || `第${vi + 1}卷`,
            order: v.order || vi + 1,
            chapters: v.chapters?.map((c: any, ci: number) => ({
              id: c.id || generateId(),
              title: c.title || `第${ci + 1}章`,
              wordCount: c.wordCount || 0,
              createdAt: new Date().toISOString(),
              content: c.content || "",
              volumeId: v.id || volumeId,
            })) || [],
          }))
        : [{ id: volumeId, title: "第一卷", order: 1, chapters: [] }],
    }).select().single();

    if (error) throw new Error(`创建书籍失败: ${error.message}`);
    res.json({ success: true, data: toCamelCase(data) });
  } catch (err: any) {
    console.error("AI创建书籍错误:", err);
    res.status(500).json({ success: false, message: err.message || "AI生成失败" });
  }
});

router.put("/:id", async (req: Request, res: Response) => {
  try {
    const client = getSupabaseClient();
    const updateData: Record<string, any> = { ...req.body };
    // Remove id from update payload
    delete updateData.id;
    // Convert camelCase to snake_case for DB columns
    if (updateData.coverImage !== undefined) {
      updateData.cover_image = updateData.coverImage;
      delete updateData.coverImage;
    }
    if (updateData.wordCount !== undefined) {
      updateData.word_count = updateData.wordCount;
      delete updateData.wordCount;
    }
    if (updateData.chapterCount !== undefined) {
      updateData.chapter_count = updateData.chapterCount;
      delete updateData.chapterCount;
    }
    if (updateData.outlineAnalysis !== undefined) {
      updateData.outline_analysis = updateData.outlineAnalysis;
      delete updateData.outlineAnalysis;
    }
    if (updateData.outlineCharacters !== undefined) {
      updateData.outline_characters = updateData.outlineCharacters;
      delete updateData.outlineCharacters;
    }
    if (updateData.outlineWorldBuilding !== undefined) {
      updateData.outline_world_building = updateData.outlineWorldBuilding;
      delete updateData.outlineWorldBuilding;
    }
    // Handle volumes as JSON string if it's an array
    const { data, error } = await client
      .from("books")
      .update(updateData)
      .eq("id", req.params.id)
      .select()
      .single();

    if (error) throw new Error(`更新书籍失败: ${error.message}`);
    if (!data) return res.status(404).json({ success: false, message: "未找到书籍" });
    res.json({ success: true, data: toCamelCase(data) });
  } catch (err: any) {
    console.error("更新书籍错误:", err);
    res.status(500).json({ success: false, message: err.message || "服务器错误" });
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from("books")
      .delete()
      .eq("id", req.params.id)
      .select()
      .single();

    if (error) throw new Error(`删除书籍失败: ${error.message}`);
    if (!data) return res.status(404).json({ success: false, message: "未找到书籍" });
    res.json({ success: true });
  } catch (err: any) {
    console.error("删除书籍错误:", err);
    res.status(500).json({ success: false, message: err.message || "服务器错误" });
  }
});

// === Volumes CRUD ===
router.post("/:id/volumes", async (req: Request, res: Response) => {
  try {
    const client = getSupabaseClient();
    const { data: book, error: fetchError } = await client
      .from("books")
      .select("volumes")
      .eq("id", req.params.id)
      .single();

    if (fetchError) throw new Error(`查询书籍失败: ${fetchError.message}`);
    if (!book) return res.status(404).json({ success: false, message: "未找到书籍" });

    const volumes = typeof book.volumes === "string" ? JSON.parse(book.volumes) : (book.volumes || []);
    const { title } = req.body;
    const newVolume = {
      id: generateId(),
      title: title || `第${volumes.length + 1}卷`,
      order: volumes.length + 1,
      chapters: [],
    };
    volumes.push(newVolume);

    const { data, error } = await client
      .from("books")
      .update({ volumes: volumes })
      .eq("id", req.params.id)
      .select()
      .single();

    if (error) throw new Error(`创建卷失败: ${error.message}`);
    res.json({ success: true, data: newVolume });
  } catch (err: any) {
    console.error("创建卷错误:", err);
    res.status(500).json({ success: false, message: err.message || "服务器错误" });
  }
});

router.put("/:id/volumes/:volumeId", async (req: Request, res: Response) => {
  try {
    const client = getSupabaseClient();
    const { data: book, error: fetchError } = await client
      .from("books")
      .select("volumes")
      .eq("id", req.params.id)
      .single();

    if (fetchError) throw new Error(`查询书籍失败: ${fetchError.message}`);
    if (!book) return res.status(404).json({ success: false, message: "未找到书籍" });

    const volumes = typeof book.volumes === "string" ? JSON.parse(book.volumes) : (book.volumes || []);
    const volume = volumes.find((v: any) => v.id === req.params.volumeId);
    if (!volume) return res.status(404).json({ success: false, message: "未找到卷" });
    Object.assign(volume, req.body);

    const { data, error } = await client
      .from("books")
      .update({ volumes: volumes })
      .eq("id", req.params.id)
      .select()
      .single();

    if (error) throw new Error(`更新卷失败: ${error.message}`);
    res.json({ success: true, data: toCamelCase(volume) });
  } catch (err: any) {
    console.error("更新卷错误:", err);
    res.status(500).json({ success: false, message: err.message || "服务器错误" });
  }
});

router.delete("/:id/volumes/:volumeId", async (req: Request, res: Response) => {
  try {
    const client = getSupabaseClient();
    const { data: book, error: fetchError } = await client
      .from("books")
      .select("volumes")
      .eq("id", req.params.id)
      .single();

    if (fetchError) throw new Error(`查询书籍失败: ${fetchError.message}`);
    if (!book) return res.status(404).json({ success: false, message: "未找到书籍" });

    const volumes = typeof book.volumes === "string" ? JSON.parse(book.volumes) : (book.volumes || []);
    const index = volumes.findIndex((v: any) => v.id === req.params.volumeId);
    if (index === -1) return res.status(404).json({ success: false, message: "未找到卷" });
    volumes.splice(index, 1);

    const { error } = await client
      .from("books")
      .update({ volumes: volumes })
      .eq("id", req.params.id);

    if (error) throw new Error(`删除卷失败: ${error.message}`);
    res.json({ success: true });
  } catch (err: any) {
    console.error("删除卷错误:", err);
    res.status(500).json({ success: false, message: err.message || "服务器错误" });
  }
});

// === Chapters CRUD ===
router.post("/:id/volumes/:volumeId/chapters", async (req: Request, res: Response) => {
  try {
    const client = getSupabaseClient();
    const { data: book, error: fetchError } = await client
      .from("books")
      .select("volumes")
      .eq("id", req.params.id)
      .single();

    if (fetchError) throw new Error(`查询书籍失败: ${fetchError.message}`);
    if (!book) return res.status(404).json({ success: false, message: "未找到书籍" });

    const volumes = typeof book.volumes === "string" ? JSON.parse(book.volumes) : (book.volumes || []);
    const volume = volumes.find((v: any) => v.id === req.params.volumeId);
    if (!volume) return res.status(404).json({ success: false, message: "未找到卷" });

    const { title } = req.body;
    const newChapter = {
      id: generateId(),
      title: title || `第${volume.chapters.length + 1}章`,
      wordCount: 0,
      createdAt: new Date().toISOString().split("T")[0],
      content: "",
      volumeId: volume.id,
    };
    volume.chapters.push(newChapter);

    const { data, error } = await client
      .from("books")
      .update({ volumes: volumes })
      .eq("id", req.params.id)
      .select()
      .single();

    if (error) throw new Error(`创建章节失败: ${error.message}`);
    res.json({ success: true, data: newChapter });
  } catch (err: any) {
    console.error("创建章节错误:", err);
    res.status(500).json({ success: false, message: err.message || "服务器错误" });
  }
});

// GET /:id/chapters/:chapterId - 获取单个章节内容
router.get("/:id/chapters/:chapterId", async (req: Request, res: Response) => {
  try {
    const client = getSupabaseClient();
    const { data: book, error: fetchError } = await client
      .from("books")
      .select("volumes")
      .eq("id", req.params.id)
      .single();

    if (fetchError) throw new Error(`查询书籍失败: ${fetchError.message}`);
    if (!book) return res.status(404).json({ success: false, message: "未找到书籍" });

    const volumes = typeof book.volumes === "string" ? JSON.parse(book.volumes) : (book.volumes || []);
    let chapter: any;
    for (const v of volumes) {
      chapter = v.chapters?.find((c: any) => c.id === req.params.chapterId);
      if (chapter) break;
    }
    if (!chapter) return res.status(404).json({ success: false, message: "未找到章节" });

    res.json({ success: true, data: toCamelCase(chapter) });
  } catch (err: any) {
    console.error("获取章节错误:", err);
    res.status(500).json({ success: false, message: err.message || "服务器错误" });
  }
});

router.put("/:id/chapters/:chapterId", async (req: Request, res: Response) => {
  try {
    const client = getSupabaseClient();
    const { data: book, error: fetchError } = await client
      .from("books")
      .select("volumes")
      .eq("id", req.params.id)
      .single();

    if (fetchError) throw new Error(`查询书籍失败: ${fetchError.message}`);
    if (!book) return res.status(404).json({ success: false, message: "未找到书籍" });

    const volumes = typeof book.volumes === "string" ? JSON.parse(book.volumes) : (book.volumes || []);
    let chapter: any;
    for (const v of volumes) {
      chapter = v.chapters?.find((c: any) => c.id === req.params.chapterId);
      if (chapter) break;
    }
    if (!chapter) return res.status(404).json({ success: false, message: "未找到章节" });
    if (req.body.content !== undefined) chapter.wordCount = countWords(req.body.content);
    Object.assign(chapter, req.body);

    const { error } = await client
      .from("books")
      .update({ volumes: volumes })
      .eq("id", req.params.id);

    if (error) throw new Error(`更新章节失败: ${error.message}`);
    res.json({ success: true, data: chapter });
  } catch (err: any) {
    console.error("更新章节错误:", err);
    res.status(500).json({ success: false, message: err.message || "服务器错误" });
  }
});

router.delete("/:id/chapters/:chapterId", async (req: Request, res: Response) => {
  try {
    const client = getSupabaseClient();
    const { data: book, error: fetchError } = await client
      .from("books")
      .select("volumes")
      .eq("id", req.params.id)
      .single();

    if (fetchError) throw new Error(`查询书籍失败: ${fetchError.message}`);
    if (!book) return res.status(404).json({ success: false, message: "未找到书籍" });

    const volumes = typeof book.volumes === "string" ? JSON.parse(book.volumes) : (book.volumes || []);
    let found = false;
    for (const v of volumes) {
      if (v.chapters) {
        const idx = v.chapters.findIndex((c: any) => c.id === req.params.chapterId);
        if (idx !== -1) {
          v.chapters.splice(idx, 1);
          found = true;
          break;
        }
      }
    }
    if (!found) return res.status(404).json({ success: false, message: "未找到章节" });

    const { error } = await client
      .from("books")
      .update({ volumes: volumes })
      .eq("id", req.params.id);

    if (error) throw new Error(`删除章节失败: ${error.message}`);
    res.json({ success: true });
  } catch (err: any) {
    console.error("删除章节错误:", err);
    res.status(500).json({ success: false, message: err.message || "服务器错误" });
  }
});

// === Export Chapter ===
router.get("/:id/chapters/:chapterId/export", async (req: Request, res: Response) => {
  try {
    const client = getSupabaseClient();
    const { data: book, error: fetchError } = await client
      .from("books")
      .select("volumes")
      .eq("id", req.params.id)
      .single();

    if (fetchError) throw new Error(`查询书籍失败: ${fetchError.message}`);
    if (!book) return res.status(404).json({ success: false, message: "未找到书籍" });

    const volumes = typeof book.volumes === "string" ? JSON.parse(book.volumes) : (book.volumes || []);
    let chapter: any;
    for (const v of volumes) {
      chapter = v.chapters?.find((c: any) => c.id === req.params.chapterId);
      if (chapter) break;
    }
    if (!chapter) return res.status(404).json({ success: false, message: "未找到章节" });

    const format = req.query.format as string || "txt";
    const content = `# ${chapter.title}\n\n${chapter.content}`;
    if (format === "md") {
      res.setHeader("Content-Type", "text/markdown; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${chapter.title}.md"`);
    } else {
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${chapter.title}.txt"`);
    }
    res.send(content);
  } catch (err: any) {
    console.error("导出章节错误:", err);
    res.status(500).json({ success: false, message: err.message || "服务器错误" });
  }
});

// GET /:id/outline/export - 导出大纲为MD文件
router.get("/:id/outline/export", async (req: Request, res: Response) => {
  try {
    const client = getSupabaseClient();
    const { data: book, error } = await client
      .from("books")
      .select("title, outline")
      .eq("id", req.params.id)
      .single();

    if (error) throw new Error(`查询书籍失败: ${error.message}`);
    if (!book) return res.status(404).json({ success: false, message: "未找到书籍" });
    if (!book.outline) return res.status(404).json({ success: false, message: "该书还没有大纲" });

    const mdContent = `# 《${book.title}》大纲\n\n${book.outline}`;
    const filename = `${book.title}_大纲.md`;
    res.setHeader("Content-Type", "text/markdown; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    res.send(mdContent);
  } catch (err: any) {
    console.error("导出大纲错误:", err);
    res.status(500).json({ success: false, message: err.message || "导出失败" });
  }
});

// === AI Dialogue (SSE) - Free-form chatting ===
router.post("/ai-dialogue", async (req: Request, res: Response) => {
  const { message, history } = req.body;
  if (!message) return res.status(400).json({ success: false, message: "消息不能为空" });

  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-store, no-transform, must-revalidate");
  res.setHeader("Connection", "keep-alive");

  const client = new LLMClient();
  let fullContent = "";

  try {
    const systemPrompt = `你是一个专业的AI小说创作助手。你通过对话引导用户创作小说。

用户的每条消息可能是一个灵感、想法或问题。你需要：
1. 热情回应并肯定用户的创意
2. 根据用户输入，逐步帮ta完善小说设定
3. 当信息足够时（书名+类型+大纲雏形），主动提出帮用户创建书籍

对话节奏：
- 自由对话模式：用户可能提出任何创作相关的问题
- 如果用户给了小说灵感，引导ta完善设定
- 当信息充分时：必须按标准格式输出完整书籍信息，系统自动创建

【重要】当你要创建书籍时，回复末尾必须附加以下格式的元数据块：

【书名】《小说标题》
【类型】玄幻/言情/悬疑/科幻/都市/仙侠/历史/游戏
【简介】一段精彩的简介（100字左右）
【大纲】
第1章 标题 - 内容概要
第2章 标题 - 内容概要
第3章 标题 - 内容概要
...

注意：
- 元数据块用空行与正文隔开
- 大纲每章一行，格式"第N章 标题 - 概要"
- 系统会自动解析并创建书籍，大纲保存为Markdown
- 用户还在构思阶段则不输出元数据块
- 用户明确要创作某部作品时才输出

【非常重要】如果用户说"帮我写本书"、"创作一本小说"、"写本XX小说"等明确要求创作的话，你必须输出完整的元数据块。如果用户只给了模糊想法，先帮ta完善，然后再输出元数据块。`;

    // Build message array with history context
    const msgs: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: systemPrompt },
    ];

    // Add conversation history if provided
    if (Array.isArray(history)) {
      for (const h of history) {
        if (h.role && h.content && (h.role === "user" || h.role === "assistant")) {
          msgs.push({ role: h.role, content: h.content });
        }
      }
    }

    // Add current message
    msgs.push({ role: "user", content: message });

    const stream = client.stream(
      msgs,
      { model: "doubao-seed-2-0-lite-260215", temperature: 0.8 }
    );

    for await (const chunk of stream) {
      if (chunk.content) {
        fullContent += chunk.content;
        res.write(`data: ${JSON.stringify({ content: chunk.content })}\n\n`);
      }
    }

    // Check if the AI suggests creating a book
    const titleMatch = fullContent.match(/【书名】[\s]*\n?([^\n]+)/);
    const genreMatch = fullContent.match(/【类型】[\s]*\n?([^\n]+)/);
    const descMatch = fullContent.match(/【简介】[\s]*\n?([^\n]+)/);
    const outlineMatch = fullContent.match(/【大纲】[\s]*\n?([\s\S]+?)(?:\n【|$)/);

    if (titleMatch || genreMatch || descMatch) {
      const title = titleMatch?.[1]?.trim()?.replace(/[《》]/g, "") || "";
      const category = genreMatch?.[1]?.trim() || "";
      const description = descMatch?.[1]?.trim() || "";
      const outlineText = outlineMatch?.[1]?.trim() || "";

      const outlineChapters = outlineText
        .split(/\n/)
        .filter((l: string) => l.trim())
        .map((l: string, i: number) => {
          const clean = l.trim().replace(/^\d+[\.\s、]+/, "");
          return {
            id: generateId(),
            title: clean || `第${i + 1}章`,
            wordCount: 0,
            createdAt: new Date().toISOString().split("T")[0],
            content: "",
            volumeId: "",
          };
        });

      if (title || category || description) {
        const volumeId = generateId();
        outlineChapters.forEach((c: Chapter) => { c.volumeId = volumeId; });

        const newBookData = {
          title: title || "未命名作品",
          category: category || "其他",
          status: "连载中",
          cover: "from-purple-500 to-blue-500",
          cover_image: `/api/v1/static/images/covers/${
            ["man", "women"][Math.floor(Math.random() * 2)]
          }/${Math.floor(Math.random() * 16) + 1}.jpg`,
          description: description || "",
          word_count: 0,
          chapter_count: outlineChapters.length,
          outline: `# 大纲\n\n${outlineText || "(待完善)"}`,
          volumes: [{
            id: volumeId,
            title: "第一卷",
            order: 1,
            chapters: outlineChapters,
          }],
        };

        // Save to Supabase
        const supabase = getSupabaseClient();
        const { data: savedBook, error } = await supabase
          .from("books")
          .insert(newBookData)
          .select()
          .single();

        if (error) {
          console.error("保存AI创建的书籍失败:", error);
        } else {
          const camelBook = toCamelCase(savedBook);
          res.write(`data: ${JSON.stringify({
            bookCreated: true,
            bookId: camelBook.id,
            bookTitle: camelBook.title,
            bookCategory: camelBook.category,
            bookDescription: camelBook.description,
            chaptersCount: outlineChapters.length,
          })}\n\n`);
        }
      }
    } else {
      // Fallback: if user explicitly asked to create a book but AI didn't output markers
      const createKeywords = /(?:帮我写|创作|写本|写一本|创建|新建).*(?:书|小说|作品|故事)/;
      if (createKeywords.test(message)) {
        // Try to be helpful - send a hint back to the user
        res.write(`data: ${JSON.stringify({
          content: "\n\n（提示：下次开始创作时，可以直接告诉我你的小说灵感，比如：\n👉 \"我想写一本玄幻小说\"\n👉 \"帮我创作一个关于重生复仇的故事\"\n我会自动为你生成小说！）"
        })}\n\n`);
      }
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err) {
    console.error("AI dialogue error:", err);
    res.write(`data: ${JSON.stringify({ error: "AI服务异常，请稍后重试" })}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
  }
});

// === AI Generate Outline (SSE) - Structured outline generation ===
router.post("/generate-outline", async (req: Request, res: Response) => {
  const { inspiration, genre, audience, platform, length } = req.body;

  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-store, no-transform, must-revalidate");
  res.setHeader("Connection", "keep-alive");

  const client = new LLMClient();

  try {
    const prompt = `你是一位资深网文创作顾问。用户计划创作一部小说，基本信息如下：

【创作灵感】${inspiration || "待完善"}
【小说类型】${genre || "待确定"}
【受众定位】${audience || "待确定"}
【目标平台】${platform || "待确定"}
【篇幅规划】${length || "待确定"}

请根据以上信息，生成一个完整的小说创作大纲，要有分卷规划。

要求：
1. 先分析该创意的亮点和潜力（50字以内）
2. 给出主要角色设定（每个角色30字以内）
3. 给出世界观设定简述（50字以内）
4. 将大纲分为多卷，每卷4-6章
5. 每章包含标题和核心内容概要（20字以内）

输出格式必须严格按以下结构：

【亮点分析】
xxx

【角色设定】
角色名（身份）：简介

【世界观】
xxx

【第一卷·卷名】
卷概要：xxx
第1章：章名 - 内容概要
第2章：章名 - 内容概要
...

【第二卷·卷名】
卷概要：xxx
第1章：章名 - 内容概要
...`;

    const stream = client.stream(
      [{ role: "system", content: "你是一个专业的网文大纲生成专家，擅长根据用户需求生成结构化的小说大纲。" },
       { role: "user", content: prompt }],
      { model: "doubao-seed-2-0-lite-260215", temperature: 0.8 }
    );

    let fullContent = "";
    for await (const chunk of stream) {
      if (chunk.content) {
        fullContent += chunk.content;
        res.write(`data: ${JSON.stringify({ type: "outline", content: chunk.content })}\n\n`);
      }
    }

    // Parse 【亮点分析】
    const analysisMatch = fullContent.match(/【亮点分析】\n?([\s\S]*?)(?=\n【角色设定】|$)/);
    const analysis = analysisMatch?.[1]?.trim() || "";

    // Parse 【角色设定】
    const charMatch = fullContent.match(/【角色设定】\n?([\s\S]*?)(?=\n【世界观】|$)/);
    const charactersRaw = charMatch?.[1]?.trim() || "";
    const characters = charactersRaw.split("\n").filter((l: string) => l.trim()).map((l: string) => {
      const parts = l.trim().replace(/^\d+[\.\s、]/, "").split(/[（(]/);
      return { name: parts[0]?.trim() || "", desc: parts[1]?.replace(/[）)]/g, "")?.trim() || "" };
    });

    // Parse 【世界观】
    const worldMatch = fullContent.match(/【世界观】\n?([\s\S]*?)(?=\n【第|$)/);
    const worldBuilding = worldMatch?.[1]?.trim() || "";

    // Parse volumes from blocks like 【第一卷·卷名】
    const volumes: Array<{
      id: string;
      title: string;
      summary: string;
      order: number;
      chapters: Array<{
        id: string;
        title: string;
        wordCount: number;
        createdAt: string;
        content: string;
        volumeId: string;
        summary: string;
      }>;
    }> = [];

    const volumeBlocks = fullContent.split(/\n(?=【第[一二三四五六七八九十]+卷)/g);
    volumeBlocks.forEach((block: string, vi: number) => {
      const titleMatch = block.match(/【(.+?)】\n/);
      if (!titleMatch) return;
      const fullTitle = titleMatch[1];
      const summaryMatch = block.match(/卷概要[：:]\s*(.+?)(?:\n|$)/);
      const cleanBlock = block.replace(/卷概要[：:].*?\n/, "");
      const chapterLines = cleanBlock.split("\n").filter((l: string) => {
        const trimmed = l.trim();
        return /^第\d+章[：:]/.test(trimmed);
      });

      if (chapterLines.length === 0) return;

      const volId = generateId();
      const chapters = chapterLines.map((l: string, ci: number) => {
        const trimmed = l.trim();
        const afterPrefix = trimmed.replace(/^第\d+章[：:]\s*/, "");
        const parts = afterPrefix.split(/[-–—]/);
        return {
          id: generateId(),
          title: parts[0]?.trim() || `第${ci + 1}章`,
          wordCount: 0,
          createdAt: new Date().toISOString().split("T")[0],
          content: "",
          volumeId: volId,
          summary: parts[1]?.trim() || "",
        };
      });

      volumes.push({
        id: volId,
        title: fullTitle,
        summary: summaryMatch?.[1]?.trim() || "",
        order: vi + 1,
        chapters,
      });
    });

    res.write(`data: ${JSON.stringify({
      type: "outline_complete",
      analysis,
      characters,
      worldBuilding,
      volumes,
      fullOutline: fullContent,
    })}\n\n`);

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err) {
    console.error("Generate outline error:", err);
    res.write(`data: ${JSON.stringify({ error: "大纲生成失败，请重试" })}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
  }
});

// === AI Generate Book Details (SSE) ===
router.post("/generate-details", async (req: Request, res: Response) => {
  const { outline, volumes, genre, inspiration } = req.body;

  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-store, no-transform, must-revalidate");
  res.setHeader("Connection", "keep-alive");

  const client = new LLMClient();

  try {
    const chapterList = volumes?.map((v: any) =>
      `【${v.title || "卷"}】\n${(v.chapters || []).map((c: any, i: number) =>
        `第${i + 1}章 ${c.title || ""}：${c.summary || ""}`
      ).join("\n")}`
    ).join("\n\n") || "";

    const prompt = `基于以下小说大纲，生成书名、简介和封面描述。

【灵感】${inspiration || ""}
【类型】${genre || ""}
【大纲】
${chapterList || outline || ""}

请生成：
1. 一个吸引人的书名（有网文风格，突出爽点/亮点）
2. 一段精彩的简介（100-150字，包含核心设定和冲突，有钩子）
3. 一段封面描述（适合AI绘图使用的英文prompt，描述封面场景和风格）

格式：
【书名】xxx
【简介】xxx（不要用markdown格式，纯文字）
【封面描述】xxx（英文）`;

    const stream = client.stream(
      [{ role: "system", content: "你是一个专业的小说出版顾问，擅长为小说起名、写简介和设计封面。" },
       { role: "user", content: prompt }],
      { model: "doubao-seed-2-0-lite-260215", temperature: 0.8 }
    );

    let fullContent = "";
    for await (const chunk of stream) {
      if (chunk.content) {
        fullContent += chunk.content;
        res.write(`data: ${JSON.stringify({ type: "details", content: chunk.content })}\n\n`);
      }
    }

    const titleMatch = fullContent.match(/【书名】\n?([^\n]+)/);
    const descMatch = fullContent.match(/【简介】\n?([\s\S]*?)(?=\n【封面描述】|$)/);
    const coverMatch = fullContent.match(/【封面描述】\n?([\s\S]*)/);

    res.write(`data: ${JSON.stringify({
      type: "details_complete",
      title: titleMatch?.[1]?.trim() || "",
      description: descMatch?.[1]?.trim() || "",
      coverPrompt: coverMatch?.[1]?.trim() || "",
      fullContent,
    })}\n\n`);

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err) {
    console.error("Generate details error:", err);
    res.write(`data: ${JSON.stringify({ error: "详情生成失败，请重试" })}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
  }
});

// === Outlines ===
router.get("/:id/outlines", async (req: Request, res: Response) => {
  try {
    const client = getSupabaseClient();
    const { data: book, error } = await client
      .from("books")
      .select("outline")
      .eq("id", req.params.id)
      .maybeSingle();

    if (error) throw new Error(`查询大纲失败: ${error.message}`);
    res.json({ success: true, data: book?.outline || "" });
  } catch (err: any) {
    console.error("查询大纲错误:", err);
    res.status(500).json({ success: false, message: err.message || "服务器错误" });
  }
});

router.put("/:id/outlines", async (req: Request, res: Response) => {
  try {
    const client = getSupabaseClient();
    const { error } = await client
      .from("books")
      .update({ outline: req.body.outline || "" })
      .eq("id", req.params.id);

    if (error) throw new Error(`更新大纲失败: ${error.message}`);
    res.json({ success: true });
  } catch (err: any) {
    console.error("更新大纲错误:", err);
    res.status(500).json({ success: false, message: err.message || "服务器错误" });
  }
});

// === Settings ===
router.get("/:id/settings", async (req: Request, res: Response) => {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from("user_settings")
      .select("data")
      .eq("book_id", req.params.id)
      .maybeSingle();

    if (error) throw new Error(`查询设定失败: ${error.message}`);
    res.json({ success: true, data: data?.data || [] });
  } catch (err: any) {
    console.error("查询设定错误:", err);
    res.status(500).json({ success: false, message: err.message || "服务器错误" });
  }
});

router.put("/:id/settings", async (req: Request, res: Response) => {
  try {
    const client = getSupabaseClient();
    const { data: existing } = await client
      .from("user_settings")
      .select("id")
      .eq("book_id", req.params.id)
      .maybeSingle();

    if (existing) {
      const { error } = await client
        .from("user_settings")
        .update({ data: req.body.data || [] })
        .eq("book_id", req.params.id);
      if (error) throw new Error(`更新设定失败: ${error.message}`);
    } else {
      const { error } = await client
        .from("user_settings")
        .insert({ book_id: req.params.id, data: req.body.data || [] });
      if (error) throw new Error(`创建设定失败: ${error.message}`);
    }
    res.json({ success: true });
  } catch (err: any) {
    console.error("更新设定错误:", err);
    res.status(500).json({ success: false, message: err.message || "服务器错误" });
  }
});

// === Inspirations ===
router.get("/:id/inspirations", async (req: Request, res: Response) => {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from("inspirations")
      .select("data")
      .eq("book_id", req.params.id)
      .maybeSingle();

    if (error) throw new Error(`查询灵感失败: ${error.message}`);
    res.json({ success: true, data: data?.data || [] });
  } catch (err: any) {
    console.error("查询灵感错误:", err);
    res.status(500).json({ success: false, message: err.message || "服务器错误" });
  }
});

router.put("/:id/inspirations", async (req: Request, res: Response) => {
  try {
    const client = getSupabaseClient();
    const { data: existing } = await client
      .from("inspirations")
      .select("id")
      .eq("book_id", req.params.id)
      .maybeSingle();

    if (existing) {
      const { error } = await client
        .from("inspirations")
        .update({ data: req.body.data || [] })
        .eq("book_id", req.params.id);
      if (error) throw new Error(`更新灵感失败: ${error.message}`);
    } else {
      const { error } = await client
        .from("inspirations")
        .insert({ book_id: req.params.id, data: req.body.data || [] });
      if (error) throw new Error(`创建灵感失败: ${error.message}`);
    }
    res.json({ success: true });
  } catch (err: any) {
    console.error("更新灵感错误:", err);
    res.status(500).json({ success: false, message: err.message || "服务器错误" });
  }
});

// === File Upload ===
router.post("/upload", upload.single("file"), async (req: Request, res: Response) => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ success: false, error: "请上传文件" });
      return;
    }

    const textContent = file.buffer.toString("utf-8");

    res.json({
      success: true,
      data: {
        name: file.originalname,
        size: file.size,
        mimeType: file.mimetype,
        content: textContent.substring(0, 50000), // Limit content size
      },
    });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message || "上传失败" });
  }
});

export default router;