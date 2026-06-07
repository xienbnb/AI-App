/**
 * 本地缓存服务
 * 离线时自动 fallback 到 AsyncStorage 缓存
 * 所有写操作：先写本地 → 再同步服务端
 * 所有读操作：先读服务端 → 失败时 fallback 到本地
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

const PREFIX = "cache_";
const TTL = 24 * 60 * 60 * 1000; // 24小时

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

function key(name: string): string {
  return `${PREFIX}${name}`;
}

async function set<T>(name: string, data: T, customTtl?: number): Promise<void> {
  const entry: CacheEntry<T> = {
    data,
    timestamp: Date.now(),
    ttl: customTtl ?? TTL,
  };
  await AsyncStorage.setItem(key(name), JSON.stringify(entry));
}

async function get<T>(name: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key(name));
    if (!raw) return null;
    const entry: CacheEntry<T> = JSON.parse(raw);
    if (Date.now() - entry.timestamp > entry.ttl) {
      await AsyncStorage.removeItem(key(name));
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

async function remove(name: string): Promise<void> {
  await AsyncStorage.removeItem(key(name));
}

// ===== 书籍缓存 =====
export async function cacheBook(bookId: string, data: any): Promise<void> {
  await set(`book_${bookId}`, data);
}
export async function getCachedBook(bookId: string): Promise<any | null> {
  return get(`book_${bookId}`);
}

// ===== 卷/章节缓存 =====
export async function cacheVolumes(bookId: string, volumes: any[]): Promise<void> {
  await set(`volumes_${bookId}`, volumes);
}
export async function getCachedVolumes(bookId: string): Promise<any[] | null> {
  return get(`volumes_${bookId}`);
}

// ===== 大纲缓存 =====
export async function cacheOutlines(bookId: string, items: any[]): Promise<void> {
  await set(`outlines_${bookId}`, items);
}
export async function getCachedOutlines(bookId: string): Promise<any[] | null> {
  return get(`outlines_${bookId}`);
}

// ===== 设定缓存 =====
export async function cacheSettings(bookId: string, data: any[]): Promise<void> {
  await set(`settings_${bookId}`, data);
}
export async function getCachedSettings(bookId: string): Promise<any[] | null> {
  return get(`settings_${bookId}`);
}

// ===== 章节内容缓存 =====
export async function cacheChapter(bookId: string, chapterId: string, data: any): Promise<void> {
  await set(`chapter_${bookId}_${chapterId}`, data);
}
export async function getCachedChapter(bookId: string, chapterId: string): Promise<any | null> {
  return get(`chapter_${bookId}_${chapterId}`);
}

// ===== 灵感缓存 =====
export async function cacheInspirations(bookId: string, data: any[]): Promise<void> {
  await set(`inspirations_${bookId}`, data);
}
export async function getCachedInspirations(bookId: string): Promise<any[] | null> {
  return get(`inspirations_${bookId}`);
}

// ===== 批量清理 =====
export async function clearBookCache(bookId: string): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  const bookKeys = keys.filter(k =>
    k.startsWith(`${PREFIX}book_${bookId}`) ||
    k.startsWith(`${PREFIX}volumes_${bookId}`) ||
    k.startsWith(`${PREFIX}outlines_${bookId}`) ||
    k.startsWith(`${PREFIX}settings_${bookId}`) ||
    k.startsWith(`${PREFIX}inspirations_${bookId}`) ||
    k.startsWith(`${PREFIX}chapter_${bookId}_`)
  );
  if (bookKeys.length > 0) {
    await AsyncStorage.multiRemove(bookKeys);
  }
}