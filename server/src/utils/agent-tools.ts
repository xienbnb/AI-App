import { db } from "../storage/database/client.js";
import { books, outlines, userSettings, chapters } from "../storage/database/shared/schema.js";
import { eq, desc, asc, sql } from "drizzle-orm";

// ============================================================
// Agent 工具函数
// ============================================================

export interface ToolResult {
  success: boolean;
  data: any;
  message: string;
}

// ============================================================
// 1. 创建书籍
// ============================================================
export async function createBook(
  userId: string,
  title: string,
  category: string = "其他",
  description: string = "",
): Promise<ToolResult> {
  try {
    const [book] = await db
      .insert(books)
      .values({
        userId,
        title,
        category,
        description,
        status: "草稿",
        cover: "default",
        outline: "",
      })
      .returning();

    return {
      success: true,
      data: { bookId: book.id, title: book.title },
      message: `书籍《${title}》创建成功！ID: ${book.id}`,
    };
  } catch (err: any) {
    return { success: false, data: null, message: `创建书籍失败: ${err.message}` };
  }
}

// ============================================================
// 2. 保存大纲（结构化 outline items → outlines 表）
//    匹配前端 detail 页面的 outline-items API 格式
//    items: [{ type: "大纲"|"细纲", title: string, content: string }]
// ============================================================
export async function saveOutline(
  bookId: string,
  items: Array<{ type: string; title: string; content: string }>,
): Promise<ToolResult> {
  try {
    const contentJson = JSON.stringify(items);
    const now = new Date().toISOString();

    const [existing] = await db
      .select({ id: outlines.id })
      .from(outlines)
      .where(eq(outlines.bookId, bookId as any))
      .limit(1);

    if (existing) {
      await db
        .update(outlines)
        .set({ content: contentJson, updatedAt: now })
        .where(eq(outlines.id, existing.id));
    } else {
      await db.insert(outlines).values({
        bookId: bookId as any,
        content: contentJson,
      });
    }

    // 同步更新 books.outline 字段（用于首页展示）
    const summary = items.map((i) => `[${i.type}] ${i.title}`).join("; ");
    await db
      .update(books)
      .set({ outline: summary, updatedAt: now })
      .where(eq(books.id, bookId as any));

    return { success: true, data: items, message: `大纲保存成功！共 ${items.length} 项` };
  } catch (err: any) {
    return { success: false, data: null, message: `保存大纲失败: ${err.message}` };
  }
}

// ============================================================
// 3. 获取书籍详细信息
// ============================================================
export async function getBookInfo(bookId: string): Promise<ToolResult> {
  try {
    const [book] = await db
      .select({
        id: books.id,
        title: books.title,
        category: books.category,
        description: books.description,
        status: books.status,
        chapterCount: books.chapterCount,
        wordCount: books.wordCount,
        volumes: books.volumes,
        outline: books.outline,
      })
      .from(books)
      .where(eq(books.id, bookId as any))
      .limit(1);

    if (!book) {
      return { success: false, data: null, message: "未找到该书籍" };
    }

    // 获取大纲
    const [outlineRow] = await db
      .select({ content: outlines.content })
      .from(outlines)
      .where(eq(outlines.bookId, bookId as any))
      .limit(1);
    let outlineItems: any[] = [];
    if (outlineRow?.content) {
      try { outlineItems = JSON.parse(outlineRow.content); } catch {}
    }

    // 获取设定（user_settings 表）
    const [settingsRow] = await db
      .select({ data: userSettings.data })
      .from(userSettings)
      .where(eq(userSettings.bookId, bookId as any))
      .limit(1);
    const worldSettings = (settingsRow?.data as any[]) || [];

    const chapters = (book.volumes as any[])?.reduce((sum: number, v: any) => sum + (v.chapters?.length || 0), 0) || 0;

    return {
      success: true,
      data: { ...book, outlineItems, worldSettings },
      message: `《${book.title}》- ${book.status} | 卷: ${(book.volumes as any[])?.length || 0} | 章节: ${chapters} | 字数: ${book.wordCount}`,
    };
  } catch (err: any) {
    return { success: false, data: null, message: `获取书籍信息失败: ${err.message}` };
  }
}

