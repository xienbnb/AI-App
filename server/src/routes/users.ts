/**
 * 用户相关路由
 *
 * 功能：个人资料、统计、主题、AI设置、粉丝关注等
 *
 * @file /server/src/routes/users.ts
 */
import { Router, type Request, type Response } from "express";
import { getSupabaseClient } from "../storage/database/supabase-client.js";
import { requireAuth } from "../middleware/auth.js";
import multer from "multer";
import { S3Storage } from "coze-coding-dev-sdk";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const router = Router();

/**
 * GET /api/v1/users/stats
 * 获取用户真实统计数据
 */
router.get("/stats", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const client = getSupabaseClient();

    // 查询书籍列表（含章节数据计算字数）
    const { data: books, error: booksError } = await client
      .from("books")
      .select("id, title, word_count, chapter_count, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (booksError) throw new Error(`查询书籍失败: ${booksError.message}`);

    const bookCount = books?.length || 0;
    const totalWords = (books || []).reduce((sum: number, b: any) => sum + (b.word_count || 0), 0);

    // 查询用户信息（含连续天数、今日字数）
    const { data: userData } = await client
      .from("users")
      .select("consecutive_days, today_word_count, last_active_date")
      .eq("id", userId)
      .maybeSingle();

    const consecutiveDays = userData?.consecutive_days || 0;
    const todayWords = userData?.today_word_count || 0;

    res.json({
      bookCount,
      totalWords,
      consecutiveDays,
      todayWords,
    });
  } catch (err: any) {
    console.error("[USERS] Stats error:", err);
    res.status(500).json({ error: err.message || "获取统计失败" });
  }
});

/**
 * GET /api/v1/users/profile
 * 获取用户个人资料
 */
router.get("/profile", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const client = getSupabaseClient();

    const { data, error } = await client
      .from("users")
      .select("id, email, nickname, avatar, bio, pen_name, gender, phone, real_name, created_at")
      .eq("id", userId)
      .maybeSingle();

    if (error) throw new Error(`查询用户资料失败: ${error.message}`);
    if (!data) return res.status(404).json({ error: "用户不存在" });

    res.json({ user: data });
  } catch (err: any) {
    console.error("[USERS] Profile error:", err);
    res.status(500).json({ error: err.message || "获取资料失败" });
  }
});

/**
 * PUT /api/v1/users/profile
 * 更新用户个人资料
 * Body: { nickname?, bio?, pen_name?, gender?, phone?, avatar? }
 */
router.put("/profile", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { nickname, bio, pen_name, gender, phone, avatar } = req.body;
    const client = getSupabaseClient();

    const updates: Record<string, any> = {};
    if (nickname !== undefined) updates.nickname = nickname;
    if (bio !== undefined) updates.bio = bio;
    if (pen_name !== undefined) updates.pen_name = pen_name;
    if (gender !== undefined) updates.gender = gender;
    if (phone !== undefined) updates.phone = phone;
    if (avatar !== undefined) updates.avatar = avatar;
    updates.updated_at = new Date().toISOString();

    // 注意：real_name 不允许通过此接口修改（仅管理员或实名认证流程可修改）

    const { data, error } = await client
      .from("users")
      .update(updates)
      .eq("id", userId)
      .select("id, email, nickname, avatar, bio, pen_name, gender, phone")
      .maybeSingle();

    if (error) throw new Error(`更新资料失败: ${error.message}`);

    res.json({ success: true, user: data });
  } catch (err: any) {
    console.error("[USERS] Update profile error:", err);
    res.status(500).json({ error: err.message || "更新资料失败" });
  }
});

/**
 * POST /api/v1/users/avatar
 * 上传头像（multipart/form-data）
 */
router.post("/avatar", requireAuth, upload.single("avatar"), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "请选择头像图片" });
      return;
    }

    const storage = new S3Storage({
      endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
      bucketName: process.env.COZE_BUCKET_NAME,
      region: "cn-beijing",
    });

    const ext = req.file.originalname.split(".").pop() || "jpg";
    const fileName = `avatars/${req.user!.id}_${Date.now()}.${ext}`;

    // 上传到对象存储，获取实际 key
    const fileKey = await storage.uploadFile({
      fileContent: req.file.buffer,
      fileName,
      contentType: req.file.mimetype,
    });

    // 生成签名 URL
    const avatarUrl = await storage.generatePresignedUrl({
      key: fileKey,
      expireTime: 86400 * 7, // 7天有效期
    });

    // 更新用户头像
    const client = getSupabaseClient();
    await client.from("users").update({ avatar: avatarUrl, updated_at: new Date().toISOString() }).eq("id", req.user!.id);

    res.json({ success: true, url: avatarUrl });
  } catch (err: any) {
    console.error("[USERS] Avatar upload error:", err);
    res.status(500).json({ error: err.message || "上传头像失败" });
  }
});

/**
 * GET /api/v1/users/theme
 * 获取用户主题设置
 */
router.get("/theme", requireAuth, async (req: Request, res: Response) => {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from("users")
      .select("theme")
      .eq("id", req.user!.id)
      .maybeSingle();

    if (error) throw new Error(`查询主题失败: ${error.message}`);

    res.json({ theme: data?.theme || "system" });
  } catch (err: any) {
    console.error("[USERS] Theme error:", err);
    res.status(500).json({ error: err.message || "获取主题失败" });
  }
});

