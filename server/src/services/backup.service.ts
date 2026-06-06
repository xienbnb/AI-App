import { db } from "../storage/database/client.js";
import {
  books,
  outlines,
  userSettings,
  inspirations,
  users,
} from "../storage/database/shared/schema.js";
import { eq, and } from "drizzle-orm";

export interface BackupData {
  version: string;
  exportedAt: string;
  user: {
    id: string;
    nickname: string;
    email: string;
    avatar?: string;
    bio?: string;
  };
  books: Array<{
    id: string;
    title: string;
    category: string;
    status: string;
    cover: string;
    coverImage?: string;
    description: string;
    outline?: string;
    outlineAnalysis?: string;
    outlineCharacters?: any;
    outlineWorldBuilding?: string;
    wordCount: number;
    chapterCount: number;
    createdAt: string;
    updatedAt: string;
    chapters: Array<{
      id: string;
      volumeId?: string;
      title: string;
      content: string;
      order: number;
      outline?: string;
      wordCount?: number;
      createdAt: string;
      updatedAt: string;
    }>;
    volumes: Array<{
      id: string;
      title: string;
      description?: string;
      order: number;
      createdAt: string;
      updatedAt: string;
    }>;
    outlines: Array<{
      id: string;
      content: string;
      createdAt: string;
      updatedAt: string;
    }>;
    settings: Array<{
      id: string;
      data: any;
      createdAt: string;
      updatedAt: string;
    }>;
    inspirations: Array<{
      id: string;
      data: any;
      createdAt: string;
      updatedAt: string;
    }>;
  }>;
}

/**
 * 导出用户所有数据
 */
export async function exportUserData(userId: string): Promise<BackupData> {
  // 获取用户信息
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) {
    throw new Error("用户不存在");
  }

  // 获取所有书籍
  const userBooks = await db.select().from(books)
    .where(eq(books.userId, userId))
    .orderBy(books.createdAt);

  // 获取每本书的详细数据
  const booksWithDetails = await Promise.all(
    userBooks.map(async (book) => {
      // 获取分卷
      const volumesData = book.volumes as any[] || [];
      const volumeIds = volumesData.map((v: any) => v.id);

      // 获取章节
      const chapters = volumeIds.length > 0
        ? [] // 章节数据存在 volumes JSON 里
        : [];

      // 获取大纲
      const bookOutlines = await db.select().from(outlines)
        .where(eq(outlines.bookId, book.id));

      // 获取设置
      const settings = await db.select().from(userSettings)
        .where(eq(userSettings.bookId, book.id));

      // 获取灵感
      const inspirationList = await db.select().from(inspirations)
        .where(eq(inspirations.bookId, book.id));

      return {
        id: book.id,
        title: book.title,
        category: book.category,
        status: book.status,
        cover: book.cover,
        coverImage: book.coverImage || undefined,
        description: book.description,
        outline: book.outline || undefined,
        outlineAnalysis: book.outlineAnalysis || undefined,
        outlineCharacters: book.outlineCharacters,
        outlineWorldBuilding: book.outlineWorldBuilding || undefined,
        volumes: book.volumes as any[] || [],
        wordCount: book.wordCount || 0,
        chapterCount: book.chapterCount || 0,
        createdAt: book.createdAt,
        updatedAt: book.updatedAt,
        chapters: chapters,
        volumesData: volumesData,
        outlines: bookOutlines.map(o => ({
          id: o.id,
          content: o.content,
          createdAt: o.createdAt,
          updatedAt: o.updatedAt,
        })),
        settings: settings.map(s => ({
          id: s.id,
          data: s.data,
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
        })),
        inspirations: inspirationList.map(i => ({
          id: i.id,
          data: i.data,
          createdAt: i.createdAt,
          updatedAt: i.updatedAt,
        })),
      };
    })
  );

  return {
    version: "1.0.0",
    exportedAt: new Date().toISOString(),
    user: {
      id: user.id,
      nickname: user.nickname,
      email: user.email,
      avatar: user.avatar || undefined,
      bio: user.bio || undefined,
    },
    books: booksWithDetails as any,
  };
}