// ============================================================
// 4. 列出用户所有书籍
// ============================================================
export async function listBooks(userId: string): Promise<ToolResult> {
  try {
    const bookList = await db
      .select({
        id: books.id,
        title: books.title,
        category: books.category,
        status: books.status,
        chapters: books.chapterCount,
        wordCount: books.wordCount,
        updatedAt: books.updatedAt,
      })
      .from(books)
      .where(eq(books.userId, userId))
      .orderBy(desc(books.updatedAt))
      .limit(20);

    if (bookList.length === 0) {
      return { success: true, data: [], message: "你还没有创建任何书籍" };
    }

    return { success: true, data: bookList, message: `共 ${bookList.length} 本书` };
  } catch (err: any) {
    return { success: false, data: null, message: `获取书籍列表失败: ${err.message}` };
  }
}

// ============================================================
// 5. 创建卷
// ============================================================
export async function createVolume(bookId: string, title: string): Promise<ToolResult> {
  try {
    const [book] = await db
      .select({ volumes: books.volumes })
      .from(books)
      .where(eq(books.id, bookId as any))
      .limit(1);
    if (!book) return { success: false, data: null, message: "书籍不存在" };

    const volumes = (book.volumes as any[]) || [];
    const newVolume = { id: crypto.randomUUID(), title, sortOrder: volumes.length + 1, chapters: [] };
    volumes.push(newVolume);

    await db
      .update(books)
      .set({ volumes, updatedAt: new Date().toISOString() })
      .where(eq(books.id, bookId as any));

    return { success: true, data: newVolume, message: `卷《${title}》创建成功！` };
  } catch (err: any) {
    return { success: false, data: null, message: `创建卷失败: ${err.message}` };
  }
}

// ============================================================
// 6. 获取章节列表
// ============================================================
export async function getChapters(bookId: string): Promise<ToolResult> {
  try {
    const data = await db
      .select({
        id: chapters.id,
        title: chapters.title,
        chapterNumber: chapters.chapterNumber,
        volumeId: chapters.volumeId,
        wordCount: chapters.wordCount,
        status: chapters.status,
        createdAt: chapters.createdAt,
      })
      .from(chapters)
      .where(eq(chapters.bookId, bookId as any))
      .orderBy(asc(chapters.chapterNumber));

    if (data.length === 0) {
      return { success: true, data: [], message: "该书籍还没有章节" };
    }

    return { success: true, data, message: `共 ${data.length} 章` };
  } catch (err: any) {
    return { success: false, data: null, message: `获取章节列表失败: ${err.message}` };
  }
}

