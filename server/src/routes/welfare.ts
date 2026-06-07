import { Router } from "express";
import { db } from "../storage/database/client.js";
import { users, userTasks, userVips, posts, billingRecords } from "../storage/database/shared/schema.js";
import { authMiddleware } from "../middleware/auth.js";
import { eq, and, sql } from "drizzle-orm";
import { getOrCreateUserVip } from "../services/vip.service.js";

const router = Router();

// Task definitions with rewards
const TASK_DEFINITIONS = [
  // Daily tasks
  { type: "daily_checkin", title: "每日签到", desc: "每日签到领取", reward: { token: 1000 }, category: "daily" },
  { type: "daily_write_5000", title: "日写5000字", desc: "每日写作5000字领取", reward: { token: 2000 }, category: "daily" },
  // Achievement tasks
  { type: "new_user_reg", title: "新用户注册", desc: "注册登录即可领取", reward: { token: 3000 }, category: "achievement" },
  { type: "share_app", title: "分享给别人", desc: "分享应用给他人", reward: { token: 1000 }, category: "achievement" },
  { type: "bind_phone", title: "绑定手机号", desc: "绑定手机号领取", reward: { token: 5000 }, category: "achievement" },
  { type: "invite_friend", title: "邀请好友注册", desc: "邀请好友注册领取", reward: { token: 6000 }, category: "achievement" },
  // Call count earning
  { type: "watch_ad", title: "看广告", desc: "每次增加10次调用+1000字", reward: { calls: 10, token: 1000 }, category: "earning" },
  { type: "publish_post", title: "发布帖子/技能", desc: "发布内容领取", reward: { token: 1000 }, category: "earning" },
];

