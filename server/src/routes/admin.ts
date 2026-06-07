import { Router } from "express";
import { db } from "../storage/database/client.js";
import { users, adminUsers, redeemCodes, redeemLogs, usageRecords, billingRecords, userVips, posts, comments } from "../storage/database/shared/schema.js";
import { requireAdmin } from "../middleware/admin.js";
import { authMiddleware } from "../middleware/auth.js";
import { eq, desc, count, sql, and, gte, lte } from "drizzle-orm";

const router = Router();

// 所有管理接口需要登录 + 管理员权限
router.use(authMiddleware, requireAdmin(1));

// ==================== 仪表盘 ====================

router.get("/dashboard", async (req, res) => {
  try {
    const [totalUsers] = await db.select({ value: count() }).from(users);
    const today = new Date().toISOString().split('T')[0];

    const [todayUsers] = await db.select({ value: count() })
      .from(users)
      .where(gte(users.createdAt, today));

    const [totalCalls] = await db.select({ value: count() })
      .from(usageRecords);

    const [todayCalls] = await db.select({ value: count() })
      .from(usageRecords)
      .where(gte(usageRecords.createdAt, today));

    const [vipUsers] = await db.select({ value: count() })
      .from(userVips)
      .where(sql`${userVips.planType} != 'free'`);

    res.json({
      totalUsers: Number(totalUsers.value),
      todayNewUsers: Number(todayUsers.value),
      totalCalls: Number(totalCalls.value),
      todayCalls: Number(todayCalls.value),
      vipUsers: Number(vipUsers.value),
    });
  } catch (err: any) {
    console.error("[ADMIN] Dashboard error:", err);
    res.status(500).json({ error: "获取数据失败" });
  }
});

// ==================== 用户管理 ====================

router.get("/users", async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const keyword = req.query.keyword as string;
    const vipStatus = req.query.vip as string;
    const offset = (page - 1) * limit;

    const conditions = [];
    if (keyword) {
      conditions.push(
        sql`(${users.phone}::text ILIKE ${`%${keyword}%`} OR ${users.email} ILIKE ${`%${keyword}%`} OR ${users.nickname} ILIKE ${`%${keyword}%`})`
      );
    }

    const whereClause = conditions.length > 0 ? sql`(${conditions.join(') AND (')})` : undefined;

    const [totalResult] = await db.select({ value: count() })
      .from(users)
      .where(whereClause);

    const userList = await db.select({
      id: users.id,
      phone: users.phone,
      email: users.email,
      nickname: users.nickname,
      avatar: users.avatar,
      role: users.role,
      planType: userVips.planType,
      tokenBalance: userVips.tokenBalance,
      vipLevel: users.vipLevel,
      createdAt: users.createdAt,
      lastActiveDate: users.lastActiveDate,
    })
      .from(users)
      .leftJoin(userVips, eq(users.id, userVips.userId))
      .where(whereClause)
      .orderBy(desc(users.createdAt))
      .limit(limit)
      .offset(offset);

    res.json({
      total: Number(totalResult.value),
      page,
      limit,
      data: userList,
    });
  } catch (err: any) {
    console.error("[ADMIN] Users list error:", err);
    res.status(500).json({ error: "获取用户列表失败" });
  }
});

router.get("/users/:id", async (req, res) => {
  try {
    const [user] = await db.select({
      id: users.id,
      phone: users.phone,
      email: users.email,
      nickname: users.nickname,
      avatar: users.avatar,
      bio: users.bio,
      role: users.role,
      planType: userVips.planType,
      tokenBalance: userVips.tokenBalance,
      vipLevel: users.vipLevel,
      monthlyAiCount: users.monthlyAiCount,
      createdAt: users.createdAt,
      lastActiveDate: users.lastActiveDate,
    })
      .from(users)
      .leftJoin(userVips, eq(users.id, userVips.userId))
      .where(eq(users.id, req.params.id))
      .limit(1);

    if (!user) {
      res.status(404).json({ error: "用户不存在" });
      return;
    }

    const billing = await db.select()
      .from(billingRecords)
      .where(eq(billingRecords.userId, req.params.id))
      .orderBy(desc(billingRecords.createdAt))
      .limit(20);

    res.json({ ...user, billingRecords: billing });
  } catch (err: any) {
    console.error("[ADMIN] User detail error:", err);
    res.status(500).json({ error: "获取用户详情失败" });
  }
});