/**
 * 导入用户数据（全量覆盖 or 增量合并）
 */
export async function importUserData(
  userId: string,
  data: BackupData,
  mode: 'merge' | 'replace' = 'merge'
): Promise<{ imported: number; skipped: number }> {
  let imported = 0;
  let skipped = 0;

  // 如果是替换模式，先删除所有现有书籍
  if (mode === 'replace') {
    await db.delete(books).where(eq(books.userId, userId));
  }

  // 导入每本书
  for (const book of data.books) {
    try {
      // 检查是否已存在（通过标题判断）
      const [existing] = await db.select().from(books)
        .where(and(eq(books.userId, userId), eq(books.title, book.title)))
        .limit(1);

      if (existing && mode === 'merge') {
        skipped++;
        continue;
      }

      // 创建书籍
      const [newBook] = await db.insert(books).values({
        userId,
        title: book.title,
        category: book.category || '',
        status: book.status || '草稿',
        cover: book.cover || 'default',
        coverImage: book.coverImage || null,
        description: book.description || '',
        outline: book.outline || null,
        outlineAnalysis: book.outlineAnalysis || null,
        outlineCharacters: book.outlineCharacters || [],
        outlineWorldBuilding: book.outlineWorldBuilding || null,
        volumes: book.volumes || [],
        wordCount: book.wordCount || 0,
        chapterCount: book.chapterCount || 0,
      }).returning();

      // 导入大纲
      if (book.outlines && book.outlines.length > 0) {
        for (const outline of book.outlines) {
          await db.insert(outlines).values({
            bookId: newBook.id,
            userId,
            content: outline.content,
          });
        }
      }

      // 导设置
      if (book.settings && book.settings.length > 0) {
        for (const setting of book.settings) {
          await db.insert(userSettings).values({
            bookId: newBook.id,
            data: setting.data,
          });
        }
      }

      // 导入灵感
      if (book.inspirations && book.inspirations.length > 0) {
        for (const inspiration of book.inspirations) {
          await db.insert(inspirations).values({
            bookId: newBook.id,
            data: inspiration.data,
          });
        }
      }

      imported++;
    } catch (err) {
      console.error(`Import book "${book.title}" failed:`, err);
      skipped++;
    }
  }

  return { imported, skipped };
}

/**
 * 导出单本书
 */
export async function exportBook(userId: string, bookId: string): Promise<any> {
  const [book] = await db.select().from(books)
    .where(and(eq(books.id, bookId), eq(books.userId, userId)))
    .limit(1);

  if (!book) {
    throw new Error("书籍不存在");
  }

  const [outlinesList, settingsList, inspirationsList] = await Promise.all([
    db.select().from(outlines).where(eq(outlines.bookId, bookId)),
    db.select().from(userSettings).where(eq(userSettings.bookId, bookId)),
    db.select().from(inspirations).where(eq(inspirations.bookId, bookId)),
  ]);

  return {
    version: "1.0.0",
    exportedAt: new Date().toISOString(),
    book: {
      id: book.id,
      title: book.title,
      category: book.category,
      status: book.status,
      cover: book.cover,
      coverImage: book.coverImage,
      description: book.description,
      outline: book.outline,
      outlineAnalysis: book.outlineAnalysis,
      outlineCharacters: book.outlineCharacters,
      outlineWorldBuilding: book.outlineWorldBuilding,
      volumes: book.volumes,
      wordCount: book.wordCount,
      chapterCount: book.chapterCount,
      createdAt: book.createdAt,
      updatedAt: book.updatedAt,
    },
    outlines: outlinesList,
    settings: settingsList,
    inspirations: inspirationsList,
  };
}
