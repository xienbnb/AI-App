import { db } from "../storage/database/client.js";
import { books, outlines } from "../storage/database/shared/schema.js";
import { eq, and, desc } from "drizzle-orm";

// ============================================================
// Agent 工具函数
// Agent 内部通过 LLM 决定调用哪些工具来完成用户请求
// 每个工具返回 { success: boolean, data: any, message: string }
// ============================================================

export interface ToolResult {
  success: boolean;
  data: any;
  message: string;
}

/**
 * 1. 创建书籍
 */
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
      message: `✅ 书籍《${title}》创建成功！ID: ${book.id}`,
    };
  } catch (err: any) {
    return { success: false, data: null, message: `❌ 创建书籍失败: ${err.message}` };
  }
}

/**
 * 2. 保存/更新大纲
 */
export async function saveOutline(bookId: string, content: string): Promise<ToolResult> {
  try {
    // 先检查是否已有大纲
    const [existing] = await db
      .select({ id: outlines.id })
      .from(outlines)
      .where(eq(outlines.bookId, bookId as any))
      .limit(1);

    if (existing) {
      await db
        .update(outlines)
        .set({ content, updatedAt: new Date().toISOString() })
        .where(eq(outlines.id, existing.id));
    } else {
      await db.insert(outlines).values({
        bookId: bookId as any,
        content,
      });
    }

    // 同时更新 books 表的 outline 字段
    await db
      .update(books)
      .set({ outline: content, updatedAt: new Date().toISOString() })
      .where(eq(books.id, bookId as any));

    return { success: true, data: null, message: `✅ 大纲保存成功！共 ${content.length} 字` };
  } catch (err: any) {
    return { success: false, data: null, message: `❌ 保存大纲失败: ${err.message}` };
  }
}

/**
 * 3. 获取书籍信息（含卷、章节）
 */
export async function getBookInfo(bookId: string): Promise<ToolResult> {
  try {
    const [book] = await db
      .select({
        id: books.id,
        title: books.title,
        category: books.category,
        description: books.description,
        status: books.status,
        outline: books.outline,
        chapters: books.chapterCount,
        wordCount: books.wordCount,
        volumes: books.volumes,
        outlineCharacters: books.outlineCharacters,
        outlineWorldBuilding: books.outlineWorldBuilding,
      })
      .from(books)
      .where(eq(books.id, bookId as any))
      .limit(1);

    if (!book) {
      return { success: false, data: null, message: "❌ 未找到该书籍" };
    }

    return {
      success: true,
      data: book,
      message: `📚 《${book.title}》 - ${book.status} | 章节: ${book.chapters} | 字数: ${book.wordCount}`,
    };
  } catch (err: any) {
    return { success: false, data: null, message: `❌ 获取书籍信息失败: ${err.message}` };
  }
}

/**
 * 4. 列出用户所有书籍
 */
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
      return { success: true, data: [], message: "📭 你还没有创建任何书籍" };
    }

    const summary = bookList
      .map((b) => `  - 《${b.title}》(${b.status}) ${b.chapters}章 ${b.wordCount}字`)
      .join("\n");

    return {
      success: true,
      data: bookList,
      message: `📚 你的书籍列表 (共${bookList.length}本):\n${summary}`,
    };
  } catch (err: any) {
    return { success: false, data: null, message: `❌ 获取书籍列表失败: ${err.message}` };
  }
}

/**
 * 5. 创建卷
 */
export async function createVolume(
  bookId: string,
  title: string,
): Promise<ToolResult> {
  try {
    const [book] = await db
      .select({ volumes: books.volumes })
      .from(books)
      .where(eq(books.id, bookId as any))
      .limit(1);

    if (!book) return { success: false, data: null, message: "❌ 书籍不存在" };

    const volumes = (book.volumes as any[]) || [];
    const newVolume = {
      id: crypto.randomUUID(),
      title,
      sortOrder: volumes.length + 1,
    };
    volumes.push(newVolume);

    await db
      .update(books)
      .set({ volumes, updatedAt: new Date().toISOString() })
      .where(eq(books.id, bookId as any));

    return {
      success: true,
      data: newVolume,
      message: `✅ 卷《${title}》创建成功！`,
    };
  } catch (err: any) {
    return { success: false, data: null, message: `❌ 创建卷失败: ${err.message}` };
  }
}