router.patch("/users/:id/ban", async (req, res) => {
  try {
    const { banned } = req.body;
    await db.update(users)
      .set({ role: banned ? 'banned' : 'user', updatedAt: sql`NOW()` })
      .where(eq(users.id, req.params.id));

    res.json({ success: true, message: banned ? "已封禁" : "已解封" });
  } catch (err: any) {
    console.error("[ADMIN] Ban user error:", err);
    res.status(500).json({ error: "操作失败" });
  }
});

router.patch("/users/:id/vip", async (req, res) => {
  try {
    const { planType, days } = req.body; // planType: monthly/yearly, days: 30/365
    const now = new Date();

    const existing = await db.select()
      .from(userVips)
      .where(eq(userVips.userId, req.params.id))
      .limit(1);

    if (existing.length > 0) {
      await db.update(userVips)
        .set({
          planType,
          status: 'active',
          endDate: new Date(now.getTime() + days * 86400000).toISOString(),
          monthlyQuota: planType === 'yearly' ? 99999 : 9999,
          dailyQuota: planType === 'yearly' ? 9999 : 999,
          updatedAt: sql`NOW()`,
        })
        .where(eq(userVips.id, existing[0].id));
    } else {
      await db.insert(userVips).values({
        userId: req.params.id as any,
        planType,
        status: 'active',
        startDate: now.toISOString(),
        endDate: new Date(now.getTime() + days * 86400000).toISOString(),
        monthlyQuota: planType === 'yearly' ? 99999 : 9999,
        dailyQuota: planType === 'yearly' ? 9999 : 999,
      });
    }

    await db.update(users)
      .set({ vipLevel: planType === 'yearly' ? 2 : 1, updatedAt: sql`NOW()` })
      .where(eq(users.id, req.params.id));

    res.json({ success: true, message: "VIP 已设置" });
  } catch (err: any) {
    console.error("[ADMIN] Set VIP error:", err);
    res.status(500).json({ error: "设置VIP失败" });
  }
});

router.patch("/users/:id/quota", async (req, res) => {
  try {
    const { tokenBalance, monthlyAiCount } = req.body;

    const updates: any = { updatedAt: sql`NOW()` };
    if (tokenBalance !== undefined) updates.tokenBalance = tokenBalance;
    if (monthlyAiCount !== undefined) updates.monthlyAiCount = monthlyAiCount;

    if (tokenBalance !== undefined) {
      await db.update(userVips)
        .set({ tokenBalance, updatedAt: sql`NOW()` })
        .where(eq(userVips.userId, req.params.id));
    }

    if (monthlyAiCount !== undefined) {
      await db.update(users)
        .set({ monthlyAiCount, updatedAt: sql`NOW()` })
        .where(eq(users.id, req.params.id));
    }

    res.json({ success: true, message: "额度已更新" });
  } catch (err: any) {
    console.error("[ADMIN] Update quota error:", err);
    res.status(500).json({ error: "更新额度失败" });
  }
});

// ==================== 兑换码管理 ====================

function generateCode(prefix: string): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = prefix;
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

router.post("/redeem/generate", async (req, res) => {
  try {
    const { type, value, usesTotal = 1, count = 1, expiresAt } = req.body;

    if (!type || !value) {
      res.status(400).json({ error: "缺少参数: type, value" });
      return;
    }

    const prefix = type === 'token' ? 'TOKEN_' : type === 'call' ? 'CALL_' : 'VIP_';
    const codes: string[] = [];

    for (let i = 0; i < count; i++) {
      const code = generateCode(prefix);
      codes.push(code);
      await db.insert(redeemCodes).values({
        code,
        type,
        value,
        usesTotal,
        usesLeft: usesTotal,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null as any,
        createdBy: req.admin!.id as any,
      });
    }

    res.json({ success: true, codes, count });
  } catch (err: any) {
    console.error("[ADMIN] Generate code error:", err);
    res.status(500).json({ error: "生成兑换码失败" });
  }
});

router.get("/redeem/list", async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    const [totalResult] = await db.select({ value: count() }).from(redeemCodes);

    const list = await db.select({
      id: redeemCodes.id,
      code: redeemCodes.code,
      type: redeemCodes.type,
      value: redeemCodes.value,
      usesTotal: redeemCodes.usesTotal,
      usesLeft: redeemCodes.usesLeft,
      expiresAt: redeemCodes.expiresAt,
      isActive: redeemCodes.isActive,
      createdAt: redeemCodes.createdAt,
    })
      .from(redeemCodes)
      .orderBy(desc(redeemCodes.createdAt))
      .limit(limit)
      .offset(offset);

    res.json({
      total: Number(totalResult.value),
      page,
      limit,
      data: list,
    });
  } catch (err: any) {
    console.error("[ADMIN] Redeem list error:", err);
    res.status(500).json({ error: "获取兑换码列表失败" });
  }
});

