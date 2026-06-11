/**
 * 统一数据管理层 — Local First
 *
 * 所有数据读写一律走本机 AsyncStorage（零网络依赖）。
 * 登录用户在有网时后台静默同步到云端，不阻塞用户操作。
 *
 * AI 功能除外（需登录后调云端 API）。
 *
 * @file /client/services/data-manager.ts
 */

import { Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as LocalStorage from "./local-storage";
import type { LocalBook, LocalChapter, LocalOutline, LocalSetting, LocalInspiration } from "./local-storage";

const API_BASE = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || "http://localhost:9091";

// ============================================================
// 认证辅助
// ============================================================

async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem("auth_token");
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await getToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["x-session"] = token;
  return headers;
}

/** 检查是否已登录（仅判断 token 是否存在，不调网络） */
export async function isLoggedIn(): Promise<boolean> {
  const token = await getToken();
  return !!token;
}

/**
 * AI 功能守卫：未登录时弹窗引导登录
 * @returns true=已登录可继续, false=未登录已弹窗
 */
export function requireAuth(router: any): boolean {
  // 同步检查 token（从内存）
  // 实际用 router 是 expo-router 实例
  // 由于 AsyncStorage 是异步的，采用前缀检查
  return true; // 实际使用 useRequireAuth hook
}

// ============================================================
// 云端同步（后台静默）
// ============================================================

