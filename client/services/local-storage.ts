/**
 * 本地持久化存储引擎
 *
 * 免费用户的主存储，VIP 用户的离线缓存。
 * 基于 AsyncStorage，无 TTL 过期，数据持久保留直到用户主动清理。
 *
 * @file /client/services/local-storage.ts
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

// ============================================================
// Key 前缀设计
// ============================================================

const PREFIX = "local_";

// ============================================================
// 基础 CRUD
// ============================================================

async function setItem<T>(key: string, data: T): Promise<void> {
  await AsyncStorage.setItem(`${PREFIX}${key}`, JSON.stringify(data));
}

async function getItem<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(`${PREFIX}${key}`);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function removeItem(key: string): Promise<void> {
  await AsyncStorage.removeItem(`${PREFIX}${key}`);
}

async function removeByPrefix(prefix: string): Promise<void> {
  const allKeys = await AsyncStorage.getAllKeys();
  const matched = allKeys.filter((k) => k.startsWith(`${PREFIX}${prefix}`));
  if (matched.length > 0) {
    await AsyncStorage.multiRemove(matched);
  }
}

// ============================================================
// 书籍列表
// ============================================================

export interface LocalBook {
  id: string;
  title: string;
  category: string;
  status: string;
  cover: string;
  coverImage?: string;
  description: string;
  author?: string;
  genres?: string[];
  tags?: string[];
  outline?: string;
  outlineAnalysis?: string;
  outlineCharacters?: any[];
  outlineWorldBuilding?: string;
  wordCount: number;
  chapterCount: number;
  volumes: LocalVolume[];
  createdAt: string;
  updatedAt: string;
}

export interface LocalVolume {
  id: string;
  title: string;
  order: number;
  chapters: LocalChapter[];
}

export interface LocalChapter {
  id: string;
  title: string;
  content: string;
  chapterNumber: number;
  status: string;
  wordCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface LocalOutline {
  id: string;
  bookId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface LocalSetting {
  id: string;
  bookId: string;
  data: any[];
  createdAt: string;
  updatedAt: string;
}

export interface LocalInspiration {
  id: string;
  bookId: string;
  data: any[];
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// 书籍 CRUD
// ============================================================

const BOOKS_KEY = "books";

export async function saveBooks(books: LocalBook[]): Promise<void> {
  await setItem(BOOKS_KEY, books);
}

export async function getBooks(): Promise<LocalBook[]> {
  return (await getItem<LocalBook[]>(BOOKS_KEY)) || [];
}

export async function addBook(book: LocalBook): Promise<void> {
  const books = await getBooks();
  books.unshift(book);
  await saveBooks(books);
}

export async function updateBook(bookId: string, updates: Partial<LocalBook>): Promise<LocalBook | null> {
  const books = await getBooks();
  const idx = books.findIndex((b) => b.id === bookId);
  if (idx === -1) return null;
  books[idx] = { ...books[idx], ...updates, updatedAt: new Date().toISOString() };
  await saveBooks(books);
  return books[idx];
}

// ============================================================
// 设定（扁平存储，匹配 API 格式：WorldSetting[]）
// ============================================================

export interface LocalWorldSetting {
  id: string;
  type: string;
  name: string;
  description: string;
}

export async function saveSettingsArray(bookId: string, settings: LocalWorldSetting[]): Promise<void> {
  await setItem(`settings_flat_${bookId}`, settings);
}

export async function getSettingsArray(bookId: string): Promise<LocalWorldSetting[]> {
  return (await getItem<LocalWorldSetting[]>(`settings_flat_${bookId}`)) || [];
}

export async function addSettingItem(bookId: string, item: { id: string; type: string; name: string; description: string }): Promise<void> {
  const items = await getSettingsArray(bookId);
  items.push(item);
  await saveSettingsArray(bookId, items);
}

export async function updateSettingItem(bookId: string, settingId: string, updates: Partial<{ type: string; name: string; description: string }>): Promise<void> {
  const items = await getSettingsArray(bookId);
  const idx = items.findIndex(s => s.id === settingId);
  if (idx !== -1) {
    items[idx] = { ...items[idx], ...updates };
    await saveSettingsArray(bookId, items);
  }
}

export async function deleteSettingItem(bookId: string, settingId: string): Promise<void> {
  const items = await getSettingsArray(bookId);
  await saveSettingsArray(bookId, items.filter(s => s.id !== settingId));
}

// ============================================================
// 灵感（扁平存储，匹配 API 格式）
// ============================================================

export interface LocalInspirationItem {
  id: string;
  content: string;
  createdAt: string;
}

export async function saveInspirationsArray(bookId: string, inspirations: LocalInspirationItem[]): Promise<void> {
  await setItem(`inspirations_flat_${bookId}`, inspirations);
}

export async function getInspirationsArray(bookId: string): Promise<LocalInspirationItem[]> {
  return (await getItem<LocalInspirationItem[]>(`inspirations_flat_${bookId}`)) || [];
}

export async function addInspirationItem(bookId: string, item: { id: string; content: string; createdAt: string }): Promise<void> {
  const items = await getInspirationsArray(bookId);
  items.push(item);
  await saveInspirationsArray(bookId, items);
}

export async function updateInspirationItem(bookId: string, inspId: string, updates: Partial<{ content: string }>): Promise<void> {
  const items = await getInspirationsArray(bookId);
  const idx = items.findIndex(i => i.id === inspId);
  if (idx !== -1) {
    items[idx] = { ...items[idx], ...updates };
    await saveInspirationsArray(bookId, items);
  }
}

export async function deleteInspirationItem(bookId: string, inspId: string): Promise<void> {
  const items = await getInspirationsArray(bookId);
  await saveInspirationsArray(bookId, items.filter(i => i.id !== inspId));
}

export async function deleteBook(bookId: string): Promise<void> {
  const books = await getBooks();
  await saveBooks(books.filter((b) => b.id !== bookId));
  // 清理关联数据
  await removeByPrefix(`book_${bookId}`);
  await removeByPrefix(`chapters_${bookId}`);
  await removeByPrefix(`outlines_${bookId}`);
  await removeByPrefix(`settings_${bookId}`);
  await removeByPrefix(`inspirations_${bookId}`);
}

export async function getBookById(bookId: string): Promise<LocalBook | null> {
  const books = await getBooks();
  return books.find((b) => b.id === bookId) || null;
}

// ============================================================
// 章节 CRUD
// ============================================================

export async function saveChapters(bookId: string, chapters: LocalChapter[]): Promise<void> {
  await setItem(`chapters_${bookId}`, chapters);
}

export async function getChapters(bookId: string): Promise<LocalChapter[]> {
  return (await getItem<LocalChapter[]>(`chapters_${bookId}`)) || [];
}

export async function addChapter(bookId: string, chapter: LocalChapter): Promise<void> {
  const chapters = await getChapters(bookId);
  chapters.push(chapter);
  await saveChapters(bookId, chapters);
}

export async function updateChapter(
  bookId: string,
  chapterId: string,
  updates: Partial<LocalChapter>,
): Promise<LocalChapter | null> {
  const chapters = await getChapters(bookId);
  const idx = chapters.findIndex((c) => c.id === chapterId);
  if (idx === -1) return null;
  chapters[idx] = { ...chapters[idx], ...updates, updatedAt: new Date().toISOString() };
  await saveChapters(bookId, chapters);
  return chapters[idx];
}

export async function deleteChapter(bookId: string, chapterId: string): Promise<void> {
  const chapters = await getChapters(bookId);
  await saveChapters(bookId, chapters.filter((c) => c.id !== chapterId));
}

// ============================================================
// 大纲 CRUD
// ============================================================

export async function saveOutlines(bookId: string, outlines: LocalOutline[]): Promise<void> {
  await setItem(`outlines_${bookId}`, outlines);
}

export async function getOutlines(bookId: string): Promise<LocalOutline[]> {
  return (await getItem<LocalOutline[]>(`outlines_${bookId}`)) || [];
}

export async function addOutline(bookId: string, outline: LocalOutline): Promise<void> {
  const outlines = await getOutlines(bookId);
  outlines.push(outline);
  await saveOutlines(bookId, outlines);
}

// ============================================================
// 设定 CRUD
// ============================================================

export async function saveSettings(bookId: string, settings: LocalSetting[]): Promise<void> {
  await setItem(`settings_${bookId}`, settings);
}

export async function getSettings(bookId: string): Promise<LocalSetting[]> {
  return (await getItem<LocalSetting[]>(`settings_${bookId}`)) || [];
}

// ============================================================
// 灵感 CRUD
// ============================================================

export async function saveInspirations(bookId: string, inspirations: LocalInspiration[]): Promise<void> {
  await setItem(`inspirations_${bookId}`, inspirations);
}

export async function getInspirations(bookId: string): Promise<LocalInspiration[]> {
  return (await getItem<LocalInspiration[]>(`inspirations_${bookId}`)) || [];
}

// ============================================================
// 用户信息缓存
// ============================================================

export interface LocalUserProfile {
  id: string;
  email: string;
  nickname: string;
  avatar: string;
  bio: string;
  planType: string;
}

export async function saveUserProfile(profile: LocalUserProfile): Promise<void> {
  await setItem("user_profile", profile);
}

export async function getUserProfile(): Promise<LocalUserProfile | null> {
  return getItem<LocalUserProfile>("user_profile");
}

// ============================================================
// 批量操作（升级迁移用）
// ============================================================

export interface AllLocalData {
  books: LocalBook[];
  exportedAt: string;
}

export async function getAllLocalData(): Promise<AllLocalData> {
  const books = await getBooks();
  return {
    books,
    exportedAt: new Date().toISOString(),
  };
}

export async function clearAllLocalData(): Promise<void> {
  const allKeys = await AsyncStorage.getAllKeys();
  const localKeys = allKeys.filter((k) => k.startsWith(PREFIX));
  if (localKeys.length > 0) {
    await AsyncStorage.multiRemove(localKeys);
  }
}