/**
 * PUT /api/v1/users/theme
 * 更新用户主题设置
 * Body: { theme: string }
 */
router.put("/theme", requireAuth, async (req: Request, res: Response) => {
  try {
    const { theme } = req.body;
    if (!theme || !["system", "light", "dark", "sepia", "green"].includes(theme)) {
      res.status(400).json({ error: "无效的主题" });
      return;
    }

    const client = getSupabaseClient();
    const { error } = await client
      .from("users")
      .update({ theme, updated_at: new Date().toISOString() })
      .eq("id", req.user!.id);

    if (error) throw new Error(`更新主题失败: ${error.message}`);

    res.json({ success: true, theme });
  } catch (err: any) {
    console.error("[USERS] Update theme error:", err);
    res.status(500).json({ error: err.message || "更新主题失败" });
  }
});

/**
 * GET /api/v1/users/ai-settings
 * 获取用户AI模型设置
 */
router.get("/ai-settings", requireAuth, async (req: Request, res: Response) => {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from("users")
      .select("ai_settings")
      .eq("id", req.user!.id)
      .maybeSingle();

    if (error) throw new Error(`查询AI设置失败: ${error.message}`);

    res.json({ settings: data?.ai_settings || {} });
  } catch (err: any) {
    console.error("[USERS] AI settings error:", err);
    res.status(500).json({ error: err.message || "获取AI设置失败" });
  }
});

/**
 * PUT /api/v1/users/ai-settings
 * 保存用户AI模型设置
 * Body: { settings: object }
 */
router.put("/ai-settings", requireAuth, async (req: Request, res: Response) => {
  try {
    const { settings } = req.body;
    if (!settings) {
      res.status(400).json({ error: "设置不能为空" });
      return;
    }

    const client = getSupabaseClient();
    const { error } = await client
      .from("users")
      .update({ ai_settings: settings, updated_at: new Date().toISOString() })
      .eq("id", req.user!.id);

    if (error) throw new Error(`保存AI设置失败: ${error.message}`);

    res.json({ success: true });
  } catch (err: any) {
    console.error("[USERS] Save AI settings error:", err);
    res.status(500).json({ error: err.message || "保存AI设置失败" });
  }
});

/**
 * POST /api/v1/users/feedback
 * 提交用户反馈
 * Body: { content: string, contact?: string }
 */
router.post("/feedback", requireAuth, async (req: Request, res: Response) => {
  try {
    const { content, contact } = req.body;
    if (!content || !content.trim()) {
      res.status(400).json({ error: "反馈内容不能为空" });
      return;
    }

    const client = getSupabaseClient();
    const { error } = await client.from("feedback").insert({
      user_id: req.user!.id,
      content: content.trim(),
      contact: contact || "",
      created_at: new Date().toISOString(),
    });

    if (error) throw new Error(`提交反馈失败: ${error.message}`);

    res.json({ success: true, message: "感谢您的反馈！" });
  } catch (err: any) {
    console.error("[USERS] Feedback error:", err);
    res.status(500).json({ error: err.message || "提交反馈失败" });
  }
});

/**
 * GET /api/v1/users/followers
 * 获取用户的粉丝列表
 */
router.get("/followers", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string || req.user!.id;
    const client = getSupabaseClient();

    const { data, error } = await client
      .from("follows")
      .select("follower_id, created_at, follower:users!follower_id(id, nickname, avatar, bio)")
      .eq("following_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(`查询粉丝失败: ${error.message}`);

    res.json({ data: data || [] });
  } catch (err: any) {
    console.error("[USERS] Followers error:", err);
    res.status(500).json({ error: err.message || "获取粉丝列表失败" });
  }
});

/**
 * GET /api/v1/users/following
 * 获取用户关注列表
 */
router.get("/following", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string || req.user!.id;
    const client = getSupabaseClient();

    const { data, error } = await client
      .from("follows")
      .select("following_id, created_at, following:users!following_id(id, nickname, avatar, bio)")
      .eq("follower_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(`查询关注失败: ${error.message}`);

    res.json({ data: data || [] });
  } catch (err: any) {
    console.error("[USERS] Following error:", err);
    res.status(500).json({ error: err.message || "获取关注列表失败" });
  }
});

/**
 * GET /api/v1/users/activities
 * 获取用户动态（最近的作品更新）
 */
router.get("/activities", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string || req.user!.id;
    const client = getSupabaseClient();

    // 查询用户的书籍更新时间线
    const { data: books, error: booksError } = await client
      .from("books")
      .select("id, title, word_count, updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(20);

    if (booksError) throw new Error(`查询动态失败: ${booksError.message}`);

    // 查询社区帖子
    const { data: posts } = await client
      .from("posts")
      .select("id, title, content, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10);

    const activities = [
      ...(books || []).map((b: any) => ({
        type: "book_update",
        id: b.id,
        title: b.title,
        desc: `更新了作品，当前 ${b.word_count || 0} 字`,
        time: b.updated_at,
      })),
      ...(posts || []).map((p: any) => ({
        type: "post",
        id: p.id,
        title: p.title,
        desc: p.content?.slice(0, 100),
        time: p.created_at,
      })),
    ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

    res.json({ data: activities });
  } catch (err: any) {
    console.error("[USERS] Activities error:", err);
    res.status(500).json({ error: err.message || "获取动态失败" });
  }
});

export default router;