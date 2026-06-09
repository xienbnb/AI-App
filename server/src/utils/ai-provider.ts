/**
 * 统一 AI Provider 适配器
 *
 * 职责：
 * 1. 根据用户的 API 配置自动选择底层 Provider
 * 2. 无自定义 Key → 用 Coze SDK（默认）
 * 3. 有自定义 Key → 用 OpenAI 兼容 HTTP API
 * 4. 统一输出格式 { content: string } 与下游兼容
 */

import { createRequire } from "module";
import { db } from "../storage/database/client.js";
import { users } from "../storage/database/shared/schema.js";
import { eq } from "drizzle-orm";

// ============================================================
// 类型定义
// ============================================================

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface LLMChunk {
  content?: string;
}

export interface AIProvider {
  readonly defaultModel: string;
  generateStream(
    messages: LLMMessage[],
    options?: LLMOptions,
  ): AsyncGenerator<LLMChunk, void, undefined>;
  generate(
    messages: LLMMessage[],
    options?: LLMOptions,
  ): Promise<string>;
}

// ============================================================
// 用户自定义 API Key 缓存（5分钟过期）
// ============================================================

interface ApiKeyCache {
  userId: string;
  apiKey: string;
  apiBase: string;
  model: string;
  fetchedAt: number;
}

const apiKeyCacheMap = new Map<string, ApiKeyCache>();
const CACHE_TTL = 5 * 60 * 1000; // 5分钟

async function getUserCustomApiKey(userId: string) {
  const cached = apiKeyCacheMap.get(userId);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return cached;
  }
  try {
    const [userRow] = await db
      .select({ customApiKey: users.customApiKey })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (userRow?.customApiKey) {
      const parts = userRow.customApiKey.split("||");
      const result: ApiKeyCache = {
        userId,
        apiKey: parts[0] || "",
        apiBase: parts[1] || "",
        model: parts[2] || "",
        fetchedAt: Date.now(),
      };
      if (result.apiKey) {
        apiKeyCacheMap.set(userId, result);
        return result;
      }
    }
  } catch {}
  return null;
}

// ============================================================
// Provider 工厂
// ============================================================

// ============================================================
// 公益 AI（SiliconFlow）配置
// ============================================================

const SILICONFLOW_API_KEY = "sk-pswiizdmufuynmehxtjihfipxdixymnvxzlujxezfomhlgvg";
const SILICONFLOW_BASE_URL = "https://api.siliconflow.cn/v1";

/** 已知的 SiliconFlow 免费模型列表 */
export const SILICONFLOW_MODELS: string[] = [
  "Pro/zai-org/GLM-4.7",
  "deepseek-ai/DeepSeek-V3",
  "deepseek-ai/DeepSeek-R1",
];

function isSiliconFlowModel(model: string): boolean {
  return SILICONFLOW_MODELS.includes(model);
}

// ============================================================
// 读取用户偏好的模型
// ============================================================

async function getUserPreferredModel(userId: string): Promise<string | null> {
  try {
    const [row] = await db
      .select({ aiSettings: users.aiSettings })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (row?.aiSettings) {
      const settings = row.aiSettings as { aiModel?: string };
      if (settings.aiModel) {
        return settings.aiModel;
      }
    }
  } catch {}
  return null;
}

// ============================================================
// Provider 工厂
// ============================================================

export async function createProvider(userId?: string, requestModel?: string): Promise<AIProvider> {
  // 0. 优先判断：请求中指定的模型是否为公益 AI
  if (requestModel && isSiliconFlowModel(requestModel)) {
    return new OpenAICompatibleProvider(
      SILICONFLOW_API_KEY,
      SILICONFLOW_BASE_URL,
      requestModel,
    );
  }

  // 1. 其次判断用户设置的模型
  if (userId) {
    const preferredModel = await getUserPreferredModel(userId);
    if (preferredModel && isSiliconFlowModel(preferredModel)) {
      return new OpenAICompatibleProvider(
        SILICONFLOW_API_KEY,
        SILICONFLOW_BASE_URL,
        preferredModel,
      );
    }

    // 2. 有自定义 API Key
    const custom = await getUserCustomApiKey(userId);
    if (custom) {
      return new OpenAICompatibleProvider(custom.apiKey, custom.apiBase, custom.model);
    }
  }

  // 3. 默认：Coze SDK
  return new CozeSdkProvider();
}

// ============================================================
// Coze SDK Provider
// ============================================================

class CozeSdkProvider implements AIProvider {
  readonly defaultModel = "doubao-seed-2-0-pro-260215";
  private client: any = null;

  private async getClient(): Promise<any> {
    if (!this.client) {
      const { LLMClient, Config } = await import("coze-coding-dev-sdk");
      const config = new Config({
        apiKey: process.env.COZE_WORKLOAD_IDENTITY_API_KEY,
        baseUrl: process.env.COZE_INTEGRATION_BASE_URL || "https://api.coze.cn",
      });
      this.client = new LLMClient(config);
    }
    return this.client;
  }

  async *generateStream(
    messages: LLMMessage[],
    options?: LLMOptions,
  ): AsyncGenerator<LLMChunk, void, undefined> {
    const client = await this.getClient();
    const stream = client.stream(messages, {
      model: options?.model || this.defaultModel,
      temperature: options?.temperature ?? 0.8,
      ...(options?.maxTokens ? { maxTokens: options.maxTokens } : {}),
    });
    for await (const chunk of stream) {
      if (chunk.content) {
        yield { content: chunk.content.toString() };
      }
    }
  }

  async generate(
    messages: LLMMessage[],
    options?: LLMOptions,
  ): Promise<string> {
    let result = "";
    for await (const chunk of this.generateStream(messages, options)) {
      if (chunk.content) result += chunk.content;
    }
    return result;
  }
}

// ============================================================
// OpenAI 兼容 HTTP Provider
// ============================================================

class OpenAICompatibleProvider implements AIProvider {
  readonly defaultModel: string;
  private _apiKey: string;
  private _apiBase: string;

  constructor(
    apiKey: string,
    apiBase: string,
    model?: string,
  ) {
    this._apiKey = apiKey;
    this._apiBase = apiBase;
    this.defaultModel = model || "gpt-4o";
  }

  async *generateStream(
    messages: LLMMessage[],
    options?: LLMOptions,
  ): AsyncGenerator<LLMChunk, void, undefined> {
    const baseUrl = (this._apiBase || "https://api.openai.com/v1").replace(/\/+$/, "");
    const model = options?.model || this.defaultModel;

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this._apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: options?.temperature ?? 0.8,
        max_tokens: options?.maxTokens || 4096,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      throw new Error(`LLM API Error ${response.status}: ${errText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("响应体不可读");

    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data:")) continue;
          const data = trimmed.slice(5).trim();
          if (data === "[DONE]") return;

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content || "";
            if (content) yield { content };
          } catch {
            // 跳过解析失败的行
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async generate(
    messages: LLMMessage[],
    options?: LLMOptions,
  ): Promise<string> {
    let result = "";
    for await (const chunk of this.generateStream(messages, options)) {
      if (chunk.content) result += chunk.content;
    }
    return result;
  }
}

export default { createProvider };