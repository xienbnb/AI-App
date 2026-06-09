import { Router, type Request, type Response } from "express";
import { createProvider } from "../utils/ai-provider.js";
import type { LLMConfig } from "coze-coding-dev-sdk";
import multer from "multer";
import { db } from "../storage/database/client.js";
import { inspirations, books, users } from "../storage/database/shared/schema.js";
import { eq, and, asc, desc, isNull, sql } from "drizzle-orm";
import { toCamelCase, toSnakeCaseTopLevel } from "../utils/case-transform.js";
import { quotaMiddleware } from "../middleware/quota.middleware.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const router = Router();

// --- Auth Helper ---
function getUserId(req: Request): string {
  if (!req.user) throw new Error("未登录");
  return req.user.id;
}

function countWords(text: string): number {
  if (!text) return 0;
  // 中文字数 + 英文单词数
  const chineseChars = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g) || []).length;
  const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;
  return chineseChars + englishWords;
}

// ============================================================
// Books CRUD (refactored to Drizzle ORM)
// ============================================================

// GET / - 获取作品列表
router.get("/", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const rows = await db
      .select()
      .from(books)
      .where(eq(books.userId, userId))
      .orderBy(desc(books.updatedAt))
      .limit(50);
    const data = rows.map(toCamelCase);
    res.json({ success: true, data });
  } catch (err: any) {
    console.error("获取作品列表错误:", err);
    res.status(500).json({ success: false, error: err.message || "服务器错误" });
  }
});

// POST / - 创建新作品
router.post("/", upload.single("cover"), async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { title, description, category, genres, author, tags, coverStyle } = req.body;

    if (!title || typeof title !== "string" || title.trim().length === 0) {
      res.status(400).json({ success: false, error: "作品名称不能为空" });
      return;
    }

    // 处理 tags
    let tagsArray: string[] = [];
    if (tags) {
      try {
        tagsArray = typeof tags === "string" ? JSON.parse(tags) : tags;
      } catch { tagsArray = []; }
    }

    // 处理 genres
    let genresArray: string[] = [];
    if (genres) {
      try {
        genresArray = typeof genres === "string" ? JSON.parse(genres) : genres;
      } catch { genresArray = []; }
    }

    let coverUrl: string | undefined;
    if (req.file) {
      coverUrl = `/uploads/${req.file.filename}`;
    }

    const [row] = await db.insert(books).values({
      userId,
      title: title.trim(),
      description: description || "",
      category: category || "其他",
      coverImage: coverUrl || "",
      status: "draft",
      volumes: [],
      wordCount: 0,
      chapterCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }).returning();

    res.json({ success: true, data: toCamelCase(row) });
  } catch (err: any) {
    console.error("创建作品错误:", err);
    res.status(500).json({ success: false, error: err.message || "服务器错误" });
  }
});

// GET /:id - 获取单个作品详情
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const [row] = await db
      .select()
      .from(books)
      .where(and(eq(books.id, req.params.id as string), eq(books.userId, userId)))
      .limit(1);
    if (!row) return res.status(404).json({ success: false, error: "未找到书籍" });
    res.json({ success: true, data: toCamelCase(row) });
  } catch (err: any) {
    console.error("获取作品详情错误:", err);
    res.status(500).json({ success: false, error: err.message || "服务器错误" });
  }
});

// PUT /:id - 更新作品
router.put("/:id", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const updateData: Record<string, any> = {};
    const allowedFields = ["title", "description", "category", "cover", "coverImage", "coverStyle", "author", "status", "volumes", "wordCount", "chapterCount", "outline"];
    for (const key of allowedFields) {
      if (req.body[key] !== undefined) updateData[key] = req.body[key];
    }
    // Handle genres/tags
    if (req.body.genres) {
      updateData.genres = typeof req.body.genres === "string" ? JSON.parse(req.body.genres) : req.body.genres;
    }
    if (req.body.tags) {
      updateData.tags = typeof req.body.tags === "string" ? JSON.parse(req.body.tags) : req.body.tags;
    }
    updateData.updatedAt = new Date().toISOString();

    const [row] = await db
      .update(books)
      .set(toSnakeCaseTopLevel(updateData))
      .where(and(eq(books.id, req.params.id as string), eq(books.userId, userId)))
      .returning();
    if (!row) return res.status(404).json({ success: false, error: "未找到书籍" });
    res.json({ success: true, data: toCamelCase(row) });
  } catch (err: any) {
    console.error("更新作品错误:", err);
    res.status(500).json({ success: false, error: err.message || "服务器错误" });
  }
});

