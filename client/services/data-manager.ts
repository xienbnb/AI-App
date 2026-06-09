/**
 * 统一数据管理层
 *
 * 根据用户 VIP 状态自动路由数据读写目标：
 * - VIP 用户 → 云端 API（Supabase PostgreSQL）
 * - 免费用户 → 本地 AsyncStorage
 *
 * 对页面层完全透明，替换原有的直接 fetch 调用。
 *
 * @file /client/services/data-manager.ts
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as LocalStorage from "./local-storage";
import type { LocalBook, LocalChapter, LocalOutline, LocalSetting, LocalInspiration } from "./local-storage";

const API_BASE = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || "http://localhost:9091";

// ============================================================
// VIP 状态
// ============================================================

let _isVip = false;

export function setVipStatus(isVip: boolean): void {
  _isVip = isVip;
}

export function isVip(): boolean {
  return _isVip;
}

// ============================================================
// 认证辅助
// ============================================================

async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await AsyncStorage.getItem("auth_token");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["x-session"] = token;
  return headers;
}

// ============================================================
// 书籍 API
// ============================================================

export async function fetchBooks(): Promise<LocalBook[]> {
  if (_isVip) {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/v1/writing`, { headers });
    const json = await res.json();
    if (json.success) return json.data as LocalBook[];
    throw new Error(json.error || "获取书籍列表失败");
  }
  return LocalStorage.getBooks();
}

export async function createBook(data: {
  title: string;
  description?: string;
  category?: string;
  status?: string;
  cover?: string;
  coverImage?: string;
}): Promise<LocalBook> {
  if (_isVip) {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/v1/writing`, {
      method: "POST",
      headers,
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (json.success) return json.data as LocalBook;
    throw new Error(json.error || "创建书籍失败");
  }

  const now = new Date().toISOString();
  const book: LocalBook = {
    id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    title: data.title,
    category: data.category || "",
    status: data.status || "writing",
    cover: data.cover || "default",
    coverImage: data.coverImage,
    description: data.description || "",
    wordCount: 0,
    chapterCount: 0,
    volumes: [],
    createdAt: now,
    updatedAt: now,
  };
  await LocalStorage.addBook(book);
  return book;
}

export async function updateBook(
  bookId: string,
  updates: Partial<LocalBook>,
): Promise<LocalBook> {
  if (_isVip) {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/v1/writing/${bookId}`, {
      method: "PUT",
      headers,
      body: JSON.stringify(updates),
    });
    const json = await res.json();
    if (json.success) return json.data as LocalBook;
    throw new Error(json.error || "更新书籍失败");
  }

  const updated = await LocalStorage.updateBook(bookId, updates);
  if (!updated) throw new Error("书籍不存在");
  return updated;
}

export async function deleteBook(bookId: string): Promise<void> {
  if (_isVip) {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/v1/writing/${bookId}`, {
      method: "DELETE",
      headers,
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || "删除书籍失败");
    return;
  }
  await LocalStorage.deleteBook(bookId);
}

export async function getBookDetail(bookId: string): Promise<LocalBook> {
  if (_isVip) {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/v1/writing/${bookId}`, { headers });
    const json = await res.json();
    if (json.success) return json.data as LocalBook;
    throw new Error(json.error || "获取书籍详情失败");
  }

  const book = await LocalStorage.getBookById(bookId);
  if (!book) throw new Error("书籍不存在");
  return book;
}

// ============================================================
// 章节 API
// ============================================================

export async function fetchChapters(bookId: string): Promise<LocalChapter[]> {
  if (_isVip) {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/v1/writing/${bookId}/chapters`, { headers });
    const json = await res.json();
    if (json.success) return json.data as LocalChapter[];
    throw new Error(json.error || "获取章节列表失败");
  }
  return LocalStorage.getChapters(bookId);
}

export async function createChapter(
  bookId: string,
  data: { title: string; content: string; volumeId?: string; chapterNumber?: number },
): Promise<LocalChapter> {
  if (_isVip) {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/v1/writing/${bookId}/chapters`, {
      method: "POST",
      headers,
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (json.success) return json.data as LocalChapter;
    throw new Error(json.error || "创建章节失败");
  }

  const now = new Date().toISOString();
  const chapter: LocalChapter = {
    id: `local_ch_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    title: data.title,
    content: data.content,
    chapterNumber: data.chapterNumber || 1,
    status: "草稿",
    wordCount: data.content.length,
    createdAt: now,
    updatedAt: now,
  };
  await LocalStorage.addChapter(bookId, chapter);

  // 同步更新书籍的 volumes 和字数
  const book = await LocalStorage.getBookById(bookId);
  if (book) {
    const volumes = book.volumes || [];
    let targetVolume = data.volumeId
      ? volumes.find((v) => v.id === data.volumeId)
      : volumes[0];
    if (!targetVolume) {
      targetVolume = {
        id: `local_vol_${Date.now()}`,
        title: "第一卷",
        order: 1,
        chapters: [],
      };
      volumes.push(targetVolume);
    }
    targetVolume.chapters.push({
      id: chapter.id,
      title: chapter.title,
      content: chapter.content,
      chapterNumber: chapter.chapterNumber,
      status: chapter.status,
      wordCount: chapter.wordCount,
      createdAt: chapter.createdAt,
      updatedAt: chapter.updatedAt,
    });
    await LocalStorage.updateBook(bookId, {
      volumes,
      chapterCount: (book.chapterCount || 0) + 1,
      wordCount: (book.wordCount || 0) + chapter.wordCount,
    });
  }

  return chapter;
}

export async function updateChapter(
  bookId: string,
  chapterId: string,
  updates: Partial<LocalChapter>,
): Promise<LocalChapter> {
  if (_isVip) {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/v1/writing/${bookId}/chapters/${chapterId}`, {
      method: "PUT",
      headers,
      body: JSON.stringify(updates),
    });
    const json = await res.json();
    if (json.success) return json.data as LocalChapter;
    throw new Error(json.error || "更新章节失败");
  }

  const updated = await LocalStorage.updateChapter(bookId, chapterId, updates);
  if (!updated) throw new Error("章节不存在");
  return updated;
}

export async function deleteChapter(bookId: string, chapterId: string): Promise<void> {
  if (_isVip) {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/v1/writing/${bookId}/chapters/${chapterId}`, {
      method: "DELETE",
      headers,
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || "删除章节失败");
    return;
  }
  await LocalStorage.deleteChapter(bookId, chapterId);
}

// ============================================================
// 大纲 API
// ============================================================

export async function fetchOutlines(bookId: string): Promise<LocalOutline[]> {
  if (_isVip) {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/v1/writing/${bookId}/outlines`, { headers });
    const json = await res.json();
    if (json.success) return json.data as LocalOutline[];
    throw new Error(json.error || "获取大纲失败");
  }
  return LocalStorage.getOutlines(bookId);
}

export async function saveOutline(
  bookId: string,
  outline: { content: string },
): Promise<LocalOutline> {
  if (_isVip) {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/v1/writing/${bookId}/outlines`, {
      method: "POST",
      headers,
      body: JSON.stringify(outline),
    });
    const json = await res.json();
    if (json.success) return json.data as LocalOutline;
    throw new Error(json.error || "保存大纲失败");
  }

  const now = new Date().toISOString();
  const item: LocalOutline = {
    id: `local_out_${Date.now()}`,
    bookId,
    content: outline.content,
    createdAt: now,
    updatedAt: now,
  };
  await LocalStorage.addOutline(bookId, item);
  return item;
}

// ============================================================
// 设定 API
// ============================================================

export async function fetchSettings(bookId: string): Promise<LocalSetting[]> {
  if (_isVip) {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/v1/writing/${bookId}/settings`, { headers });
    const json = await res.json();
    if (json.success) return json.data as LocalSetting[];
    throw new Error(json.error || "获取设定失败");
  }
  return LocalStorage.getSettings(bookId);
}

// ============================================================
// 灵感 API
// ============================================================

export async function fetchInspirations(bookId: string): Promise<LocalInspiration[]> {
  if (_isVip) {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/v1/writing/${bookId}/inspirations`, { headers });
    const json = await res.json();
    if (json.success) return json.data as LocalInspiration[];
    throw new Error(json.error || "获取灵感失败");
  }
  return LocalStorage.getInspirations(bookId);
}

// ============================================================
// 同步（升级迁移）
// ============================================================

export async function syncLocalToCloud(): Promise<{ success: boolean; syncedCount: number; error?: string }> {
  try {
    const allData = await LocalStorage.getAllLocalData();
    if (allData.books.length === 0) {
      return { success: true, syncedCount: 0 };
    }

    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/v1/sync/upload`, {
      method: "POST",
      headers,
      body: JSON.stringify(allData),
    });
    const json = await res.json();
    if (json.success) {
      // 同步成功后清除本地数据（后续走云端）
      await LocalStorage.clearAllLocalData();
      return { success: true, syncedCount: json.syncedCount || allData.books.length };
    }
    return { success: false, syncedCount: 0, error: json.error || "同步失败" };
  } catch (e: any) {
    return { success: false, syncedCount: 0, error: e?.message || "网络异常" };
  }
}

export async function downloadCloudToLocal(): Promise<{ success: boolean; error?: string }> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/v1/sync/download`, { headers });
    const json = await res.json();
    if (json.success && json.data) {
      const { books } = json.data;
      if (books && books.length > 0) {
        await LocalStorage.saveBooks(books);
      }
      return { success: true };
    }
    return { success: false, error: json.error || "下载失败" };
  } catch (e: any) {
    return { success: false, error: e?.message || "网络异常" };
  }
}

// ============================================================
// DataManager 命名空间（页面层统一入口）
// ============================================================

export const DataManager = {
  setVipStatus,
  isVip,

  // 书籍
  async getBooks() {
    try {
      const data = await fetchBooks();
      return { success: true, data };
    } catch (e: any) {
      return { success: false, data: [], error: e?.message };
    }
  },

  async createBook(data: {
    title: string;
    description?: string;
    category?: string;
    status?: string;
    cover?: string;
    coverImage?: string;
  }) {
    try {
      const book = await createBook(data);
      return { success: true, data: book };
    } catch (e: any) {
      return { success: false, error: e?.message };
    }
  },

  async updateBook(bookId: string, updates: Partial<LocalBook>) {
    try {
      const book = await updateBook(bookId, updates);
      return { success: true, data: book };
    } catch (e: any) {
      return { success: false, error: e?.message };
    }
  },

  async deleteBook(bookId: string) {
    try {
      await deleteBook(bookId);
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e?.message };
    }
  },

  async getBookDetail(bookId: string) {
    try {
      const book = await getBookDetail(bookId);
      return { success: true, data: book };
    } catch (e: any) {
      return { success: false, error: e?.message };
    }
  },

  // AI 创建书籍
  async aiCreateBook(topic: string) {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/api/v1/writing/ai-generate`, {
        method: "POST",
        headers,
        body: JSON.stringify({ topic }),
      });
      const json = await res.json();
      return json;
    } catch (e: any) {
      return { success: false, error: e?.message };
    }
  },

  // 章节
  async getChapters(bookId: string) {
    try {
      const data = await fetchChapters(bookId);
      return { success: true, data };
    } catch (e: any) {
      return { success: false, data: [], error: e?.message };
    }
  },

  async createChapter(bookId: string, data: { title: string; content: string; volumeId?: string; chapterNumber?: number }) {
    try {
      const chapter = await createChapter(bookId, data);
      return { success: true, data: chapter };
    } catch (e: any) {
      return { success: false, error: e?.message };
    }
  },

  async updateChapter(bookId: string, chapterId: string, updates: Partial<LocalChapter>) {
    try {
      const chapter = await updateChapter(bookId, chapterId, updates);
      return { success: true, data: chapter };
    } catch (e: any) {
      return { success: false, error: e?.message };
    }
  },

  async deleteChapter(bookId: string, chapterId: string) {
    try {
      await deleteChapter(bookId, chapterId);
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e?.message };
    }
  },

  // 大纲
  async getOutlines(bookId: string) {
    try {
      const data = await fetchOutlines(bookId);
      return { success: true, data };
    } catch (e: any) {
      return { success: false, data: [], error: e?.message };
    }
  },

  async saveOutline(bookId: string, outline: { content: string }) {
    try {
      const item = await saveOutline(bookId, outline);
      return { success: true, data: item };
    } catch (e: any) {
      return { success: false, error: e?.message };
    }
  },

  // 设定
  async getSettings(bookId: string) {
    try {
      const data = await fetchSettings(bookId);
      return { success: true, data };
    } catch (e: any) {
      return { success: false, data: [], error: e?.message };
    }
  },

  // 灵感
  async getInspirations(bookId: string) {
    try {
      const data = await fetchInspirations(bookId);
      return { success: true, data };
    } catch (e: any) {
      return { success: false, data: [], error: e?.message };
    }
  },

  // 同步
  async syncToCloud() {
    try {
      const result = await syncLocalToCloud();
      return {
        success: result.success,
        results: { books: result.syncedCount, chapters: 0, outlines: 0, settings: 0, inspirations: 0 },
        error: result.error,
      };
    } catch (e: any) {
      return { success: false, error: e?.message };
    }
  },

  async downloadFromCloud() {
    return downloadCloudToLocal();
  },
};
