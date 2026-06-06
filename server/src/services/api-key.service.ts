import { db } from "../storage/database/client.js";
import { userApiKeys } from "../storage/database/shared/schema.js";
import { eq, and, desc } from "drizzle-orm";
import { randomUUID } from "crypto";

export interface ApiKeyInfo {
  id: string;
  keyName: string;
  provider: string;
  apiKey?: string; // 仅创建/更新时返回明文，查询时不返回
  apiBase?: string;
  model?: string;
  rateLimitPerMinute?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// 简单加密（生产环境应使用更安全的加密方式）
function encryptApiKey(key: string): string {
  // 简单的 base64 + 反转，仅作示例
  return Buffer.from(key.split('').reverse().join('')).toString('base64');
}

function decryptApiKey(encrypted: string): string {
  return Buffer.from(encrypted, 'base64').toString().split('').reverse().join('');
}

/**
 * 获取用户的所有 API Key（不返回明文）
 */
export async function getUserApiKeys(userId: string): Promise<Omit<ApiKeyInfo, 'apiKey'>[]> {
  const keys = await db.select().from(userApiKeys)
    .where(eq(userApiKeys.userId, userId))
    .orderBy(desc(userApiKeys.createdAt));

  return keys.map(k => ({
    id: k.id,
    keyName: k.keyName,
    provider: k.provider,
    apiBase: k.apiBase || undefined,
    model: k.model || undefined,
    rateLimitPerMinute: k.rateLimitPerMinute || undefined,
    isActive: k.isActive,
    createdAt: k.createdAt,
    updatedAt: k.updatedAt,
  }));
}

/**
 * 获取用户激活的 API Key（返回明文，用于内部调用）
 */
export async function getActiveApiKey(userId: string): Promise<ApiKeyInfo | null> {
  const [key] = await db.select().from(userApiKeys)
    .where(and(
      eq(userApiKeys.userId, userId),
      eq(userApiKeys.isActive, true),
    ))
    .limit(1);

  if (!key) return null;

  return {
    id: key.id,
    keyName: key.keyName,
    provider: key.provider,
    apiKey: decryptApiKey(key.apiKey),
    apiBase: key.apiBase || undefined,
    model: key.model || undefined,
    rateLimitPerMinute: key.rateLimitPerMinute || undefined,
    isActive: key.isActive,
    createdAt: key.createdAt,
    updatedAt: key.updatedAt,
  };
}

/**
 * 添加 API Key
 */
export async function addApiKey(userId: string, data: {
  keyName: string;
  provider: string;
  apiKey: string;
  apiBase?: string;
  model?: string;
  rateLimitPerMinute?: number;
}): Promise<ApiKeyInfo> {
  // 检查数量限制（最多5个）
  const existing = await db.select().from(userApiKeys).where(eq(userApiKeys.userId, userId));
  if (existing.length >= 5) {
    throw new Error("最多只能添加5个API Key");
  }

  const id = randomUUID();
  const [newKey] = await db.insert(userApiKeys).values({
    id,
    userId,
    keyName: data.keyName || '默认Key',
    provider: data.provider || 'custom',
    apiKey: encryptApiKey(data.apiKey),
    apiBase: data.apiBase || null,
    model: data.model || null,
    rateLimitPerMinute: data.rateLimitPerMinute || 10,
    isActive: existing.length === 0, // 第一个设为激活
  }).returning();

  return {
    id: newKey.id,
    keyName: newKey.keyName,
    provider: newKey.provider,
    apiKey: data.apiKey, // 创建时返回一次明文
    apiBase: newKey.apiBase || undefined,
    model: newKey.model || undefined,
    rateLimitPerMinute: newKey.rateLimitPerMinute || undefined,
    isActive: newKey.isActive,
    createdAt: newKey.createdAt,
    updatedAt: newKey.updatedAt,
  };
}

/**
 * 更新 API Key
 */
export async function updateApiKey(userId: string, keyId: string, data: {
  keyName?: string;
  apiKey?: string;
  apiBase?: string;
  model?: string;
  rateLimitPerMinute?: number;
  isActive?: boolean;
}): Promise<Omit<ApiKeyInfo, 'apiKey'>> {
  // 检查 key 是否属于该用户
  const [existing] = await db.select().from(userApiKeys)
    .where(and(eq(userApiKeys.id, keyId), eq(userApiKeys.userId, userId)))
    .limit(1);

  if (!existing) {
    throw new Error("API Key不存在");
  }

  const updateData: any = {};
  if (data.keyName !== undefined) updateData.keyName = data.keyName;
  if (data.apiKey !== undefined) updateData.apiKey = encryptApiKey(data.apiKey);
  if (data.apiBase !== undefined) updateData.apiBase = data.apiBase;
  if (data.model !== undefined) updateData.model = data.model;
  if (data.rateLimitPerMinute !== undefined) updateData.rateLimitPerMinute = data.rateLimitPerMinute;

  // 如果要激活这个key，先取消其他key的激活状态
  if (data.isActive === true) {
    await db.update(userApiKeys).set({ isActive: false })
      .where(and(eq(userApiKeys.userId, userId), eq(userApiKeys.isActive, true)));
    updateData.isActive = true;
  }

  const [updated] = await db.update(userApiKeys)
    .set(updateData)
    .where(eq(userApiKeys.id, keyId))
    .returning();

  return {
    id: updated.id,
    keyName: updated.keyName,
    provider: updated.provider,
    apiBase: updated.apiBase || undefined,
    model: updated.model || undefined,
    rateLimitPerMinute: updated.rateLimitPerMinute || undefined,
    isActive: updated.isActive,
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt,
  };
}

/**
 * 删除 API Key
 */
export async function deleteApiKey(userId: string, keyId: string): Promise<void> {
  const [existing] = await db.select().from(userApiKeys)
    .where(and(eq(userApiKeys.id, keyId), eq(userApiKeys.userId, userId)))
    .limit(1);

  if (!existing) {
    throw new Error("API Key不存在");
  }

  await db.delete(userApiKeys).where(eq(userApiKeys.id, keyId));
}

/**
 * 设置激活的 API Key
 */
export async function setActiveApiKey(userId: string, keyId: string): Promise<void> {
  const [existing] = await db.select().from(userApiKeys)
    .where(and(eq(userApiKeys.id, keyId), eq(userApiKeys.userId, userId)))
    .limit(1);

  if (!existing) {
    throw new Error("API Key不存在");
  }

  // 取消所有激活
  await db.update(userApiKeys).set({ isActive: false })
    .where(and(eq(userApiKeys.userId, userId), eq(userApiKeys.isActive, true)));

  // 激活指定key
  await db.update(userApiKeys).set({ isActive: true })
    .where(eq(userApiKeys.id, keyId));
}