router.post("/redeem/manual", async (req, res) => {
  try {
    const { userId, type, value } = req.body;

    if (!userId || !type || !value) {
      res.status(400).json({ error: "缺少参数: userId, type, value" });
      return;
    }

    // 创建一条虚拟兑换码记录
    const code = `MANUAL_${Date.now()}`;
    const [redeem] = await db.insert(redeemCodes).values({
      code,
      type,
      value,
      usesTotal: 1,
      usesLeft: 1,
      createdBy: req.admin!.id as any,
    }).returning();

    // 记录兑换
    await db.insert(redeemLogs).values({
      codeId: redeem.id,
      userId: userId as any,
    });

    // 发放奖励
    if (type === 'token') {
      const existing = await db.select().from(userVips).where(eq(userVips.userId, userId)).limit(1);
      if (existing.length > 0) {
        await db.update(userVips)
          .set({ tokenBalance: sql`${userVips.tokenBalance} + ${value}`, updatedAt: sql`NOW()` })
          .where(eq(userVips.userId, userId));
      }
    } else if (type === 'call') {
      await db.update(users)
        .set({ monthlyAiCount: sql`${users.monthlyAiCount} + ${value}`, updatedAt: sql`NOW()` })
        .where(eq(users.id, userId));
    } else if (type === 'vip') {
      // 手动发放VIP
      const now = new Date();
      const existing = await db.select().from(userVips).where(eq(userVips.userId, userId)).limit(1);
      if (existing.length > 0) {
        await db.update(userVips)
          .set({ planType: 'monthly', endDate: new Date(now.getTime() + value * 86400000).toISOString(), updatedAt: sql`NOW()` })
          .where(eq(userVips.userId, userId));
      } else {
        await db.insert(userVips).values({
          userId: userId as any,
          planType: 'monthly',
          endDate: new Date(now.getTime() + value * 86400000).toISOString(),
          monthlyQuota: 9999,
          dailyQuota: 999,
        });
      }
    }

    res.json({ success: true, message: "发放成功" });
  } catch (err: any) {
    console.error("[ADMIN] Manual redeem error:", err);
    res.status(500).json({ error: "手动发放失败" });
  }
});

router.get("/redeem/logs", async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    const [totalResult] = await db.select({ value: count() }).from(redeemLogs);

    const list = await db.select({
      id: redeemLogs.id,
      codeId: redeemLogs.codeId,
      code: redeemCodes.code,
      type: redeemCodes.type,
      value: redeemCodes.value,
      userId: redeemLogs.userId,
      userPhone: users.phone,
      userName: users.nickname,
      createdAt: redeemLogs.createdAt,
    })
      .from(redeemLogs)
      .leftJoin(redeemCodes, eq(redeemLogs.codeId, redeemCodes.id))
      .leftJoin(users, eq(redeemLogs.userId, users.id))
      .orderBy(desc(redeemLogs.createdAt))
      .limit(limit)
      .offset(offset);

    res.json({
      total: Number(totalResult.value),
      page,
      limit,
      data: list,
    });
  } catch (err: any) {
    console.error("[ADMIN] Redeem logs error:", err);
    res.status(500).json({ error: "获取兑换记录失败" });
  }
});

// ==================== 内容审核 ====================

router.get("/posts", async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    const [totalResult] = await db.select({ value: count() }).from(posts);

    const list = await db.select()
      .from(posts)
      .orderBy(desc(posts.createdAt))
      .limit(limit)
      .offset(offset);

    res.json({
      total: Number(totalResult.value),
      page,
      limit,
      data: list,
    });
  } catch (err: any) {
    console.error("[ADMIN] Posts list error:", err);
    res.status(500).json({ error: "获取帖子列表失败" });
  }
});

router.delete("/posts/:id", async (req, res) => {
  try {
    await db.delete(posts).where(eq(posts.id, req.params.id as any));
    // 同时删除相关评论
    await db.delete(comments).where(eq(comments.postId, req.params.id as any));
    res.json({ success: true, message: "已删除" });
  } catch (err: any) {
    console.error("[ADMIN] Delete post error:", err);
    res.status(500).json({ error: "删除帖子失败" });
  }
});

export default router;