// DELETE /:id - 删除作品
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const [row] = await db
      .delete(books)
      .where(and(eq(books.id, req.params.id as string), eq(books.userId, userId)))
      .returning({ id: books.id });
    if (!row) return res.status(404).json({ success: false, error: "未找到书籍" });
    res.json({ success: true });
  } catch (err: any) {
    console.error("删除作品错误:", err);
    res.status(500).json({ success: false, error: err.message || "服务器错误" });
  }
});

// ============================================================
// Volumes CRUD (using JSONB volumes field on books)
// ============================================================

// POST /:id/volumes - 创建卷
router.post("/:id/volumes", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const [book] = await db
      .select()
      .from(books)
      .where(and(eq(books.id, req.params.id as string), eq(books.userId, userId)))
      .limit(1);
    if (!book) return res.status(404).json({ success: false, error: "未找到书籍" });

    const volumes = book.volumes as any[] || [];
    const { title } = req.body;
    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return res.status(400).json({ success: false, error: "卷名称不能为空" });
    }
    const newVolume = {
      id: crypto.randomUUID(),
      title: title || `第${volumes.length + 1}卷`,
      order: volumes.length + 1,
      chapters: [],
    };
    volumes.push(newVolume);

    await db
      .update(books)
      .set({ volumes, updatedAt: new Date().toISOString() })
      .where(eq(books.id, req.params.id as string));

    res.json({ success: true, data: newVolume });
  } catch (err: any) {
    console.error("创建卷错误:", err);
    res.status(500).json({ success: false, error: err.message || "服务器错误" });
  }
});

// PUT /:id/volumes/:volumeId - 更新卷
router.put("/:id/volumes/:volumeId", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const [book] = await db
      .select()
      .from(books)
      .where(and(eq(books.id, req.params.id as string), eq(books.userId, userId)))
      .limit(1);
    if (!book) return res.status(404).json({ success: false, error: "未找到书籍" });

    const volumes = book.volumes as any[] || [];
    const volume = volumes.find((v: any) => v.id === req.params.volumeId);
    if (!volume) return res.status(404).json({ success: false, error: "未找到卷" });
    if (req.body.title !== undefined && (typeof req.body.title !== "string" || req.body.title.trim().length === 0)) {
      return res.status(400).json({ success: false, error: "卷名称不能为空" });
    }
    Object.assign(volume, req.body);

    await db
      .update(books)
      .set({ volumes, updatedAt: new Date().toISOString() })
      .where(eq(books.id, req.params.id as string));

    res.json({ success: true, data: toCamelCase(volume) });
  } catch (err: any) {
    console.error("更新卷错误:", err);
    res.status(500).json({ success: false, error: err.message || "服务器错误" });
  }
});

// DELETE /:id/volumes/:volumeId - 删除卷
router.delete("/:id/volumes/:volumeId", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const [book] = await db
      .select()
      .from(books)
      .where(and(eq(books.id, req.params.id as string), eq(books.userId, userId)))
      .limit(1);
    if (!book) return res.status(404).json({ success: false, error: "未找到书籍" });

    const volumes = book.volumes as any[] || [];
    const index = volumes.findIndex((v: any) => v.id === req.params.volumeId);
    if (index === -1) return res.status(404).json({ success: false, error: "未找到卷" });

    const deletedVolume = volumes[index];
    const deletedChapters = deletedVolume.chapters || [];
    let deletedWordCount = 0;
    for (const ch of deletedChapters) {
      deletedWordCount += ch.wordCount || 0;
    }

    volumes.splice(index, 1);

    const totalChapterCount = Math.max(0, (book.chapterCount || 0) - deletedChapters.length);
    const totalWordCount = Math.max(0, (book.wordCount || 0) - deletedWordCount);

    await db
      .update(books)
      .set({ volumes, chapterCount: totalChapterCount, wordCount: totalWordCount, updatedAt: new Date().toISOString() })
      .where(eq(books.id, req.params.id as string));

    res.json({ success: true });
  } catch (err: any) {
    console.error("删除卷错误:", err);
    res.status(500).json({ success: false, error: err.message || "服务器错误" });
  }
});