/**
 * 6. 获取章节列表
 */
export async function getChapters(bookId: string): Promise<ToolResult> {
  try {
    const supabaseClient = (await import("../storage/database/supabase-client.js")).getSupabaseClient;
    const sb = supabaseClient();
    const { data, error } = await sb
      .from("chapters")
      .select("id, title, chapter_number, volume_id, word_count, status, created_at")
      .eq("book_id", bookId)
      .order("chapter_number", { ascending: true });

    if (error) throw error;

    if (!data || data.length === 0) {
      return { success: true, data: [], message: "📭 该书籍还没有章节" };
    }

    const summary = (data as any[]).map((c) => `  - 第${c.chapter_number}章 ${c.title}`).join("\n");
    return {
      success: true,
      data,
      message: `📖 共 ${data.length} 章:\n${summary}`,
    };
  } catch (err: any) {
    return { success: false, data: null, message: `❌ 获取章节列表失败: ${err.message}` };
  }
}

/**
 * 7. 创建章节
 */
export async function createChapter(
  bookId: string,
  volumeId: string | null,
  title: string,
  content: string,
): Promise<ToolResult> {
  try {
    // 获取当前最大章节号
    const supabaseClient = (await import("../storage/database/supabase-client.js")).getSupabaseClient;
    const sb = supabaseClient();
    const { data: maxChapter } = await sb
      .from("chapters")
      .select("chapter_number")
      .eq("book_id", bookId)
      .order("chapter_number", { ascending: false })
      .limit(1);

    const chapterNumber = (maxChapter && maxChapter[0]?.chapter_number) ? maxChapter[0].chapter_number + 1 : 1;
    const now = new Date().toISOString();

    const { data, error } = await sb
      .from("chapters")
      .insert({
        book_id: bookId,
        volume_id: volumeId,
        title,
        content,
        chapter_number: chapterNumber,
        status: "草稿",
        word_count: content.length,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (error) throw error;

    // 更新书籍的章节数和字数
    await db
      .update(books)
      .set({
        chapterCount: (await import("drizzle-orm")).sql`chapter_count + 1`,
        wordCount: (await import("drizzle-orm")).sql`word_count + ${content.length}`,
        updatedAt: now,
      })
      .where(eq(books.id, bookId as any));

    return {
      success: true,
      data,
      message: `✅ 第${chapterNumber}章《${title}》创建成功！共 ${content.length} 字`,
    };
  } catch (err: any) {
    return { success: false, data: null, message: `❌ 创建章节失败: ${err.message}` };
  }
}

/**
 * 8. 读取章节内容
 */
export async function readChapter(chapterId: string): Promise<ToolResult> {
  try {
    const supabaseClient = (await import("../storage/database/supabase-client.js")).getSupabaseClient;
    const sb = supabaseClient();
    const { data, error } = await sb
      .from("chapters")
      .select("id, title, content, chapter_number, book_id, status, word_count")
      .eq("id", chapterId)
      .single();

    if (error) throw error;
    if (!data) return { success: false, data: null, message: "❌ 章节不存在" };

    return {
      success: true,
      data,
      message: `📖 第${data.chapter_number}章《${data.title}》(${data.word_count}字)`,
    };
  } catch (err: any) {
    return { success: false, data: null, message: `❌ 读取章节失败: ${err.message}` };
  }
}

/**
 * 9. 保存角色/人物设定
 */
export async function saveCharacter(
  bookId: string,
  name: string,
  description: string,
  traits: Record<string, any> = {},
): Promise<ToolResult> {
  try {
    const [book] = await db
      .select({ outlineCharacters: books.outlineCharacters })
      .from(books)
      .where(eq(books.id, bookId as any))
      .limit(1);

    if (!book) return { success: false, data: null, message: "❌ 书籍不存在" };

    const characters = (book.outlineCharacters as any[]) || [];
    const newChar = {
      id: crypto.randomUUID(),
      name,
      description,
      traits,
      createdAt: new Date().toISOString(),
    };
    characters.push(newChar);

    await db
      .update(books)
      .set({ outlineCharacters: characters as any, updatedAt: new Date().toISOString() })
      .where(eq(books.id, bookId as any));

    return {
      success: true,
      data: newChar,
      message: `✅ 角色「${name}」保存成功！`,
    };
  } catch (err: any) {
    return { success: false, data: null, message: `❌ 保存角色失败: ${err.message}` };
  }
}

/**
 * 10. 获取所有角色
 */
export async function getCharacters(bookId: string): Promise<ToolResult> {
  try {
    const [book] = await db
      .select({ outlineCharacters: books.outlineCharacters })
      .from(books)
      .where(eq(books.id, bookId as any))
      .limit(1);

    if (!book) return { success: false, data: null, message: "❌ 书籍不存在" };

    const characters = (book.outlineCharacters as any[]) || [];

    if (characters.length === 0) {
      return { success: true, data: [], message: "📭 还没有角色设定" };
    }

    const summary = characters.map((c: any) => `  - ${c.name}: ${c.description?.slice(0, 30)}...`).join("\n");
    return {
      success: true,
      data: characters,
      message: `👥 共 ${characters.length} 个角色:\n${summary}`,
    };
  } catch (err: any) {
    return { success: false, data: null, message: `❌ 获取角色列表失败: ${err.message}` };
  }
}

/**
 * 11. 更新书籍信息（状态、描述等）
 */
export async function updateBook(
  bookId: string,
  updates: Record<string, any>,
): Promise<ToolResult> {
  try {
    await db
      .update(books)
      .set({ ...updates, updatedAt: new Date().toISOString() })
      .where(eq(books.id, bookId as any));

    return { success: true, data: null, message: `✅ 书籍信息已更新` };
  } catch (err: any) {
    return { success: false, data: null, message: `❌ 更新书籍失败: ${err.message}` };
  }
}

/**
 * 12. 更新书籍大纲设定（世界观、主线分析等）
 */
export async function saveWorldBuilding(
  bookId: string,
  worldBuilding: string,
): Promise<ToolResult> {
  try {
    await db
      .update(books)
      .set({
        outlineWorldBuilding: worldBuilding,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(books.id, bookId as any));

    return { success: true, data: null, message: `✅ 世界观设定已保存！` };
  } catch (err: any) {
    return { success: false, data: null, message: `❌ 保存世界观失败: ${err.message}` };
  }
}

// ============================================================
// 工具注册表 — Agent 用这个表查找可用的工具
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
    description: "创建一本新书。调用此工具创建书籍后，应继续用其他工具完善大纲、角色等设定。",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "书名" },
        category: { type: "string", description: "分类（玄幻/都市/历史/科幻/悬疑/言情/其他）" },
        description: { type: "string", description: "书籍简介" },
      },
      required: ["title"],
    },
    handler: (userId, args) => createBook(userId, args.title, args.category, args.description),
  },
  {
    name: "list_books",
    description: "列出用户所有的书籍。用于了解用户有哪些作品。",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
    handler: (userId) => listBooks(userId),
  },
  {
    name: "get_book_info",
    description: "获取某本书的详细信息，包括状态、大纲、卷列表、角色等。",
    parameters: {
      type: "object",
      properties: {
        bookId: { type: "string", description: "书籍ID" },
      },
      required: ["bookId"],
    },
    handler: (_, args) => getBookInfo(args.bookId),
  },
  {
    name: "save_outline",
    description: "保存或更新书籍的大纲内容。大纲应包括章节规划、主线剧情等。",
    parameters: {
      type: "object",
      properties: {
        bookId: { type: "string", description: "书籍ID" },
        content: { type: "string", description: "大纲内容，建议包含分卷/分章规划" },
      },
      required: ["bookId", "content"],
    },
    handler: (_, args) => saveOutline(args.bookId, args.content),
  },
  {
    name: "create_volume",
    description: "在书籍中创建新的卷（部/册）。",
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
    description: "获取某本书的章节列表。",
    parameters: {
      type: "object",
      properties: {
        bookId: { type: "string", description: "书籍ID" },
      },
      required: ["bookId"],
    },
    handler: (_, args) => getChapters(args.bookId),
  },
  {
    name: "create_chapter",
    description: "创建新章节，需指定所属书籍、所属卷（可选）、标题和正文内容。正文内容应当完整。",
    parameters: {
      type: "object",
      properties: {
        bookId: { type: "string", description: "书籍ID" },
        volumeId: { type: "string", description: "所属卷ID（可选）" },
        title: { type: "string", description: "章节标题" },
        content: { type: "string", description: "章节正文" },
      },
      required: ["bookId", "title", "content"],
    },
    handler: (_, args) => createChapter(args.bookId, args.volumeId || null, args.title, args.content),
  },
  {
    name: "read_chapter",
    description: "读取某章节的完整内容。用于了解已写的内容以续写或修改。",
    parameters: {
      type: "object",
      properties: {
        chapterId: { type: "string", description: "章节ID" },
      },
      required: ["chapterId"],
    },
    handler: (_, args) => readChapter(args.chapterId),
  },
  {
    name: "save_character",
    description: "创建或保存角色设定。用于记录角色名称、外形、性格、背景等信息。",
    parameters: {
      type: "object",
      properties: {
        bookId: { type: "string", description: "书籍ID" },
        name: { type: "string", description: "角色名" },
        description: { type: "string", description: "角色描述（外形、性格等）" },
        traits: { type: "object", description: "角色属性（如年龄、职业、能力等）" },
      },
      required: ["bookId", "name", "description"],
    },
    handler: (_, args) => saveCharacter(args.bookId, args.name, args.description, args.traits || {}),
  },
  {
    name: "get_characters",
    description: "获取某本书的所有角色设定。",
    parameters: {
      type: "object",
      properties: {
        bookId: { type: "string", description: "书籍ID" },
      },
      required: ["bookId"],
    },
    handler: (_, args) => getCharacters(args.bookId),
  },
  {
    name: "save_world_building",
    description: "保存世界观设定，包括世界背景、势力、地理等。",
    parameters: {
      type: "object",
      properties: {
        bookId: { type: "string", description: "书籍ID" },
        worldBuilding: { type: "string", description: "世界观设定内容" },
      },
      required: ["bookId", "worldBuilding"],
    },
    handler: (_, args) => saveWorldBuilding(args.bookId, args.worldBuilding),
  },
  {
    name: "update_book",
    description: "更新书籍信息，如状态、描述等。",
    parameters: {
      type: "object",
      properties: {
        bookId: { type: "string", description: "书籍ID" },
        updates: { type: "object", description: "要更新的字段（如 status, description）" },
      },
      required: ["bookId", "updates"],
    },
    handler: (_, args) => updateBook(args.bookId, args.updates),
  },
];

/**
 * 根据名称查找工具
 */
export function findTool(name: string): ToolDefinition | undefined {
  return agentTools.find((t) => t.name === name);
}

/**
 * 生成工具描述文本（给 LLM 的系统提示用）
 */
export function getToolsSystemPrompt(): string {
  const descriptions = agentTools.map((t) => {
    const params = t.parameters.properties
      ? Object.entries(t.parameters.properties)
          .map(([k, v]: [string, any]) => `    - ${k} (${v.type}): ${v.description}`)
          .join("\n")
      : "    无参数";
    return `### ${t.name}\n描述: ${t.description}\n参数:\n${params}`;
  });

  return `## 可用工具\n\n你可以使用以下工具来完成用户的创作需求。每次调用工具时，请返回一个 JSON 格式的工具调用指令:\n\n\`\`\`json\n{"tool": "工具名", "args": {参数}}\n\`\`\`\n\n工具执行结果会返回给你，请根据结果继续操作或给用户回复。\n\n${descriptions.join("\n\n")}`;
}