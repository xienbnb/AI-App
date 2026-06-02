import { Router, type Request, type Response } from "express";
import { LLMClient, Config, HeaderUtils } from "coze-coding-dev-sdk";
import "dotenv/config";

const router = Router();

// ==================== 内存数据存储 ====================
const books: Book[] = [
  {
    id: "1",
    title: "超神：我以DNF镇诸神",
    category: "玄幻",
    status: "writing",
    cover: "from-purple-500 to-blue-500",
    coverImage: "/static/images/covers/man/1.jpg",
    description:
      "谢峰，一个普通的996社畜，意外穿越到超神学院的世界，获得了阿拉德系统...",
    createdAt: "2026-05-01",
    wordCount: 128000,
    chapters: [
      {
        id: "101",
        title: "第一章 穿越",
        wordCount: 2100,
        createdAt: "2026-05-01",
        content:
          "谢峰站在巨峡市的街头，看着天空中突然出现的虫洞，眼神变得凝重。这一天，终于还是来了...",
      },
      {
        id: "102",
        title: "第二章 阿拉德系统",
        wordCount: 2050,
        createdAt: "2026-05-02",
        content:
          "【叮！检测到宿主穿越成功，阿拉德系统正在激活...】",
      },
      {
        id: "103",
        title: "第三章 初次试炼",
        wordCount: 1980,
        createdAt: "2026-05-03",
        content:
          "系统提示音落下，谢峰的眼前出现了一个虚拟面板。",
      },
    ],
  },
  {
    id: "2",
    title: "凡人修仙传同人",
    category: "仙侠",
    status: "writing",
    cover: "from-green-500 to-teal-500",
    coverImage: "/static/images/covers/man/3.jpg",
    description: "一个普通山村少年的修仙之路...",
    createdAt: "2026-05-10",
    wordCount: 85000,
    chapters: [
      {
        id: "201",
        title: "第一章 山村少年",
        wordCount: 2200,
        createdAt: "2026-05-10",
        content: "青牛镇，一个位于越国边境的普通小镇。",
      },
    ],
  },
];

interface Chapter {
  id: string;
  title: string;
  wordCount: number;
  createdAt: string;
  content: string;
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
  chapters: Chapter[];
}

// ==================== 工具函数 ====================
const generateId = (): string => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

// ==================== 书籍 API ====================
// 获取书籍列表
router.get("/", (_req: Request, res: Response) => {
  res.json({ success: true, data: books });
});

// 获取单本书籍
router.get("/:id", (req: Request, res: Response) => {
  const book = books.find((b) => b.id === req.params.id);
  if (!book) {
    res.status(404).json({ success: false, message: "书籍未找到" });
    return;
  }
  res.json({ success: true, data: book });
});

// 创建书籍
router.post("/", (req: Request, res: Response) => {
  const { title, category, cover, coverImage, description } = req.body;
  if (!title) {
    res.status(400).json({ success: false, message: "请输入书名" });
    return;
  }
  const newBook: Book = {
    id: generateId(),
    title,
    category: category || "玄幻",
    status: "writing",
    cover: cover || "from-purple-500 to-blue-500",
    coverImage: coverImage || undefined,
    description: description || "暂无简介",
    createdAt: new Date().toISOString().split("T")[0],
    wordCount: 0,
    chapters: [],
  };
  books.unshift(newBook);
  res.json({ success: true, data: newBook });
});

// 更新书籍
router.put("/:id", (req: Request, res: Response) => {
  const book = books.find((b) => b.id === req.params.id);
  if (!book) {
    res.status(404).json({ success: false, message: "书籍未找到" });
    return;
  }
  const { title, category, status, cover, coverImage, description } = req.body;
  if (title) book.title = title;
  if (category) book.category = category;
  if (status) book.status = status;
  if (cover) book.cover = cover;
  if (coverImage !== undefined) book.coverImage = coverImage;
  if (description !== undefined) book.description = description;
  res.json({ success: true, data: book });
});

// 删除书籍
router.delete("/:id", (req: Request, res: Response) => {
  const index = books.findIndex((b) => b.id === req.params.id);
  if (index === -1) {
    res.status(404).json({ success: false, message: "书籍未找到" });
    return;
  }
  books.splice(index, 1);
  res.json({ success: true, message: "删除成功" });
});

// ==================== 章节 API ====================
// 获取某本书的章节列表
router.get("/:id/chapters", (req: Request, res: Response) => {
  const book = books.find((b) => b.id === req.params.id);
  if (!book) {
    res.status(404).json({ success: false, message: "书籍未找到" });
    return;
  }
  res.json({ success: true, data: book.chapters });
});

