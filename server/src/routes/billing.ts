import { Router, type Request, type Response } from "express";
import { db } from "../storage/database/client.js";
import { billingRecords, usageRecords } from "../storage/database/shared/schema.js";
import { eq, desc, sql, and } from "drizzle-orm";

const router = Router();

// 获取用户扣费明细列表
router.get("/", async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: "未登录" });
    }

    const page = parseInt(req.query.page as string) || 1;
    const pageSize = Math.min(parseInt(req.query.pageSize as string) || 20, 50);
    const offset = (page - 1) * pageSize;
    const filterType = req.query.type as string;

    // 构建查询条件
    const conditions = [eq(billingRecords.userId, userId)];
    if (filterType && filterType !== 'all') {
      conditions.push(eq(billingRecords.type, filterType));
    }

    // 查询总数
    const [countResult] = await db.select({ count: sql<number>`count(*)` })
      .from(billingRecords)
      .where(and(...conditions));

    // 查询列表
    const records = await db.select()
      .from(billingRecords)
      .where(and(...conditions))
      .orderBy(desc(billingRecords.createdAt))
      .limit(pageSize)
      .offset(offset);

    // 汇总统计
    const [summary] = await db.select({
      totalDeductions: sql<number>`COALESCE(SUM(CASE WHEN type = 'deduction' THEN amount ELSE 0 END), 0)`,
      totalRecharges: sql<number>`COALESCE(SUM(CASE WHEN type = 'recharge' THEN amount ELSE 0 END), 0)`,
      totalClaims: sql<number>`COALESCE(SUM(CASE WHEN type = 'claim' THEN amount ELSE 0 END), 0)`,
    }).from(billingRecords).where(eq(billingRecords.userId, userId));

    const totalCount = countResult?.count || 0;
    const total = typeof totalCount === 'number' ? totalCount : parseInt(totalCount as string) || 0;

    res.json({
      success: true,
      data: {
        records,
        total,
        page,
        pageSize,
        summary: {
          totalDeductions: summary?.totalDeductions || 0,
          totalRecharges: summary?.totalRecharges || 0,
          totalClaims: summary?.totalClaims || 0,
        },
      },
    });
  } catch (err: any) {
    console.error("[Billing] List error:", err);
    res.status(500).json({ success: false, error: err.message || "获取扣费明细失败" });
  }
});

// 获取单条扣费详情
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: "未登录" });
    }

    const [record] = await db.select()
      .from(billingRecords)
      .where(and(
        eq(billingRecords.id, req.params.id as string),
        eq(billingRecords.userId, userId)
      ))
      .limit(1);

    if (!record) {
      return res.status(404).json({ success: false, error: "记录不存在" });
    }

    res.json({ success: true, data: record });
  } catch (err: any) {
    console.error("[Billing] Detail error:", err);
    res.status(500).json({ success: false, error: err.message || "获取详情失败" });
  }
});

export default router;