// ============================================================
// Chapters CRUD (sub-documents inside volumes JSONB)
// ============================================================

// POST /:id/volumes/:volumeId/chapters - 创建章节
router.post("/:id/volumes/:volumeId/chapters", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const [book] = await db
      .select()
      .from(books)
      .where(and(eq(books.id, req.params.id as string), eq(books.userId, userId)))
      .limit(1);
    if (!book) return res.status(404).json({ success: false, error: "未找到书籍" });

    const volumes = book.volumes as any[] || [];
    const volume = volumes.find((v: any) => v.id === req.params.volumeId);
    if (!volume) return res.status(404).json({ success: false, error: "未找到卷" });

    const { title } = req.body;
    const newChapter = {
      id: crypto.randomUUID(),
      title: title || `第${(volume.chapters?.length || 0) + 1}章`,
      wordCount: 0,
      createdAt: new Date().toISOString().split("T")[0],
      content: "",
      volumeId: volume.id,
    };
    volume.chapters = volume.chapters || [];
    volume.chapters.push(newChapter);

    const totalChapterCount = (book.chapterCount || 0) + 1;

    await db
      .update(books)
      .set({ volumes, chapterCount: totalChapterCount, updatedAt: new Date().toISOString() })
      .where(eq(books.id, req.params.id as string));

    res.json({ success: true, data: newChapter });
  } catch (err: any) {
    console.error("创建章节错误:", err);
    res.status(500).json({ success: false, error: err.message || "服务器错误" });
  }
});

// POST /:id/chapters - 创建章节（自动选择卷）
router.post("/:id/chapters", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const bookId = req.params.id as string;
    const { title, content, volumeId } = req.body;
    if (!title || !content) {
      res.status(400).json({ success: false, error: "缺少标题或内容" });
      return;
    }

    const [book] = await db
      .select()
      .from(books)
      .where(and(eq(books.id, bookId), eq(books.userId, userId)))
      .limit(1);
    if (!book) throw new Error("未找到书籍");

    let targetVolumeId = volumeId;
    const volumes = (book?.volumes || []) as any[];
    let chapterAdded = false;
    let newChapter: any = null;
    const wordCount = countWords(content);

    if (!targetVolumeId) {
      if (volumes.length > 0) {
        targetVolumeId = volumes[0].id;
      } else {
        targetVolumeId = crypto.randomUUID();
        newChapter = {
          id: crypto.randomUUID(),
          title,
          content,
          wordCount,
          order: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          volumeId: targetVolumeId,
        };
        volumes.push({ id: targetVolumeId, title: "第一卷", order: 0, chapters: [newChapter] });
        chapterAdded = true;
      }
    }

    if (!chapterAdded) {
      const targetVolume = volumes.find((v: any) => v.id === targetVolumeId);
      if (targetVolume) {
        newChapter = {
          id: crypto.randomUUID(),
          title,
          content,
          wordCount,
          order: (targetVolume.chapters?.length || 0),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          volumeId: targetVolumeId,
        };
        targetVolume.chapters = targetVolume.chapters || [];
        targetVolume.chapters.push(newChapter);
      } else {
        newChapter = {
          id: crypto.randomUUID(),
          title,
          content,
          wordCount,
          order: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          volumeId: targetVolumeId,
        };
        volumes.push({
          id: targetVolumeId,
          title: "默认卷",
          order: volumes.length,
          chapters: [newChapter],
        });
      }
    }

    const totalChapterCount = (book.chapterCount || 0) + 1;
    const totalWordCount = (book.wordCount || 0) + wordCount;

    await db
      .update(books)
      .set({ volumes, chapterCount: totalChapterCount, wordCount: totalWordCount, updatedAt: new Date().toISOString() })
      .where(eq(books.id, req.params.id as string));

    res.json({ success: true, message: "章节已创建", data: newChapter });
  } catch (err: any) {
    console.error("创建章节错误:", err);
    res.status(500).json({ success: false, error: err.message || "服务器错误" });
  }
});

