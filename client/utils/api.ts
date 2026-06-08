/**
 * 统一 API 客户端
 *
 * 所有前端接口请求统一通过此模块调用。
 * - 自动管理 API_BASE URL
 * - 自动注入认证 Token（通过 AsyncStorage 读取 x-session）
 * - 统一错误处理（401 自动跳转登录、网络错误提示）
 * - 支持 GET / POST / PUT / DELETE / UPLOAD
 * - 支持 SSE 流式请求
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || 'http://localhost:9091';

// ============================================================
// 类型定义
// ============================================================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface RequestOptions {
  /** 请求超时毫秒数（默认 30000） */
  timeout?: number;
  /** 自定义请求头 */
  headers?: Record<string, string>;
  /** 是否跳过自动 401 跳转（某些页面需要自行处理） */
  skipAuthRedirect?: boolean;
}

interface FetchOptions extends RequestOptions {
  method: string;
  body?: any;
  isFormData?: boolean;
}

// ============================================================
// 认证 Token 管理
// ============================================================

/**
 * 从 AsyncStorage 获取保存的 session token
 * 由登录流程写入 key "auth_session_token"
 */
async function getAuthToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem('auth_session_token');
  } catch {
    return null;
  }
}

/**
 * 设置保存 session token（由登录流程调用）
 */
export async function setAuthToken(token: string): Promise<void> {
  await AsyncStorage.setItem('auth_session_token', token);
}

/**
 * 清除保存的 session token（由登出流程调用）
 */
export async function clearAuthToken(): Promise<void> {
  await AsyncStorage.removeItem('auth_session_token');
}

// ============================================================
// 核心请求函数
// ============================================================

/**
 * 构建完整 URL
 */
function buildUrl(path: string, params?: Record<string, string | number | undefined>): string {
  // 如果 path 已经是完整 URL，直接使用
  const base = path.startsWith('http') ? '' : `${API_BASE}`;
  const url = new URL(`${base}${path}`);

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    });
  }

  return url.toString();
}

/**
 * 内部请求函数
 */
async function request<T = any>(
  path: string,
  options: FetchOptions,
  params?: Record<string, string | number | undefined>,
): Promise<ApiResponse<T>> {
  const { method, body, isFormData, timeout = 30000, headers: customHeaders, skipAuthRedirect } = options;

  const url = buildUrl(path, params);

  // 构建请求头
  const headers: Record<string, string> = {
    ...customHeaders,
  };

  // 如果不是 FormData，设置 JSON Content-Type
  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }

  // 注入认证 Token
  const token = await getAuthToken();
  if (token) {
    headers['x-session'] = token;
  }

  // 构建请求体
  let requestBody: any = undefined;
  if (body !== undefined) {
    requestBody = isFormData ? body : JSON.stringify(body);
  }

  // 超时控制
  const controller = new AbortController();
  const timeoutTimer = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: requestBody,
      signal: controller.signal,
    });

    clearTimeout(timeoutTimer);

    // 401 未认证 → 跳转登录页
    if (response.status === 401 && !skipAuthRedirect) {
      await clearAuthToken();
      // 尝试用 router 跳转，但注意这可能不在组件上下文中
      // 实际使用时通过 onUnauthorized 回调处理
      if (typeof onUnauthorizedCallback === 'function') {
        onUnauthorizedCallback();
      }
      return { success: false, error: '登录已过期，请重新登录' };
    }

    // 204 No Content（如 DELETE 成功）
    if (response.status === 204) {
      return { success: true };
    }

    // 解析 JSON 响应
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const json = await response.json();

      // 兼容两种响应格式
      if (response.ok) {
        // 标准格式：{ success: true, data: {...} }
        // 或直接返回数据
        return {
          success: true,
          data: json.data !== undefined ? json.data : json,
        };
      } else {
        // 错误格式：{ error: "..." } 或 { message: "..." }
        return {
          success: false,
          error: json.error || json.message || `请求失败 (${response.status})`,
        };
      }
    }

    // 非 JSON 响应（如文本、文件下载）
    if (response.ok) {
      const text = await response.text();
      return { success: true, data: text as any };
    }

    return { success: false, error: `请求失败 (${response.status})` };
  } catch (error: any) {
    clearTimeout(timeoutTimer);

    if (error.name === 'AbortError') {
      return { success: false, error: '请求超时' };
    }

    return {
      success: false,
      error: error?.message || '网络异常，请检查网络连接',
    };
  }
}

