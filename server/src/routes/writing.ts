import { Router, type Request, type Response } from "express";
import { LLMClient } from "coze-coding-dev-sdk";
import type { LLMConfig } from "coze-coding-dev-sdk";

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
}

// --- In-memory store ---
let books: Book[] = [
  {
    id: "book1", title: "超神：我以DNF镇诸神", category: "玄幻", status: "连载中",
    cover: "from-purple-500 to-blue-500",
    coverImage: "/api/v1/static/images/covers/man/1.jpg",
    description: "当DNF角色穿越到诸神世界，一场颠覆之旅就此展开...",
    createdAt: "2025-01-15", wordCount: 0,
    volumes: [{ id: "v1", title: "第一卷 初入异世", order: 1, chapters: [
      { id: "c1", title: "第一章 穿越", wordCount: 0, createdAt: "2025-01-15", content: "", volumeId: "v1" },
    ]}],
  },
  {
    id: "book2", title: "总裁的天价小娇妻", category: "言情", status: "连载中",
    cover: "from-pink-500 to-rose-500",
    coverImage: "/api/v1/static/images/covers/women/1.jpg",
    description: "一场契约婚姻，却让两人的心越走越近...",
    createdAt: "2025-02-01", wordCount: 0,
    volumes: [{ id: "v2", title: "第一卷 契约婚姻", order: 1, chapters: [
      { id: "c2", title: "第一章 相遇", wordCount: 0, createdAt: "2025-02-01", content: "", volumeId: "v2" },
    ]}],
  },
  {
    id: "book3", title: "雾锁深山", category: "悬疑", status: "已完成",
    cover: "from-gray-700 to-gray-900",
    coverImage: "/api/v1/static/images/covers/man/9.jpg",
    description: "深山老林中的离奇命案，引出一段尘封多年的秘密...",
    createdAt: "2024-11-20", wordCount: 0,
    volumes: [{ id: "v3", title: "第一卷 迷雾", order: 1, chapters: [
      { id: "c3", title: "第一章 命案", wordCount: 0, createdAt: "2024-11-20", content: "", volumeId: "v3" },
      { id: "c4", title: "第二章 调查", wordCount: 0, createdAt: "2024-11-25", content: "", volumeId: "v3" },
    ]}],
  },
];

let outlines: Record<string, any[]> = {};
let settings: Record<string, any[]> = {};
let inspirations: Record<string, any[]> = {};

// --- Helper ---
function countWords(text: string): number {
  return text.replace(/\s/g, "").length;
}

// === Books CRUD ===
router.get("/", (_req: Request, res: Response) => {
  res.json({ success: true, data: books });
});

router.get("/:id", (req: Request, res: Response) => {
  const book = books.find((b) => b.id === req.params.id);
  if (!book) return res.status(404).json({ success: false, message: "未找到书籍" });
  res.json({ success: true, data: book });
});

router.post("/", (req: Request, res: Response) => {
  const { title, description, cover, coverImage, category } = req.body;
  if (!title) return res.status(400).json({ success: false, message: "书名不能为空" });
  const newBook: Book = {
    id: generateId(), title, category: category || "其他", status: "draft",
    cover: cover || "from-purple-500 to-blue-500",
    coverImage: coverImage || "",
    description: description || "",
    createdAt: new Date().toISOString().split("T")[0],
    wordCount: 0,
    volumes: [{ id: generateId(), title: "第一卷", order: 1, chapters: [] }],
  };
  books.unshift(newBook);
  res.json({ success: true, data: newBook });
});

router.put("/:id", (req: Request, res: Response) => {
  const book = books.find((b) => b.id === req.params.id);
  if (!book) return res.status(404).json({ success: false, message: "未找到书籍" });
  Object.assign(book, req.body);
  res.json({ success: true, data: book });
});

router.delete("/:id", (req: Request, res: Response) => {
  const index = books.findIndex((b) => b.id === req.params.id);
  if (index === -1) return res.status(404).json({ success: false, message: "未找到书籍" });
  books.splice(index, 1);
  res.json({ success: true });
});