// ============================================================
// 7. 创建章节
// ============================================================
export async function createChapter(
  bookId: string,
  volumeId: string | null,
  title: string,
  content: string,
): Promise<ToolResult> {
  try {
    // 获取最大章节号
    const [maxRow] = await db
      .select({ maxNum: sql<number>`MAX(${chapters.chapterNumber})` })
      .from(chapters)
      .where(eq(chapters.bookId, bookId as any))
      .limit(1);

    const chapterNumber = (maxRow?.maxNum || 0) + 1;
    const now = new Date().toISOString();

    const [data] = await db
      .insert(chapters)
      .values({
        bookId: bookId as any,
        volumeId: volumeId as any,
        title,
        content,
        chapterNumber,
        status: "草稿",
        wordCount: content.length,
        createdAt: now,
        updatedAt: now,
      })
      .returning({
        id: chapters.id,
        title: chapters.title,
        chapterNumber: chapters.chapterNumber,
        wordCount: chapters.wordCount,
      });

    // 更新书籍字数 & 章节数
    await db
      .update(books)
      .set({
        chapterCount: sql`chapter_count + 1`,
        wordCount: sql`word_count + ${content.length}`,
        updatedAt: now,
      })
      .where(eq(books.id, bookId as any));

    // 同步更新 volumes JSON，使章节显示在书籍页面上
    if (volumeId) {
      const [book] = await db
        .select({ volumes: books.volumes })
        .from(books)
        .where(eq(books.id, bookId as any))
        .limit(1);

      if (book?.volumes && Array.isArray(book.volumes)) {
        const updatedVolumes = book.volumes.map((vol: any) => {
          if (vol.id === volumeId) {
            return {
              ...vol,
              chapters: [
                ...(vol.chapters || []),
                {
                  id: data.id,
                  title,
                  chapterNumber,
                  wordCount: content.length,
                  content,
                  createdAt: now,
                  updatedAt: now,
                },
              ],
            };
          }
          return vol;
        });

        await db
          .update(books)
          .set({ volumes: updatedVolumes as any })
          .where(eq(books.id, bookId as any));
      }
    }

    return {
      success: true,
      data,
      message: `第${chapterNumber}章《${title}》创建成功！${content.length}字`,
    };
  } catch (err: any) {
    return { success: false, data: null, message: `创建章节失败: ${err.message}` };
  }
}

// ============================================================
// 8. 读取章节内容
// ============================================================
export async function readChapter(chapterId: string): Promise<ToolResult> {
  try {
    const [chapter] = await db
      .select({
        id: chapters.id,
        title: chapters.title,
        content: chapters.content,
        chapterNumber: chapters.chapterNumber,
        bookId: chapters.bookId,
        status: chapters.status,
        wordCount: chapters.wordCount,
      })
      .from(chapters)
      .where(eq(chapters.id, chapterId))
      .limit(1);

    if (!chapter) return { success: false, data: null, message: "章节不存在" };

    return {
      success: true,
      data: chapter,
      message: `第${chapter.chapterNumber}章《${chapter.title}》(${chapter.wordCount}字)`,
    };
  } catch (err: any) {
    return { success: false, data: null, message: `读取章节失败: ${err.message}` };
  }
}

// ============================================================
// 9. 续写章节（读取章节当前内容，追加新内容）
// ============================================================
export async function continueChapter(
  chapterId: string,
  newContent: string,
): Promise<ToolResult> {
  try {
    // 读取当前章节
    const [chapter] = await db
      .select({
        id: chapters.id,
        title: chapters.title,
        content: chapters.content,
        bookId: chapters.bookId,
        wordCount: chapters.wordCount,
      })
      .from(chapters)
      .where(eq(chapters.id, chapterId as any))
      .limit(1);

    if (!chapter) {
      return { success: false, data: null, message: "章节不存在" };
    }

    const updatedContent = (chapter.content || "") + "\n\n" + newContent;
    const newWordCount = updatedContent.length;
    const now = new Date().toISOString();

    await db
      .update(chapters)
      .set({
        content: updatedContent,
        wordCount: newWordCount,
        updatedAt: now,
      })
      .where(eq(chapters.id, chapterId as any));

    return {
      success: true,
      data: { id: chapterId, wordCount: newWordCount },
      message: `续写完成，章节总字数 ${newWordCount} 字`,
    };
  } catch (err: any) {
    return { success: false, data: null, message: `续写章节失败: ${err.message}` };
  }
}

