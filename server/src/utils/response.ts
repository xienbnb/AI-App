/**
 * 统一响应工具
 * 所有路由通过此工具返回数据，保证格式一致
 */

import type { Response } from 'express';

/**
 * 成功响应
 * @param res Express Response 对象
 * @param data 返回数据
 * @param statusCode HTTP 状态码（默认 200）
 */
export function success(res: Response, data: any = null, statusCode = 200): void {
  res.status(statusCode).json({
    success: true,
    data,
  });
}

/**
 * 分页成功响应
 * @param res Express Response 对象
 * @param data 列表数据
 * @param total 总数
 * @param page 当前页
 * @param pageSize 每页大小
 */
export function paginated(
  res: Response,
  data: any[],
  total: number,
  page: number,
  pageSize: number,
): void {
  res.status(200).json({
    success: true,
    data,
    pagination: {
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
  });
}