// GET /api/v1/welfare/tasks - 获取任务列表和完成状态
router.get("/tasks", authMiddleware, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    // Get user info for check-in date and daily words
    const [user] = await db.select({
      checkInDate: users.checkInDate,
      dailyWriteWords: users.dailyWriteWords,
    }).from(users).where(eq(users.id, userId));

    // Get completed tasks
    const completed = await db.select().from(userTasks)
      .where(eq(userTasks.userId, userId));

    const completedMap = new Map(completed.map(t => [t.taskType, t]));

    const today = new Date().toISOString().slice(0, 10);
    const isCheckedIn = user?.checkInDate === today;

    const tasks = TASK_DEFINITIONS.map(def => {
      const record = completedMap.get(def.type);
      let isCompleted = !!record?.completed;

      // Dynamic completion check for daily tasks
      if (def.type === "daily_checkin") isCompleted = isCheckedIn;
      if (def.type === "daily_write_5000") isCompleted = (user?.dailyWriteWords || 0) >= 5000;

      return {
        ...def,
        completed: isCompleted,
        rewardClaimed: record?.rewardClaimed || false,
        id: record?.id || null,
      };
    });

    res.json({ success: true, data: tasks });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/v1/welfare/claim - 领取任务奖励
router.post("/claim", authMiddleware, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const { taskType } = req.body;
    if (!userId || !taskType) return res.status(400).json({ error: "Missing params" });

    const taskDef = TASK_DEFINITIONS.find(t => t.type === taskType);
    if (!taskDef) return res.status(404).json({ error: "Task not found" });

    // Check if already claimed
    const existing = await db.select().from(userTasks)
      .where(and(eq(userTasks.userId, userId), eq(userTasks.taskType, taskType)));

    if (existing.length > 0 && existing[0].rewardClaimed) {
      return res.status(400).json({ error: "Already claimed" });
    }

    // Verify dynamic conditions
    if (taskType === "daily_checkin") {
      const [user] = await db.select({ checkInDate: users.checkInDate }).from(users).where(eq(users.id, userId));
      const today = new Date().toISOString().slice(0, 10);
      if (user?.checkInDate === today) return res.status(400).json({ error: "Already checked in today" });
      await db.update(users).set({ checkInDate: today }).where(eq(users.id, userId));
    }

    if (taskType === "daily_write_5000") {
      const [user] = await db.select({ dailyWriteWords: users.dailyWriteWords }).from(users).where(eq(users.id, userId));
      if (!user || (user.dailyWriteWords || 0) < 5000) {
        return res.status(400).json({ error: "Not enough words today" });
      }
    }

    if (taskType === "bind_phone") {
      const [user] = await db.select({ phone: users.phone, customApiKey: users.customApiKey }).from(users).where(eq(users.id, userId));
      // Guest users or users with custom key but no phone won't have phone
      if (!user?.phone) {
        return res.status(400).json({ error: "Phone not bound" });
      }
    }

    // Apply rewards
    const reward = taskDef.reward;
    const updates: any = {};
    if (reward.token) {
      // Ensure userVip record exists
      await getOrCreateUserVip(userId);
      // Update token balance in user_vips
      await db.update(userVips)
        .set({ tokenBalance: sql`COALESCE(token_balance, 0) + ${reward.token}` })
        .where(eq(userVips.userId, userId as any));
    }
      // Record the reward in billing history
      await db.insert(billingRecords).values({
        userId: userId as any,
        type: "reward",
        title: getTaskLabel(taskType),
        amount: reward.token,
        detail: "完成任务「" + getTaskLabel(taskType) + "」获得 " + reward.token + " Token",
        metadata: JSON.stringify({ taskType }),
      });
    if (reward.calls) {
      // For VIP users, unlimited calls - no need to add
      // For free users, we can't easily add monthly calls because it auto-resets
      // Instead, we add tokens which they can use
    }

    // Record task completion
    if (existing.length > 0) {
      await db.update(userTasks)
        .set({ completed: true, rewardClaimed: true, completedAt: new Date().toISOString() })
        .where(and(eq(userTasks.userId, userId), eq(userTasks.taskType, taskType)));
    } else {
      await db.insert(userTasks).values({
        userId,
        taskType,
        completed: true,
        rewardClaimed: true,
        metadata: { reward },
      });
    }

    res.json({ success: true, message: `Claimed ${reward.token || 0} tokens` });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/v1/welfare/watch-ad - 看广告（增加调用次数）
router.post("/watch-ad", authMiddleware, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    // Add tokens to user_vips
    await db.update(userVips)
      .set({ tokenBalance: sql`COALESCE(token_balance, 0) + 1000` })
      .where(eq(userVips.userId, userId));

    // Record task
    await db.insert(userTasks).values({
      userId,
      taskType: "watch_ad",
      completed: true,
      rewardClaimed: true,
      metadata: { reward: { calls: 10, token: 1000 } },
    });

    res.json({ success: true, message: "+10次调用 +1000字" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/v1/community/:id/tip - 打赏帖子
router.post("/tip/:postId", authMiddleware, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const { postId } = req.params;
    const { amount } = req.body;

    if (!amount || amount < 100) {
      return res.status(400).json({ error: "Minimum tip is 100 tokens" });
    }

    // Check sender's balance
    const [sender] = await db.select({
      tokenBalance: userVips.tokenBalance,
    }).from(userVips).where(eq(userVips.userId, userId));

    if (!sender || (sender.tokenBalance || 0) < amount) {
      return res.status(400).json({ error: "Insufficient tokens" });
    }

    // Get post author
    const [post] = await db.select({ userId: posts.userId })
      .from(posts)
      .where(eq(posts.id, postId as any));

    if (!post?.userId) {
      return res.status(404).json({ error: "Post not found" });
    }

    const authorId = post.userId;

    // Don't allow tipping yourself
    if (authorId === userId) {
      return res.status(400).json({ error: "Cannot tip yourself" });
    }

    // Transfer tokens
    await db.update(userVips)
      .set({ tokenBalance: sql`COALESCE(token_balance, 0) - ${amount}` })
      .where(eq(userVips.userId, userId));

    await db.update(userVips)
      .set({ tokenBalance: sql`COALESCE(token_balance, 0) + ${amount}` })
      .where(eq(userVips.userId, authorId));

    res.json({ success: true, message: `Tipped ${amount} tokens` });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;