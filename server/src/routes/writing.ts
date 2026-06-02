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

// === AI Generate Book ===
router.post("/ai-generate", async (req: Request, res: Response) => {
  const { idea, theme, genre } = req.body;
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const client = new LLMClient();

  let bookInfo: any = {};
  let lastContent = "";

  try {
    const prompt = `你是一位资深小说创作助手。用户有以下创作想法：${idea || "无"}

请一步步帮助用户创作一部小说。

首先，根据用户的灵感，生成小说的基本信息：
- 书名（吸引人、贴合主题）
- 类型（玄幻/言情/悬疑/科幻/都市/仙侠/历史/其他）
- 一句话简介

然后，生成一个详细的大纲（3-5个主要章节/情节节点）。

格式要求：
【书名】xxx
【类型】xxx
【简介】xxx
【大纲】
1. xxx
2. xxx
3. xxx`;

    const stream = client.stream(
      [{ role: "user", content: prompt }],
      { model: "doubao-seed-2-0-lite-260215" }
    );

    for await (const chunk of stream) {
      if (chunk.content) {
        lastContent += chunk.content;
        res.write(`data: ${JSON.stringify({ content: chunk.content })}\n\n`);
      }
    }

    // Parse generated content to create book
    const titleMatch = lastContent.match(/【书名】(.+)/);
    const genreMatch = lastContent.match(/【类型】(.+)/);
    const descMatch = lastContent.match(/【简介】(.+)/);
    const outlineMatch = lastContent.match(/【大纲】\n([\s\S]+)/);

    const title = titleMatch?.[1]?.trim() || "未命名作品";
    const category = genreMatch?.[1]?.trim() || genre || "其他";
    const description = descMatch?.[1]?.trim() || "";
    const outlineText = outlineMatch?.[1]?.trim() || "";

    const outlineChapters = outlineText.split(/\n/).filter((l: string) => l.trim()).map((l: string, i: number) => ({
      id: generateId(),
      title: l.trim().replace(/^\d+[\.\s]+/, ""),
      wordCount: 0, createdAt: new Date().toISOString().split("T")[0],
      content: "", volumeId: "",
    }));

    const volumeId = generateId();
    outlineChapters.forEach((c: Chapter) => { c.volumeId = volumeId; });

    const newBook: Book = {
      id: generateId(), title, category,
      status: "draft", cover: "from-purple-500 to-blue-500",
      coverImage: `/api/v1/static/images/covers/${["man","women"][Math.floor(Math.random()*2)]}/${(Math.floor(Math.random()*16)+1)}.jpg`,
      description, wordCount: 0,
      createdAt: new Date().toISOString().split("T")[0],
      volumes: [{ id: volumeId, title: "第一卷", order: 1, chapters: outlineChapters }],
    };

    books.unshift(newBook);

    res.write(`data: ${JSON.stringify({ done: true, bookId: newBook.id, title: newBook.title })}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
  } catch (error) {
    console.error("AI生成失败:", error);
    res.write(`data: ${JSON.stringify({ error: "AI生成失败，请重试" })}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
  }
});

// === AI Chat (for homepage dialogue) ===
router.post("/ai-chat", async (req: Request, res: Response) => {
  const { message, history } = req.body;
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const client = new LLMClient();

  const systemPrompt = `你是一位专业的AI小说创作助手，名叫"灵犀"。你的任务是帮助用户创作小说。

你可以：
1. 根据用户的灵感，帮ta构思书名、类型、大纲、章节
2. 对用户的想法提出建设性建议和补充
3. 引导用户逐步完善小说设定
4. 在用户确认后，帮ta生成完整的小说结构和章节

回复风格：友善、专业、有创造力。用中文回复。`;

  const messages = [{ role: "system", content: systemPrompt }, ...(history || []), { role: "user", content: message }];

  try {
    const stream = client.stream(messages) as AsyncGenerator<{ content: string } & { delta?: string }, void, unknown>;
    for await (const chunk of stream) {
      if (chunk.content) res.write(`data: ${JSON.stringify({ content: chunk.content })}\n\n`);
    }
    res.write("data: [DONE]\n\n");
    res.end();
  } catch (error) {
    console.error("AI对话失败:", error);
    res.write("data: [DONE]\n\n");
    res.end();
  }
});

// === AI Tools ===
router.post("/ai-expand", async (req: Request, res: Response) => {
  const { content, instruction } = req.body;
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  const client = new LLMClient();
  const prompt = instruction || "请对以下内容进行润色和扩写，保持风格一致：\n\n" + content;
  try {
    const stream = client.stream([{ role: "user" as const, content: prompt }]) as AsyncGenerator<{ content: string } & { delta?: string }, void, unknown>;
    for await (const chunk of stream) {
      if (chunk.content) res.write(`data: ${JSON.stringify({ content: chunk.content })}\n\n`);
    }
    res.write("data: [DONE]\n\n");
    res.end();
  } catch (error) {
    console.error("AI扩写失败:", error);
    res.write("data: [DONE]\n\n");
    res.end();
  }
});

router.post("/ai-name", async (req: Request, res: Response) => {
  const { type, count, context } = req.body;
  const nameTypes: Record<string, string> = {
    "person": "人物名字", "place": "地名", "power": "势力名",
    "skill": "招式/技能名", "equip": "装备名", "monster": "怪物名", "item": "道具名",
  };
  const typeName = nameTypes[type as string] || "名字";
  const prompt = `为${context || "一部小说"}生成${count || 5}个${typeName}，每个名字附带简短解释。格式：名字 - 解释。`;
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  const client = new LLMClient();
  try {
    const stream = client.stream([{ role: "user" as const, content: prompt }]) as AsyncGenerator<{ content: string } & { delta?: string }, void, unknown>;
    for await (const chunk of stream) {
      if (chunk.content) res.write(`data: ${JSON.stringify({ content: chunk.content })}\n\n`);
    }
    res.write("data: [DONE]\n\n");
    res.end();
  } catch (error) {
    console.error("AI起名失败:", error);
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