// GET /:id/chapters/:chapterId - 获取单个章节内容
router.get("/:id/chapters/:chapterId", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const [book] = await db
      .select()
      .from(books)
      .where(and(eq(books.id, req.params.id as string), eq(books.userId, userId)))
      .limit(1);
    if (!book) return res.status(404).json({ success: false, error: "未找到书籍" });

    const volumes = book.volumes as any[] || [];
    let chapter: any;
    for (const v of volumes) {
      chapter = v.chapters?.find((c: any) => c.id === req.params.chapterId);
      if (chapter) break;
    }
    if (!chapter) return res.status(404).json({ success: false, error: "未找到章节" });

    res.json({ success: true, data: toCamelCase(chapter) });
  } catch (err: any) {
    console.error("获取章节错误:", err);
    res.status(500).json({ success: false, error: err.message || "服务器错误" });
  }
});

// PUT /:id/chapters/:chapterId - 更新章节
router.put("/:id/chapters/:chapterId", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const [book] = await db
      .select()
      .from(books)
      .where(and(eq(books.id, req.params.id as string), eq(books.userId, userId)))
      .limit(1);
    if (!book) return res.status(404).json({ success: false, error: "未找到书籍" });

    const volumes = book.volumes as any[] || [];
    let chapter: any;
    let oldWordCount = 0;
    for (const v of volumes) {
      chapter = v.chapters?.find((c: any) => c.id === req.params.chapterId);
      if (chapter) {
        oldWordCount = chapter.wordCount || 0;
        break;
      }
    }
    if (!chapter) return res.status(404).json({ success: false, error: "未找到章节" });

    const newContent = req.body.content;
    const newWordCount = newContent !== undefined ? countWords(newContent) : oldWordCount;
    const wordDiff = newWordCount - oldWordCount;

    Object.assign(chapter, req.body);
    chapter.wordCount = newWordCount;

    const totalWordCount = Math.max(0, (book.wordCount || 0) + wordDiff);

    await db
      .update(books)
      .set({ volumes, wordCount: totalWordCount, updatedAt: new Date().toISOString() })
      .where(eq(books.id, req.params.id as string));

    res.json({ success: true, data: chapter });
  } catch (err: any) {
    console.error("更新章节错误:", err);
    res.status(500).json({ success: false, error: err.message || "服务器错误" });
  }
});

// DELETE /:id/chapters/:chapterId - 删除章节
router.delete("/:id/chapters/:chapterId", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const [book] = await db
      .select()
      .from(books)
      .where(and(eq(books.id, req.params.id as string), eq(books.userId, userId)))
      .limit(1);
    if (!book) return res.status(404).json({ success: false, error: "未找到书籍" });

    const volumes = book.volumes as any[] || [];
    let deletedChapter: any;
    let oldWordCount = 0;
    for (const v of volumes) {
      const idx = v.chapters?.findIndex((c: any) => c.id === req.params.chapterId);
      if (idx !== undefined && idx >= 0) {
        deletedChapter = v.chapters[idx];
        oldWordCount = deletedChapter.wordCount || 0;
        v.chapters.splice(idx, 1);
        break;
      }
    }
    if (!deletedChapter) return res.status(404).json({ success: false, error: "未找到章节" });

    const totalChapterCount = Math.max(0, (book.chapterCount || 0) - 1);
    const totalWordCount = Math.max(0, (book.wordCount || 0) - oldWordCount);

    await db
      .update(books)
      .set({ volumes, chapterCount: totalChapterCount, wordCount: totalWordCount, updatedAt: new Date().toISOString() })
      .where(eq(books.id, req.params.id as string));

    res.json({ success: true });
  } catch (err: any) {
    console.error("删除章节错误:", err);
    res.status(500).json({ success: false, error: err.message || "服务器错误" });
  }
});