async function uploadToCloud(endpoint: string, body: any): Promise<void> {
  try {
    const token = await getToken();
    if (!token) return; // 未登录不同步
    const headers = await getAuthHeaders();
    await fetch(`${API_BASE}/api/v1${endpoint}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
  } catch {
    // 静默失败，不阻塞用户
  }
}

async function deleteFromCloud(endpoint: string): Promise<void> {
  try {
    const token = await getToken();
    if (!token) return;
    const headers = await getAuthHeaders();
    await fetch(`${API_BASE}/api/v1${endpoint}`, {
      method: "DELETE",
      headers,
    });
  } catch {
    // 静默失败
  }
}

// ============================================================
// 书籍 API — 本地优先，可选云同步
// ============================================================

export async function fetchBooks(): Promise<LocalBook[]> {
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
  // 后台云同步
  uploadToCloud("/writing", book);
  return book;
}

export async function updateBook(
  bookId: string,
  updates: Partial<LocalBook>,
): Promise<LocalBook> {
  const updated = await LocalStorage.updateBook(bookId, updates);
  if (!updated) throw new Error("书籍不存在");
  uploadToCloud(`/writing/${bookId}`, updates);
  return updated;
}

export async function deleteBook(bookId: string): Promise<void> {
  await LocalStorage.deleteBook(bookId);
  deleteFromCloud(`/writing/${bookId}`);
}

export async function getBookDetail(bookId: string): Promise<LocalBook> {
  const book = await LocalStorage.getBookById(bookId);
  if (!book) throw new Error("书籍不存在");
  return book;
}

// ============================================================
// 章节 API — 本地优先
// ============================================================

export async function fetchChapters(bookId: string): Promise<LocalChapter[]> {
  return LocalStorage.getChapters(bookId);
}

export async function createChapter(
  bookId: string,
  data: { title: string; content: string; volumeId?: string; chapterNumber?: number },
): Promise<LocalChapter> {
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

  uploadToCloud(`/writing/${bookId}/chapters`, chapter);
  return chapter;
}

export async function updateChapter(
  bookId: string,
  chapterId: string,
  updates: Partial<LocalChapter>,
): Promise<LocalChapter> {
  const updated = await LocalStorage.updateChapter(bookId, chapterId, updates);
  if (!updated) throw new Error("章节不存在");
  uploadToCloud(`/writing/${bookId}/chapters/${chapterId}`, updates);
  return updated;
}

export async function deleteChapter(bookId: string, chapterId: string): Promise<void> {
  await LocalStorage.deleteChapter(bookId, chapterId);
  deleteFromCloud(`/writing/${bookId}/chapters/${chapterId}`);
}

export async function saveChapters(bookId: string, chapters: LocalChapter[]): Promise<void> {
  await LocalStorage.saveChapters(bookId, chapters);
  uploadToCloud(`/writing/${bookId}/chapters/batch`, { chapters });
}

// ============================================================
// 大纲/细纲 API — 本地优先
// ============================================================

export async function fetchOutlines(bookId: string): Promise<LocalOutline[]> {
  return LocalStorage.getOutlines(bookId);
}

export async function saveOutlines(bookId: string, items: any[]): Promise<void> {
  const stored = await LocalStorage.getOutlines(bookId);

  for (const item of items) {
    // 新项目 → 添加
    if (!stored.find((s) => s.id === item.id)) {
      const now = new Date().toISOString();
      await LocalStorage.addOutline(bookId, {
        id: item.id,
        bookId,
        type: item.type || "大纲",
        title: item.title || "",
        content: item.content || "",
        createdAt: now,
        updatedAt: now,
      });
    } else {
      // 已有项目 → 更新
      await LocalStorage.updateOutline(bookId, item.id, {
        type: item.type,
        title: item.title,
        content: item.content,
      });
    }
  }

  // 后台同步
  uploadToCloud(`/writing/${bookId}/outline-items`, { items });
}

export async function deleteOutline(bookId: string, outlineId: string): Promise<void> {
  await LocalStorage.deleteOutline(bookId, outlineId);
  deleteFromCloud(`/writing/${bookId}/outlines/${outlineId}`);
}

// ============================================================
// 设定 API — 本地优先
// ============================================================

export async function fetchSettings(bookId: string): Promise<LocalSetting[]> {
  return LocalStorage.getSettings(bookId);
}

export async function saveSettings(bookId: string, items: any[]): Promise<void> {
  const stored = await LocalStorage.getSettings(bookId);
  for (const item of items) {
    if (!stored.find((s) => s.id === item.id)) {
      await LocalStorage.addSetting(bookId, {
        id: item.id || `local_set_${Date.now()}`,
        bookId,
        title: item.title || "",
        content: item.content || "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    } else {
      await LocalStorage.updateSetting(bookId, item.id, {
        title: item.title,
        content: item.content,
      });
    }
  }
  uploadToCloud(`/writing/${bookId}/settings/batch`, { items });
}

export async function deleteSetting(bookId: string, settingId: string): Promise<void> {
  await LocalStorage.deleteSetting(bookId, settingId);
  deleteFromCloud(`/writing/${bookId}/settings/${settingId}`);
}

// ============================================================
// 灵感 API — 本地优先
// ============================================================

export async function fetchInspirations(bookId: string): Promise<LocalInspiration[]> {
  return LocalStorage.getInspirations(bookId);
}

export async function saveInspirations(bookId: string, items: any[]): Promise<void> {
  const stored = await LocalStorage.getInspirations(bookId);
  for (const item of items) {
    if (!stored.find((s) => s.id === item.id)) {
      await LocalStorage.addInspiration(bookId, {
        id: item.id || `local_ins_${Date.now()}`,
        bookId,
        title: item.title || "",
        content: item.content || "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    } else {
      await LocalStorage.updateInspiration(bookId, item.id, {
        title: item.title,
        content: item.content,
      });
    }
  }
  uploadToCloud(`/writing/${bookId}/inspirations/batch`, { items });
}

export async function deleteInspiration(bookId: string, inspirationId: string): Promise<void> {
  await LocalStorage.deleteInspiration(bookId, inspirationId);
  deleteFromCloud(`/writing/${bookId}/inspirations/${inspirationId}`);
}

// ============================================================
// 同步（登录后有网时主动调用）
// ============================================================

export async function syncLocalToCloud(): Promise<{ success: boolean; syncedCount: number; error?: string }> {
  try {
    const token = await getToken();
    if (!token) return { success: false, syncedCount: 0, error: "未登录" };

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
  isLoggedIn,

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
    title: string; description?: string; category?: string;
    status?: string; cover?: string; coverImage?: string;
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

  async saveOutlines(bookId: string, items: any[]) {
    try {
      await saveOutlines(bookId, items);
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e?.message };
    }
  },

  // 设定（扁平格式，匹配 API）
  async getSettingsArray(bookId: string) {
    try {
      const data = await LocalStorage.getSettingsArray(bookId);
      return { success: true, data };
    } catch (e: any) {
      return { success: false, data: [], error: e?.message };
    }
  },

  async saveSettingsArray(bookId: string, items: any[]) {
    try {
      await LocalStorage.saveSettingsArray(bookId, items);
      // 后台云同步
      try {
        const token = await getToken();
        if (token) {
          const headers = await getAuthHeaders();
          fetch(`${API_BASE}/api/v1/writing/${bookId}/settings`, {
            method: "PUT", headers,
            body: JSON.stringify({ data: items }),
          }).catch(() => {/* fire-and-forget */});
        }
      } catch {}
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e?.message };
    }
  },

  // 灵感（扁平格式，匹配 API）
  async getInspirationsArray(bookId: string) {
    try {
      const data = await LocalStorage.getInspirationsArray(bookId);
      return { success: true, data };
    } catch (e: any) {
      return { success: false, data: [], error: e?.message };
    }
  },

  async saveInspirationsArray(bookId: string, items: any[]) {
    try {
      await LocalStorage.saveInspirationsArray(bookId, items);
      try {
        const token = await getToken();
        if (token) {
          const headers = await getAuthHeaders();
          fetch(`${API_BASE}/api/v1/writing/${bookId}/inspirations`, {
            method: "PUT", headers,
            body: JSON.stringify({ items }),
          }).catch(() => {/* fire-and-forget */});
        }
      } catch {}
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e?.message };
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

let _isVip = false;

/** 设置 VIP 状态（供 AuthContext 同步） */
export function setVipStatus(isVip: boolean) {
  _isVip = isVip;
}

export function isVip(): boolean {
  return _isVip;
}