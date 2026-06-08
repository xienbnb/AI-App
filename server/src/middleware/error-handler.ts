/**
 * 统一错误处理中间件
 *
 * 所有路由异常统一捕获，保证 API 响应格式一致：
 * - 正常：{ success: true, data: ... }
 * - 错误：{ success: false, error: "错误描述" }
 */

import type { Request, Response, NextFunction } from 'express';

/**
 * 业务逻辑异常类
 * 使用方式：throw new AppError(400, '参数错误')
 */
export class AppError extends Error {
  public statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
  }
}

/**
 * 404 路由未匹配处理
 * 必须放在所有路由注册之后
 */
export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(new AppError(404, `接口不存在: ${req.method} ${req.path}`));
}

/**
 * 全局错误捕获中间件
 * 捕获所有 throw 的 Error 和 AppError，返回统一格式
 */
export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  // 打印错误日志
  console.error(`[Error] ${err.name}: ${err.message}`);

  // 判断是否是自定义错误
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: err.message,
    });
    return;
  }

  // PostgreSQL / 数据库错误
  if (err.message?.includes?.('relation') && err.message?.includes?.('does not exist')) {
    res.status(500).json({
      success: false,
      error: '数据库表不存在，请检查数据库迁移',
    });
    return;
  }

  // 类型错误 / 参数校验错误
  if (err.name === 'ZodError' || err.name === 'ValidationError') {
    res.status(400).json({
      success: false,
      error: err.message,
    });
    return;
  }

  // 未知错误（500）
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production'
      ? '服务器内部错误'
      : err.message || '未知错误',
  });
}

/**
 * 包装异步路由处理函数，自动捕获异常
 * 使用方式：router.get('/path', asyncHandler(handler))
 */
export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}