// ============================================================
// 10. 保存世界设定（角色/物品/金手指/世界背景 → user_settings 表）
//    匹配前端 detail 页面的 WorldSetting 格式
// ============================================================
export async function saveWorldSetting(
  bookId: string,
  items: Array<{
    type: string;      // "角色" | "物品" | "世界背景" | "金手指"
    name: string;
    description: string;
  }>,
): Promise<ToolResult> {
  try {
    if (items.length === 0) {
      return { success: false, data: null, message: "没有待保存的设定项" };
    }

    const now = new Date().toISOString();
    const newItems = items.map((item) => ({
      id: crypto.randomUUID(),
      type: item.type,
      name: item.name,
      description: item.description,
    }));

    // 读取已有设定，合并
    const [existing] = await db
      .select({ id: userSettings.id, data: userSettings.data })
      .from(userSettings)
      .where(eq(userSettings.bookId, bookId as any))
      .limit(1);

    let allItems: any[] = [];
    if (existing?.data && Array.isArray(existing.data)) {
      allItems = existing.data as any[];
    }
    allItems.push(...newItems);

    if (existing) {
      await db
        .update(userSettings)
        .set({ data: allItems as any, updatedAt: now })
        .where(eq(userSettings.id, existing.id));
    } else {
      await db.insert(userSettings).values({
        bookId: bookId as any,
        data: allItems as any,
      });
    }

    const typeCount = items.reduce((acc: Record<string, number>, i) => {
      acc[i.type] = (acc[i.type] || 0) + 1;
      return acc;
    }, {});
    const summary = Object.entries(typeCount)
      .map(([k, v]) => `${k}x${v}`)
      .join(", ");

    return { success: true, data: newItems, message: `设定保存成功！${summary}` };
  } catch (err: any) {
    return { success: false, data: null, message: `保存设定失败: ${err.message}` };
  }
}

// ============================================================
// 10. 更新书籍信息
// ============================================================
export async function updateBook(bookId: string, updates: Record<string, any>): Promise<ToolResult> {
  try {
    await db
      .update(books)
      .set({ ...updates, updatedAt: new Date().toISOString() })
      .where(eq(books.id, bookId as any));
    return { success: true, data: null, message: "书籍信息已更新" };
  } catch (err: any) {
    return { success: false, data: null, message: `更新书籍失败: ${err.message}` };
  }
}

// ============================================================
// 工具注册表
// ============================================================

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, any>;
  handler: (userId: string, args: Record<string, any>) => Promise<ToolResult>;
}