// 获取单个章节
router.get("/:id/chapters/:chapterId", (req: Request, res: Response) => {
  const book = books.find((b) => b.id === req.params.id);
  if (!book) {
    res.status(404).json({ success: false, message: "书籍未找到" });
    return;
  }
  const chapter = book.chapters.find((c) => c.id === req.params.chapterId);
  if (!chapter) {
    res.status(404).json({ success: false, message: "章节未找到" });
    return;
  }
  res.json({ success: true, data: chapter });
});

// 创建章节
router.post("/:id/chapters", (req: Request, res: Response) => {
  const book = books.find((b) => b.id === req.params.id);
  if (!book) {
    res.status(404).json({ success: false, message: "书籍未找到" });
    return;
  }
  const { title, content } = req.body;
  if (!title) {
    res.status(400).json({ success: false, message: "请输入章节标题" });
    return;
  }
  const newChapter: Chapter = {
    id: generateId(),
    title,
    wordCount: content ? content.replace(/\s/g, "").length : 0,
    createdAt: new Date().toISOString().split("T")[0],
    content: content || "",
  };
  book.chapters.push(newChapter);
  book.wordCount = book.chapters.reduce((sum, c) => sum + c.wordCount, 0);
  res.json({ success: true, data: newChapter });
});

// 更新章节
router.put("/:id/chapters/:chapterId", (req: Request, res: Response) => {
  const book = books.find((b) => b.id === req.params.id);
  if (!book) {
    res.status(404).json({ success: false, message: "书籍未找到" });
    return;
  }
  const chapter = book.chapters.find((c) => c.id === req.params.chapterId);
  if (!chapter) {
    res.status(404).json({ success: false, message: "章节未找到" });
    return;
  }
  const { title, content } = req.body;
  if (title) chapter.title = title;
  if (content !== undefined) {
    chapter.content = content;
    chapter.wordCount = content.replace(/\s/g, "").length;
  }
  book.wordCount = book.chapters.reduce((sum, c) => sum + c.wordCount, 0);
  res.json({ success: true, data: chapter });
});

// 删除章节
router.delete("/:id/chapters/:chapterId", (req: Request, res: Response) => {
  const book = books.find((b) => b.id === req.params.id);
  if (!book) {
    res.status(404).json({ success: false, message: "书籍未找到" });
    return;
  }
  const index = book.chapters.findIndex((c) => c.id === req.params.chapterId);
  if (index === -1) {
    res.status(404).json({ success: false, message: "章节未找到" });
    return;
  }
  book.chapters.splice(index, 1);
  book.wordCount = book.chapters.reduce((sum, c) => sum + c.wordCount, 0);
  res.json({ success: true, message: "章节已删除" });
});

// ==================== AI 写作生成 ====================
const config = new Config();
const client = new LLMClient(config);

router.post("/generate", async (req: Request, res: Response) => {
  try {
    const { prompt, style = "default", wordCount = 500, context = "" } = req.body;
    if (!prompt) {
      res.status(400).json({ success: false, message: "请输入写作主题" });
      return;
    }

    const styleMap: Record<string, string> = {
      default: "平实流畅的叙述风格",
      formal: "正式严谨的文风",
      casual: "轻松活泼的口语化风格",
      literary: "优美富有文采的文学风格",
      professional: "专业技术的说明风格",
    };

    const styleDesc = styleMap[style] || styleMap.default;

    const systemPrompt = `你是一位专业的网络文学作家，擅长各种类型的创作。
请按照以下要求进行创作：
1. 写作风格：${styleDesc}
2. 篇幅要求：约${wordCount}字
3. 如果需要标题，用 ## 包裹标题
4. 输出流畅、吸引人的内容`;

    const userPrompt = context ? `背景上下文：${context}\n\n请根据以上背景，继续创作：${prompt}` : prompt;

    // SSE 流式输出
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-store, no-transform, must-revalidate");
    res.setHeader("Connection", "keep-alive");

    const messages = [
      { role: "system" as const, content: systemPrompt },
      { role: "user" as const, content: userPrompt },
    ];

    const stream = client.stream(messages, {
      model: "doubao-seed-2-0-lite-260215",
      temperature: 0.8,
    });

    let fullContent = "";

    for await (const chunk of stream) {
      if (chunk.content) {
        const text = chunk.content.toString();
        fullContent += text;
        res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({ done: true, fullContent })}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
  } catch (error) {
    console.error("AI生成失败:", error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: "AI生成失败" });
    } else {
      res.write(`data: ${JSON.stringify({ error: "AI生成失败" })}\n\n`);
      res.write("data: [DONE]\n\n");
      res.end();
    }
  }
});

export default router;