import { LLMClient, Config, ImageGenerationClient, HeaderUtils } from "coze-coding-dev-sdk";
import type { LLMConfig } from "coze-coding-dev-sdk";
import { getActiveApiKey } from "../services/api-key.service.js";

/**
 * 全局 AI 客户端单例
 * 避免每次请求或每个模块都重新创建实例
 */

// 全局配置实例（系统默认配置）
const globalConfig = new Config();

// 全局 LLM 客户端实例（系统默认）
const globalLLMClient = new LLMClient(globalConfig);

// 用户客户端缓存（简单内存缓存）
const userClientCache = new Map<string, { client: LLMClient; config: Config; expiresAt: number }>();
const userImageClientCache = new Map<string, { client: ImageGenerationClient; config: Config; expiresAt: number }>();
const CACHE_TTL = 30 * 60 * 1000; // 30分钟缓存

/**
 * 获取全局 LLM 客户端
 */
export function getLLMClient(): LLMClient {
  return globalLLMClient;
}

/**
 * 获取全局配置
 */
export function getAIConfig(): Config {
  return globalConfig;
}

/**
 * 根据用户 API Key 创建 LLM 客户端
 * @param userId 用户ID
 * @returns LLM 客户端实例，如果用户没有激活的 API Key 则返回全局客户端
 */
export async function getUserLLMClient(userId?: string): Promise<LLMClient> {
  // 没有用户ID，使用全局客户端
  if (!userId) {
    return globalLLMClient;
  }

  // 检查缓存
  const cached = userClientCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.client;
  }

  // 获取用户激活的 API Key
  const activeKey = await getActiveApiKey(userId);
  if (!activeKey || !activeKey.apiKey) {
    // 没有激活的Key，使用全局客户端
    return globalLLMClient;
  }

  // 使用用户的 API Key 创建新的配置和客户端
  const userConfig = new Config({
    apiKey: activeKey.apiKey,
    baseUrl: activeKey.apiBase || undefined,
  });

  const userClient = new LLMClient(userConfig);

  // 写入缓存
  userClientCache.set(userId, {
    client: userClient,
    config: userConfig,
    expiresAt: Date.now() + CACHE_TTL,
  });

  return userClient;
}

/**
 * 清除用户客户端缓存
 * 当用户更新/删除 API Key 时调用
 */
export function clearUserClientCache(userId: string): void {
  userClientCache.delete(userId);
  userImageClientCache.delete(userId);
}

/**
 * 创建图片生成客户端
 * @param headers 请求头（用于转发追踪）
 */
export function createImageClient(headers?: Record<string, string>): ImageGenerationClient {
  const customHeaders = headers ? HeaderUtils.extractForwardHeaders(headers) : undefined;
  return new ImageGenerationClient(globalConfig, customHeaders);
}

/**
 * 根据用户 API Key 创建图片生成客户端
 * @param userId 用户ID
 * @param headers 请求头（用于转发追踪）
 * @returns 图片生成客户端实例，如果用户没有激活的 API Key 则返回全局客户端
 */
export async function getUserImageClient(
  userId?: string,
  headers?: Record<string, string>
): Promise<ImageGenerationClient> {
  const customHeaders = headers ? HeaderUtils.extractForwardHeaders(headers) : undefined;

  // 没有用户ID，使用全局客户端
  if (!userId) {
    return new ImageGenerationClient(globalConfig, customHeaders);
  }

  // 检查缓存
  const cached = userImageClientCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    return new ImageGenerationClient(cached.config, customHeaders);
  }

  // 获取用户激活的 API Key
  const activeKey = await getActiveApiKey(userId);
  if (!activeKey || !activeKey.apiKey) {
    // 没有激活的Key，使用全局客户端
    return new ImageGenerationClient(globalConfig, customHeaders);
  }

  // 使用用户的 API Key 创建新的配置
  const userConfig = new Config({
    apiKey: activeKey.apiKey,
    baseUrl: activeKey.apiBase || undefined,
  });

  const userClient = new ImageGenerationClient(userConfig, customHeaders);

  // 写入缓存（只缓存配置，客户端每次新建以支持自定义headers）
  userImageClientCache.set(userId, {
    client: userClient,
    config: userConfig,
    expiresAt: Date.now() + CACHE_TTL,
  });

  return userClient;
}

/**
 * 执行 LLM 流式响应
 * @param messages 消息列表
 * @param systemPrompt 系统提示词
 * @param options 配置选项
 * @param userId 用户ID（可选，传入则尝试使用用户自己的API Key）
 */
export async function* streamLLM(
  messages: { role: string; content: string }[],
  systemPrompt: string,
  options: { model?: string; temperature?: number } = {},
  userId?: string
): AsyncGenerator<{ content: string }, void, unknown> {
  const allMessages = [
    { role: "system" as const, content: systemPrompt },
    ...messages.map((m) => ({
      role: (m.role === "system" ? "system" : m.role === "assistant" ? "assistant" : "user") as "system" | "assistant" | "user",
      content: m.content,
    })),
  ];

  const llmConfig: LLMConfig = {
    model: options.model || "doubao-seed-2-0-lite-260215",
    temperature: options.temperature ?? 0.8,
  };

  // 获取客户端（用户Key或全局Key）
  const client = userId ? await getUserLLMClient(userId) : globalLLMClient;

  const stream = client.stream(allMessages, llmConfig);
  for await (const chunk of stream) {
    if (chunk.content && typeof chunk.content === "string") {
      yield { content: chunk.content };
    }
  }
}

/**
 * 执行 LLM 非流式请求
 * @param userId 用户ID（可选，传入则尝试使用用户自己的API Key）
 */
export async function invokeLLM(
  messages: { role: string; content: string }[],
  systemPrompt: string,
  options: { model?: string; temperature?: number } = {},
  userId?: string
): Promise<string> {
  const allMessages = [
    { role: "system" as const, content: systemPrompt },
    ...messages.map((m) => ({
      role: (m.role === "system" ? "system" : m.role === "assistant" ? "assistant" : "user") as "system" | "assistant" | "user",
      content: m.content,
    })),
  ];

  const llmConfig: LLMConfig = {
    model: options.model || "doubao-seed-2-0-lite-260215",
    temperature: options.temperature ?? 0.8,
  };

  // 获取客户端（用户Key或全局Key）
  const client = userId ? await getUserLLMClient(userId) : globalLLMClient;

  const response = await client.invoke(allMessages, llmConfig);
  return response.content || "";
}