// === Volumes CRUD ===
router.post("/:id/volumes", (req: Request, res: Response) => {
  const book = books.find((b) => b.id === req.params.id);
  if (!book) return res.status(404).json({ success: false, message: "未找到书籍" });
  const { title } = req.body;
  const newVolume: Volume = {
    id: generateId(), title: title || `第${book.volumes.length + 1}卷`,
    order: book.volumes.length + 1, chapters: [],
  };
  book.volumes.push(newVolume);
  res.json({ success: true, data: newVolume });
});

router.put("/:id/volumes/:volumeId", (req: Request, res: Response) => {
  const book = books.find((b) => b.id === req.params.id);
  if (!book) return res.status(404).json({ success: false, message: "未找到书籍" });
  const volume = book.volumes.find((v) => v.id === req.params.volumeId);
  if (!volume) return res.status(404).json({ success: false, message: "未找到卷" });
  Object.assign(volume, req.body);
  res.json({ success: true, data: volume });
});

router.delete("/:id/volumes/:volumeId", (req: Request, res: Response) => {
  const book = books.find((b) => b.id === req.params.id);
  if (!book) return res.status(404).json({ success: false, message: "未找到书籍" });
  const index = book.volumes.findIndex((v) => v.id === req.params.volumeId);
  if (index === -1) return res.status(404).json({ success: false, message: "未找到卷" });
  book.volumes.splice(index, 1);
  res.json({ success: true });
});

// === Chapters CRUD ===
router.post("/:id/volumes/:volumeId/chapters", (req: Request, res: Response) => {
  const book = books.find((b) => b.id === req.params.id);
  if (!book) return res.status(404).json({ success: false, message: "未找到书籍" });
  const volume = book.volumes.find((v) => v.id === req.params.volumeId);
  if (!volume) return res.status(404).json({ success: false, message: "未找到卷" });
  const { title } = req.body;
  const newChapter: Chapter = {
    id: generateId(), title: title || `第${volume.chapters.length + 1}章`,
    wordCount: 0, createdAt: new Date().toISOString().split("T")[0],
    content: "", volumeId: volume.id,
  };
  volume.chapters.push(newChapter);
  res.json({ success: true, data: newChapter });
});

router.put("/:id/chapters/:chapterId", (req: Request, res: Response) => {
  const book = books.find((b) => b.id === req.params.id);
  if (!book) return res.status(404).json({ success: false, message: "未找到书籍" });
  let chapter: Chapter | undefined;
  for (const v of book.volumes) {
    chapter = v.chapters.find((c) => c.id === req.params.chapterId);
    if (chapter) break;
  }
  if (!chapter) return res.status(404).json({ success: false, message: "未找到章节" });
  if (req.body.content !== undefined) chapter.wordCount = countWords(req.body.content);
  Object.assign(chapter, req.body);
  res.json({ success: true, data: chapter });
});

router.delete("/:id/chapters/:chapterId", (req: Request, res: Response) => {
  const book = books.find((b) => b.id === req.params.id);
  if (!book) return res.status(404).json({ success: false, message: "未找到书籍" });
  for (const v of book.volumes) {
    const index = v.chapters.findIndex((c) => c.id === req.params.chapterId);
    if (index !== -1) { v.chapters.splice(index, 1); break; }
  }
  res.json({ success: true });
});

