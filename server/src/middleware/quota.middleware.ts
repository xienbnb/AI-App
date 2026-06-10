import { type Request, type Response, type NextFunction } from "express";
import { checkQuota, consumeQuota } from "../services/vip.service.js";

/**
 * 额度校验中间件
 * 检查用户是否有足够的AI调用额度
 * 使用前需要先经过 authMiddleware 认证
 */
export function quotaMiddleware(operationType: string = 'ai_generate') {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
      res.status(401).json({ error: "未登录" });
      return;
    }

    // 检查额度
    const useCustomKey = req.body?.useCustomKey === true;
    const result = await checkQuota(userId, 0, useCustomKey);

    if (!result.ok) {
      res.status(429).json({
        success: false,
        error: result.reason || "额度不足",
        code: "QUOTA_EXCEEDED",
      });
      return;
    }

    // 将额度信息附加到请求上
    (req as any).quotaRemaining = result.remaining;
    (req as any).useCustomKey = useCustomKey;
    
    // 记录使用（在响应后异步执行，不阻塞）
    res.on('finish', async () => {
      try {
        // 如果响应成功，扣减额度
        if (res.statusCode < 400) {
          // 注意：这里不立即扣减，实际token使用量需要在AI调用完成后再更新
          await consumeQuota(userId, operationType, 0, true, undefined, useCustomKey);
        }
      } catch (err) {
          console.error("[QUOTA] Failed to consume quota:", err);
        }
      });

      next();
    } catch (err: any) {
      console.error("[QUOTA] Middleware error:", err);
      res.status(500).json({ error: "额度校验失败" });
    }
  };
}

/**
 * 流式响应的额度扣减（用于SSE场景，在流结束后扣减）
 * @param useCustomKey 是否使用用户自定义 API Key（自定义 Key 不扣字数）
 */
export async function consumeStreamQuota(
  userId: string,
  operationType: string,
  tokensUsed: number = 0,
  useCustomKey: boolean = false,
) {
  try {
    await consumeQuota(userId, operationType, tokensUsed, true, undefined, useCustomKey);
  } catch (err) {
    console.error("[QUOTA] Failed to consume stream quota:", err);
  }
}