// ============================================================
// Inspirations CRUD (Drizzle ORM)
// ============================================================

// GET /inspirations - 获取灵感列表
router.get("/inspirations", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const rows = await db
      .select()
      .from(inspirations)
      .orderBy(desc(inspirations.createdAt))
      .limit(50);
    res.json({ success: true, data: rows.map(toCamelCase) });
  } catch (err: any) {
    console.error("获取灵感列表错误:", err);
    res.status(500).json({ success: false, error: err.message || "服务器错误" });
  }
});

// POST /inspirations - 创建灵感
router.post("/inspirations", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { title, content, category, tags } = req.body;
    if (!title || !content) {
      res.status(400).json({ success: false, error: "标题和内容不能为空" });
      return;
    }
    const [row] = await db.insert(inspirations).values({
      id: crypto.randomUUID(),
      bookId: "",
      data: JSON.stringify({ title, content, category: category || "通用", tags: tags || [] }),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }).returning();
    res.json({ success: true, data: toCamelCase(row) });
  } catch (err: any) {
    console.error("创建灵感错误:", err);
    res.status(500).json({ success: false, error: err.message || "服务器错误" });
  }
});

// PUT /inspirations/:id - 更新灵感
router.put("/inspirations/:id", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const updateData: Record<string, any> = {};
    const allowedFields = ["title", "content", "category", "tags"];
    for (const key of allowedFields) {
      if (req.body[key] !== undefined) updateData[key] = req.body[key];
    }
    updateData.updatedAt = new Date().toISOString();
    const [row] = await db
      .update(inspirations)
      .set(updateData)
      .where(and(eq(inspirations.id, req.params.id as string)))
      .returning();
    if (!row) return res.status(404).json({ success: false, error: "未找到灵感" });
    res.json({ success: true, data: toCamelCase(row) });
  } catch (err: any) {
    console.error("更新灵感错误:", err);
    res.status(500).json({ success: false, error: err.message || "服务器错误" });
  }
});

// DELETE /inspirations/:id - 删除灵感
router.delete("/inspirations/:id", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const [row] = await db
      .delete(inspirations)
      .where(and(eq(inspirations.id, req.params.id as string)))
      .returning({ id: inspirations.id });
    if (!row) return res.status(404).json({ success: false, error: "未找到灵感" });
    res.json({ success: true });
  } catch (err: any) {
    console.error("删除灵感错误:", err);
    res.status(500).json({ success: false, error: err.message || "服务器错误" });
  }
});

// ============================================================
// AI Writing Features
// ============================================================

// GET /models/available - 获取可用模型
router.get("/models/available", async (_req: Request, res: Response) => {
  try {
    const models = [
      { id: "glm-4-9b", name: "GLM-4.9B", provider: "coze" },
      { id: "deepseek-chat", name: "DeepSeek V3", provider: "coze" },
      { id: "gpt-4o", name: "GPT-4o", provider: "coze" },
    ];
    res.json({ success: true, data: models });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || "服务器错误" });
  }
});