export const agentTools: ToolDefinition[] = [
  {
    name: "create_book",
    description: "创建一本新书。创建后必须继续创建卷和章节。",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "书名" },
        category: { type: "string", description: "分类: 玄幻/都市/历史/科幻/悬疑/言情/其他" },
        description: { type: "string", description: "书籍简介" },
      },
      required: ["title"],
    },
    handler: (userId, args) => createBook(userId, args.title, args.category, args.description),
  },
  {
    name: "list_books",
    description: "列出用户所有书籍。",
    parameters: { type: "object", properties: {}, required: [] },
    handler: (userId) => listBooks(userId),
  },
  {
    name: "get_book_info",
    description: "获取当前书籍完整信息（卷/大纲/角色/设定），挂载时第一步必须调用。",
    parameters: {
      type: "object",
      properties: { bookId: { type: "string", description: "书籍ID" } },
      required: ["bookId"],
    },
    handler: (_, args) => getBookInfo(args.bookId),
  },
  {
    name: "save_outline",
    description: "保存结构化大纲。items 是数组，每项包含 type (大纲或细纲), title, content。必须包含完整的章节规划。",
    parameters: {
      type: "object",
      properties: {
        bookId: { type: "string", description: "书籍ID" },
        items: {
          type: "array",
          description: "大纲项数组，每项: {type: 大纲|细纲, title: string, content: string}",
          items: {
            type: "object",
            properties: {
              type: { type: "string", description: "类型: 大纲 或 细纲" },
              title: { type: "string", description: "标题" },
              content: { type: "string", description: "详细内容" },
            },
          },
        },
      },
      required: ["bookId", "items"],
    },
    handler: (_, args) => saveOutline(args.bookId, args.items),
  },
  {
    name: "create_volume",
    description: "创建卷（部/册）。必须先创建卷，再在卷下创建章节。一般玄幻小说建议分3-5卷。",
    parameters: {
      type: "object",
      properties: {
        bookId: { type: "string", description: "书籍ID" },
        title: { type: "string", description: "卷名" },
      },
      required: ["bookId", "title"],
    },
    handler: (_, args) => createVolume(args.bookId, args.title),
  },
  {
    name: "get_chapters",
    description: "获取章节列表。",
    parameters: {
      type: "object",
      properties: { bookId: { type: "string", description: "书籍ID" } },
      required: ["bookId"],
    },
    handler: (_, args) => getChapters(args.bookId),
  },
  {
    name: "create_chapter",
    description: "创建新章节。必须先创建卷，然后在该卷下创建章节。正文需要包含完整的叙事内容。",
    parameters: {
      type: "object",
      properties: {
        bookId: { type: "string", description: "书籍ID" },
        volumeId: { type: "string", description: "所属卷ID（必填，先create_volume获取）" },
        title: { type: "string", description: "章节标题" },
        content: { type: "string", description: "章节正文，须完整写出该章节的全部内容" },
      },
      required: ["bookId", "volumeId", "title", "content"],
    },
    handler: (_, args) => createChapter(args.bookId, args.volumeId, args.title, args.content),
  },
  {
    name: "read_chapter",
    description: "读取章节完整内容，参数：chapterId",
    parameters: {
      type: "object",
      properties: { chapterId: { type: "string", description: "章节ID" } },
      required: ["chapterId"],
    },
    handler: (_, args) => readChapter(args.chapterId),
  },
  {
    name: "continue_chapter",
    description: "续写章节(在末尾追加内容)，参数：chapterId, newContent",
    parameters: {
      type: "object",
      properties: {
        chapterId: { type: "string", description: "章节ID" },
        newContent: { type: "string", description: "要追加的新章节内容" },
      },
      required: ["chapterId", "newContent"],
    },
    handler: (_, args) => continueChapter(args.chapterId, args.newContent),
  },
  {
    name: "save_world_setting",
    description: "保存世界设定(角色/物品/世界背景/金手指)，参数：bookId, items[{type, name, description}]",
    parameters: {
      type: "object",
      properties: {
        bookId: { type: "string", description: "书籍ID" },
        items: {
          type: "array",
          description: "设定项数组",
          items: {
            type: "object",
            properties: {
              type: { type: "string", description: "类型: 角色/物品/世界背景/金手指" },
              name: { type: "string", description: "名称" },
              description: { type: "string", description: "详细描述" },
            },
          },
        },
      },
      required: ["bookId", "items"],
    },
    handler: (_, args) => saveWorldSetting(args.bookId, args.items),
  },
  {
    name: "update_book",
    description: "更新书籍信息，参数：bookId, updates(对象)",
    parameters: {
      type: "object",
      properties: {
        bookId: { type: "string", description: "书籍ID" },
        updates: { type: "object", description: "要更新的字段" },
      },
      required: ["bookId", "updates"],
    },
    handler: (_, args) => updateBook(args.bookId, args.updates),
  },
];

// ============================================================
// 工具查找 & 系统提示
// ============================================================

export function findTool(name: string): ToolDefinition | undefined {
  return agentTools.find((t) => t.name === name);
}

export function getToolsSystemPrompt(): string {
  const descriptions = agentTools.map((t) => {
    const params = t.parameters.properties
      ? Object.entries(t.parameters.properties)
          .map(([k, v]: [string, any]) => `    - ${k} (${v.type}): ${v.description}`)
          .join("\n")
      : "    无参数";
    return `### ${t.name}\n描述: ${t.description}\n参数:\n${params}`;
  });

  return [
    "## 可用工具\n",
    "你可以使用以下工具来完成用户的创作需求。每次调用工具时，请在回复中输出以下格式：",
    "",
    '```json',
    '{"tool": "工具名", "args": {参数}}',
    '```',
    "",
    "工具执行结果会返回给你。继续分析结果，执行下一步，直到任务全部完成。",
    "",
    descriptions.join("\n\n"),
  ].join("\n");
}