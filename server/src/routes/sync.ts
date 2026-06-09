import { Router } from "express";
import { db } from "../storage/database/client.js";
import { books, outlines, userSettings, inspirations, chapters } from "../storage/database/shared/schema.js";
import { eq, and } from "drizzle-orm";

const router = Router();

/**
 * POST /api/v1/sync/upload
 * 免费用户升级 VIP 后，批量上传本地数据到云端
 * Body: { books: BookData[], outlines: OutlineData[], settings: SettingData[], inspirations: InspirationData[] }
 */
router.post("/upload", async (req, res) => {
  try {
    const userId = (req as any).userId;
    if (!userId) {
      return res.status(401).json({ error: "未登录" });
    }

    const { books: localBooks = [], outlines: localOutlines = [], settings: localSettings = [], inspirations: localInspirations = [] } = req.body;

    const results = { books: 0, outlines: 0, settings: 0, inspirations: 0, chapters: 0 };

    // 上传书籍
    for (const book of localBooks) {
      const { id, chapters: bookChapters, ...bookData } = book;
      // 检查是否已存在
      const existing = await db.select({ id: books.id }).from(books)
        .where(and(eq(books.userId, userId), eq(books.title, bookData.title)))
        .limit(1);

      if (existing.length === 0) {
        await db.insert(books).values({
          ...bookData,
          userId,
          volumes: bookData.volumes || [],
          wordCount: bookData.wordCount || 0,
          chapterCount: bookData.chapterCount || 0,
        });
        results.books++;

        // 上传该书籍的章节到 chapters 表
        if (bookChapters && Array.isArray(bookChapters)) {
          for (const ch of bookChapters) {
            await db.insert(chapters).values({
              bookId: bookData.id || id,
              title: ch.title || "",
              content: ch.content || "",
              chapterNumber: ch.chapterNumber || 0,
              wordCount: ch.wordCount || 0,
              status: ch.status || "draft",
            });
            results.chapters++;
          }
        }
      }
    }

    // 上传大纲
    for (const outline of localOutlines) {
      const { id, ...data } = outline;
      const existing = await db.select({ id: outlines.id }).from(outlines)
        .where(and(eq(outlines.userId, userId), eq(outlines.bookId, data.bookId)))
        .limit(1);

      if (existing.length === 0) {
        await db.insert(outlines).values({ ...data, userId });
        results.outlines++;
      }
    }

    // 上传设定
    for (const setting of localSettings) {
      const { id, ...data } = setting;
      const existing = await db.select({ id: userSettings.id }).from(userSettings)
        .where(eq(userSettings.bookId, data.bookId))
        .limit(1);

      if (existing.length === 0) {
        await db.insert(userSettings).values(data);
        results.settings++;
      }
    }

    // 上传灵感
    for (const insp of localInspirations) {
      const { id, ...data } = insp;
      const existing = await db.select({ id: inspirations.id }).from(inspirations)
        .where(eq(inspirations.bookId, data.bookId))
        .limit(1);

      if (existing.length === 0) {
        await db.insert(inspirations).values(data);
        results.inspirations++;
      }
    }

    return res.json({ success: true, results });
  } catch (error: any) {
    console.error("[sync/upload] error:", error);
    return res.status(500).json({ error: "同步失败", detail: error.message });
  }
});

/**
 * GET /api/v1/sync/status
 * 查询云端数据版本（用于冲突检测）
 * Query: bookId
 */
router.get("/status", async (req, res) => {
  try {
    const userId = (req as any).userId;
    if (!userId) {
      return res.status(401).json({ error: "未登录" });
    }

    const bookId = req.query.bookId as string;

    const cloudBooks = await db.select({
      id: books.id,
      title: books.title,
      updatedAt: books.updatedAt,
      chapterCount: books.chapterCount,
      wordCount: books.wordCount,
    }).from(books).where(eq(books.userId, userId));

    return res.json({
      success: true,
      bookCount: cloudBooks.length,
      books: cloudBooks,
    });
  } catch (error: any) {
    console.error("[sync/status] error:", error);
    return res.status(500).json({ error: "查询失败", detail: error.message });
  }
});

/**
 * POST /api/v1/sync/download
 * VIP 用户换设备后拉取云端全部数据
 * Body: { bookIds?: string[] } — 可选，不传则拉取全部
 */
router.post("/download", async (req, res) => {
  try {
    const userId = (req as any).userId;
    if (!userId) {
      return res.status(401).json({ error: "未登录" });
    }

    const { bookIds } = req.body;

    const whereClause = eq(books.userId, userId);

    const cloudBooks = await db.select().from(books).where(whereClause);

    // 拉取每本书的章节
    const booksWithChapters = await Promise.all(
      cloudBooks.map(async (book: typeof books.$inferSelect) => {
        const bookChapters = await db.select().from(chapters)
          .where(eq(chapters.bookId, book.id))
          .orderBy(chapters.chapterNumber);
        return { ...book, chapters: bookChapters };
      })
    );

    // 拉取大纲
    const cloudOutlines = await db.select().from(outlines)
      .where(eq(outlines.userId, userId));

    // 拉取设定
    const bookIdList = cloudBooks.map((b: typeof books.$inferSelect) => b.id);
    let cloudSettings: any[] = [];
    if (bookIdList.length > 0) {
      cloudSettings = await db.select().from(userSettings);
      // 过滤属于当前用户书籍的设定
      cloudSettings = cloudSettings.filter((s) => bookIdList.includes(s.bookId));
    }

    // 拉取灵感
    let cloudInspirations: any[] = [];
    if (bookIdList.length > 0) {
      cloudInspirations = await db.select().from(inspirations);
      cloudInspirations = cloudInspirations.filter((i) => bookIdList.includes(i.bookId));
    }

    return res.json({
      success: true,
      data: {
        books: booksWithChapters,
        outlines: cloudOutlines,
        settings: cloudSettings,
        inspirations: cloudInspirations,
      },
    });
  } catch (error: any) {
    console.error("[sync/download] error:", error);
    return res.status(500).json({ error: "下载失败", detail: error.message });
  }
});

export default router;