// ============================================================
// 全局 401 回调注册
// ============================================================

let onUnauthorizedCallback: (() => void) | null = null;

/**
 * 注册 401 未授权回调（由 App 入口在 Router 上下文中设置）
 */
export function onUnauthorized(callback: () => void): void {
  onUnauthorizedCallback = callback;
}

// ============================================================
// 公开 API 方法
// ============================================================

/**
 * GET 请求
 * @param path API 路径，如 `/api/v1/books`
 * @param params 查询参数
 * @param options 请求选项
 */
export async function get<T = any>(
  path: string,
  params?: Record<string, string | number | undefined>,
  options?: RequestOptions,
): Promise<ApiResponse<T>> {
  return request<T>(path, { ...options, method: 'GET' }, params);
}

/**
 * POST 请求
 * @param path API 路径
 * @param body 请求体（自动 JSON 序列化）
 * @param options 请求选项
 */
export async function post<T = any>(
  path: string,
  body?: any,
  options?: RequestOptions,
): Promise<ApiResponse<T>> {
  return request<T>(path, { ...options, method: 'POST', body });
}

/**
 * PUT 请求
 * @param path API 路径
 * @param body 请求体
 * @param options 请求选项
 */
export async function put<T = any>(
  path: string,
  body?: any,
  options?: RequestOptions,
): Promise<ApiResponse<T>> {
  return request<T>(path, { ...options, method: 'PUT', body });
}

/**
 * DELETE 请求
 * @param path API 路径
 * @param options 请求选项
 */
export async function del<T = any>(
  path: string,
  options?: RequestOptions,
): Promise<ApiResponse<T>> {
  return request<T>(path, { ...options, method: 'DELETE' });
}

/**
 * 文件上传（FormData）
 * @param path API 路径
 * @param formData FormData 对象（包含文件和其他字段）
 * @param options 请求选项
 */
export async function upload<T = any>(
  path: string,
  formData: FormData,
  options?: RequestOptions,
): Promise<ApiResponse<T>> {
  return request<T>(path, { ...options, method: 'POST', body: formData, isFormData: true });
}

/**
 * SSE 流式请求（用于 AI 流式输出）
 * @param path API 路径
 * @param body 请求体
 * @param callbacks 事件回调
 * @param options 请求选项
 */
export async function streamRequest(
  path: string,
  body: any,
  callbacks: {
    onMessage: (text: string) => void;
    onDone?: () => void;
    onError?: (error: string) => void;
  },
  options?: RequestOptions,
): Promise<void> {
  const { onMessage, onDone, onError } = callbacks;
  const token = await getAuthToken();

  const url = buildUrl(path);

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['x-session'] = token;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '请求失败');
      onError?.(errorText);
      return;
    }

    // 使用 text() 读取整个响应（兼容 RN 环境）
    const text = await response.text();
    // 按 SSE 格式解析
    const lines = text.split('\n');
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6).trim();
        if (data === '[DONE]') {
          onDone?.();
          return;
        }
        onMessage(data);
      }
    }

    onDone?.();
  } catch (error: any) {
    onError?.(error?.message || '流式请求失败');
  }
}

// ============================================================
// 导出默认对象（兼容旧代码）
// ============================================================

const api = { get, post, put, del, upload, streamRequest, setAuthToken, clearAuthToken, onUnauthorized };

export default api;