// === Export Chapter ===
router.get("/:id/chapters/:chapterId/export", (req: Request, res: Response) => {
  const book = books.find((b) => b.id === req.params.id);
  if (!book) return res.status(404).json({ success: false, message: "未找到书籍" });
  let chapter: Chapter | undefined;
  for (const v of book.volumes) {
    chapter = v.chapters.find((c) => c.id === req.params.chapterId);
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
});

// === AI Dialogue (SSE) - Free-form chatting ===
router.post("/ai-dialogue", async (req: Request, res: Response) => {
  const { message } = req.body;
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
- 第一轮：用户给灵感 → 你给出3个书名建议，让用户选择或提供更详细的想法
- 后续轮次：用户选择或补充 → 完善类型、简介、核心设定
- 当信息充分时：生成完整大纲，通知用户准备好创建书籍

回复格式（markdown）：
- 用 **粗体** 强调关键信息
- 用 > 引用用户的想法
- 保持热情鼓励的语气
- 每次回复末尾给出明确的下一步建议`;

    const messages = [
      { role: "system" as const, content: systemPrompt },
      { role: "user" as const, content: message },
    ];

    const stream = client.stream(
      messages,
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
      const title = titleMatch?.[1]?.trim() || "";
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

        const newBook: Book = {
          id: generateId(), title: title || "未命名作品",
          category: category || "其他",
          status: "连载中",
          cover: "from-purple-500 to-blue-500",
          coverImage: `/api/v1/static/images/covers/${
            ["man", "women"][Math.floor(Math.random() * 2)]
          }/${Math.floor(Math.random() * 16) + 1}.jpg`,
          description: description || "",
          wordCount: 0,
          createdAt: new Date().toISOString().split("T")[0],
          volumes: [{
            id: volumeId,
            title: "第一卷",
            order: 1,
            chapters: outlineChapters,
          }],
        };

        books.unshift(newBook);

        res.write(`data: ${JSON.stringify({
          bookCreated: true,
          bookId: newBook.id,
          bookTitle: newBook.title,
          bookCategory: newBook.category,
          bookDescription: newBook.description,
          chaptersCount: outlineChapters.length,
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

请根据以上信息，生成一个详细的小说大纲。

要求：
1. 先简要分析该创意的亮点和潜力（1-2句话）
2. 然后给出完整的章节大纲
3. 每章包含标题和核心内容概要（50字以内）
4. 长篇建议8-12章，中篇5-8章，短篇3-5章

格式：
【分析】xxx
【大纲】
第1章：标题 - 内容概要
第2章：标题 - 内容概要
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

    // Send the full parsed outline as structured data
    const analysisMatch = fullContent.match(/【分析】\n?([\s\S]*?)(?=\n【大纲】|$)/);
    const chapterLines = fullContent.split("\n").filter((l: string) => {
      const trimmed = l.trim();
      return /^(第?\d+[章节卷]|第\d+章)/.test(trimmed) || /^\d+[\.\s、]/.test(trimmed);
    });

    const chapters = chapterLines.map((l: string, i: number) => {
      const clean = l.trim().replace(/^第?\d+[章节卷\.\s、]+/, "").replace(/^[\d\.\s、]+/, "");
      const parts = clean.split(/[-–—]/);
      return {
        index: i + 1,
        title: parts[0]?.trim() || `第${i + 1}章`,
        summary: parts[1]?.trim() || "",
      };
    });

    const analysis = analysisMatch?.[1]?.trim() || "";

    res.write(`data: ${JSON.stringify({
      type: "outline_complete",
      analysis,
      chapters,
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
  const { outline, chapters, genre, inspiration } = req.body;

  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-store, no-transform, must-revalidate");
  res.setHeader("Connection", "keep-alive");

  const client = new LLMClient();

  try {
    const chapterList = chapters?.map((c: any, i: number) =>
      `第${i + 1}章 ${c.title || c.name || ""}：${c.summary || ""}`
    ).join("\n") || "";

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
router.get("/:id/outlines", (req: Request, res: Response) => {
  const id = req.params.id as string;
  res.json({ success: true, data: outlines[id] || [] });
});
router.put("/:id/outlines", (req: Request, res: Response) => {
  const id = req.params.id as string;
  outlines[id] = req.body.data || [];
  res.json({ success: true });
});

// === Settings ===
router.get("/:id/settings", (req: Request, res: Response) => {
  const id = req.params.id as string;
  res.json({ success: true, data: settings[id] || [] });
});
router.put("/:id/settings", (req: Request, res: Response) => {
  const id = req.params.id as string;
  settings[id] = req.body.data || [];
  res.json({ success: true });
});

// === Inspirations ===
router.get("/:id/inspirations", (req: Request, res: Response) => {
  const id = req.params.id as string;
  res.json({ success: true, data: inspirations[id] || [] });
});
router.put("/:id/inspirations", (req: Request, res: Response) => {
  const id = req.params.id as string;
  inspirations[id] = req.body.data || [];
  res.json({ success: true });
});

export default router;