// POST /:id/generate - AI 生成内容
router.post("/:id/generate", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const bookId = req.params.id as string;
    const { prompt, type, model } = req.body;

    const [book] = await db
      .select()
      .from(books)
      .where(and(eq(books.id, bookId), eq(books.userId, userId)))
      .limit(1);
    if (!book) return res.status(404).json({ success: false, error: "未找到书籍" });

    // Build the LLM prompt
    const systemPrompt = `你是一个专业的写作助手，正在帮助创作小说《${book.title}》。\n${book.outline ? `作品大纲：${book.outline}\n` : ""}\n请根据用户的要求生成内容。`;

    const provider = await createProvider(userId, model);
    const stream = provider.generateStream(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
      { model: model || "glm-4-9b" }
    );

    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    let fullContent = "";

    for await (const chunk of stream) {
      if (chunk.content) {
        fullContent += chunk.content;
        res.write(`data: ${JSON.stringify({ type: "text", content: chunk.content })}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({ type: "done", content: fullContent })}\n\n`);
    res.end();
  } catch (err: any) {
    console.error("AI 生成错误:", err);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: err.message || "服务器错误" });
    } else {
      res.write(`data: ${JSON.stringify({ type: "error", content: err.message })}\n\n`);
      res.end();
    }
  }
});

// ============================================================
// Outlines (stored as JSONB on books.outline field)
// ============================================================

// GET /:id/outline - 获取大纲
router.get("/:id/outline", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const [book] = await db
      .select({ outline: books.outline })
      .from(books)
      .where(and(eq(books.id, req.params.id as string), eq(books.userId, userId)))
    let outlineData: any = null;
    try {
      outlineData = book.outline ? JSON.parse(book.outline as string) : null;
    } catch {
      outlineData = book.outline;
    }

    res.json({ success: true, data: outlineData });
  } catch (err: any) {
    console.error("获取大纲错误:", err);
    res.status(500).json({ success: false, error: err.message || "服务器错误" });
  }
});

// PUT /:id/outline - 保存大纲
router.put("/:id/outline", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { content } = req.body;
    const contentStr = typeof content === "string" ? content : JSON.stringify(content);

    await db
      .update(books)
      .set({ outline: contentStr, updatedAt: new Date().toISOString() })
      .where(and(eq(books.id, req.params.id as string), eq(books.userId, userId)));

    const [updated] = await db
      .select({ outline: books.outline })
      .from(books)
      .where(eq(books.id, req.params.id as string))
      .limit(1);

    let outlineData;
    try {
      outlineData = updated?.outline ? JSON.parse(updated.outline as string) : null;
    } catch {
      outlineData = updated?.outline;
    }

    res.json({ success: true, data: outlineData });
  } catch (err: any) {
    console.error("保存大纲错误:", err);
    res.status(500).json({ success: false, error: err.message || "服务器错误" });
  }
});

// ============================================================
// User Profile (using Drizzle ORM)
// ============================================================

// GET /user/stats - 用户创作统计
router.get("/user/stats", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const bookRows = await db
      .select()
      .from(books)
      .where(eq(books.userId, userId));

    const totalBooks = bookRows.length;
    let totalChapters = 0;
    let totalWords = 0;
    for (const b of bookRows) {
      totalChapters += b.chapterCount || 0;
      totalWords += b.wordCount || 0;
    }

    res.json({
      success: true,
      data: { totalBooks, totalChapters, totalWords }
    });
  } catch (err: any) {
    console.error("获取用户统计错误:", err);
    res.status(500).json({ success: false, error: err.message || "服务器错误" });
  }
});

// GET /user/profile - 获取用户资料
router.get("/user/profile", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const [userRow] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!userRow) return res.status(404).json({ success: false, error: "用户不存在" });
    res.json({ success: true, data: toCamelCase(userRow) });
  } catch (err: any) {
    console.error("获取用户资料错误:", err);
    res.status(500).json({ success: false, error: err.message || "服务器错误" });
  }
});

// PUT /user/profile - 更新用户资料
router.put("/user/profile", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const allowedFields = ["nickname", "avatar"];
    const updateData: Record<string, any> = {};
    for (const key of allowedFields) {
      if (req.body[key] !== undefined) updateData[key] = req.body[key];
    }
    updateData.updatedAt = new Date().toISOString();

    const [row] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, userId))
      .returning();
    if (!row) return res.status(404).json({ success: false, error: "用户不存在" });
    res.json({ success: true, data: toCamelCase(row) });
  } catch (err: any) {
    console.error("更新用户资料错误:", err);
    res.status(500).json({ success: false, error: err.message || "服务器错误" });
  }
});

export default router;