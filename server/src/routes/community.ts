import { Router, type Request, type Response } from "express";
import { getSupabaseClient } from "../storage/database/supabase-client.js";
import { db } from "../storage/database/client.js";
import { posts, comments, postLikes, follows, users } from "../storage/database/shared/schema.js";
import { eq, and, desc, count, like, or } from "drizzle-orm";
import { toCamelCase } from "../utils/case-transform.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();

// ==================== 读操作（公开，可选认证） ====================

// GET /api/v1/community - 获取帖子列表
router.get("/", async (req: Request, res: Response) => {
  try {
    const { tag } = req.query;

    const conditions = tag && tag !== "B 全部" ? eq(posts.tag, tag as string) : undefined;
    const data = await db.select().from(posts)
      .where(conditions)
      .orderBy(desc(posts.createdAt));
    const result = data.map((row: any) => toCamelCase(row));
    res.json({ success: true, data: result });
  } catch (err) {
    console.error("Get posts error:", err);
    res.status(500).json({ success: false, error: "服务器错误" });
  }
});

// GET /api/v1/community/hot - 热门推荐
router.get("/hot", async (_req: Request, res: Response) => {
  try {
    const data = await db.select().from(posts)
      .orderBy(desc(posts.likes), desc(posts.comments))
      .limit(10);

    res.json({ success: true, data: data.map((row: any) => toCamelCase(row)) });
  } catch (err) {
    console.error("Get hot posts error:", err);
    res.status(500).json({ success: false, error: "获取热门帖子失败" });
  }
});

// GET /api/v1/community/search - 搜索帖子
router.get("/search", async (req: Request, res: Response) => {
  try {
    const { q } = req.query;
    if (!q || typeof q !== "string") {
      return res.status(400).json({ success: false, error: "请输入搜索关键词" });
    }

    const data = await db.select().from(posts)
      .where(or(
        like(posts.title, `%${q}%`),
        like(posts.content, `%${q}%`),
        like(posts.userName, `%${q}%`),
      ))
      .orderBy(desc(posts.createdAt))
      .limit(20);

    res.json({ success: true, data: data.map((row: any) => toCamelCase(row)) });
  } catch (err) {
    console.error("Search posts error:", err);
    res.status(500).json({ success: false, error: "搜索失败" });
  }
});

// GET /api/v1/community/follow/check - 检查是否已关注
router.get("/follow/check", async (req: Request, res: Response) => {
  try {
    const { followingName } = req.query;
    if (!req.user || !followingName) {
      return res.json({ success: true, data: false });
    }

    const result = await db.select().from(follows)
      .innerJoin(users, eq(follows.followingId, users.id))
      .where(and(
        eq(follows.followerId, req.user.id),
        eq(users.nickname, followingName as string),
      ))
      .limit(1);

    res.json({ success: true, data: result.length > 0 });
  } catch (err) {
    console.error("Check follow error:", err);
    res.status(500).json({ success: false, error: "服务器错误" });
  }
});

// GET /api/v1/community/user/:userName - 用户主页信息
router.get("/user/:userName", async (req: Request, res: Response) => {
  try {
    const { userName } = req.params;

    // 先找用户ID
    const [user] = await db.select().from(users)
      .where(eq(users.nickname, userName as string))
      .limit(1);

    if (!user) {
      return res.status(404).json({ success: false, error: "用户不存在" });
    }

    const [postsRes, followersRes, followingRes] = await Promise.all([
      db.select().from(posts)
        .where(eq(posts.userId, user.id))
        .orderBy(desc(posts.createdAt)),
      db.select({ count: count() }).from(follows)
        .where(eq(follows.followingId, user.id)),
      db.select({ count: count() }).from(follows)
        .where(eq(follows.followerId, user.id)),
    ]);

    res.json({
      success: true,
      data: {
        userName,
        userId: user.id,
        avatar: user.avatar || "",
        bio: user.bio || "",
        posts: postsRes.map((row: any) => toCamelCase(row)),
        followers: followersRes[0]?.count || 0,
        following: followingRes[0]?.count || 0,
      },
    });
  } catch (err) {
    console.error("Get user error:", err);
    res.status(500).json({ success: false, error: "服务器错误" });
  }
});

// ==================== 我的帖子（需要登录，必须放在/:id之前） ====================

// GET /api/v1/community/my-posts - 获取当前用户自己的帖子
router.get("/my-posts", authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: "请先登录" });

    // 游客用户ID不是UUID格式，直接返回空
    if (typeof req.user.id === 'string' && req.user.id.startsWith('guest_')) {
      return res.json({ success: true, data: [] });
    }

    const data = await db.select().from(posts)
      .where(eq(posts.userId, req.user.id))
      .orderBy(desc(posts.createdAt));

    res.json({ success: true, data: data.map((row: any) => ({
      ...toCamelCase(row),
      status: "published",
      views: 0,
      likes: row.likes || 0,
      summary: (row.content || "").slice(0, 100),
    })) });
  } catch (err) {
    console.error("Get my posts error:", err);
    res.status(500).json({ success: false, error: "获取失败" });
  }
});

// DELETE /api/v1/community/my-posts/:id - 删除自己的帖子
router.delete("/my-posts/:id", authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: "请先登录" });

    const { id } = req.params;
    const [post] = await db.select().from(posts)
      .where(eq(posts.id, id as string))
      .limit(1);

    if (!post) return res.status(404).json({ success: false, error: "帖子不存在" });
    if (post.userId !== req.user.id) return res.status(403).json({ success: false, error: "无权限删除" });

    await db.delete(posts).where(eq(posts.id, id as string));
    res.json({ success: true, message: "删除成功" });
  } catch (err) {
    console.error("Delete my post error:", err);
    res.status(500).json({ success: false, error: "删除失败" });
  }
});

// ==================== 动态参数路由（必须放在最后） ====================

// GET /api/v1/community/:id - 获取帖子详情
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const [post] = await db.select().from(posts).where(eq(posts.id, id as string)).limit(1);

    if (!post) {
      return res.status(404).json({ success: false, error: "帖子不存在" });
    }

    // 检查当前用户是否已点赞
    let isLiked = false;
    if (req.user) {
      const [likeRecord] = await db.select().from(postLikes)
        .where(and(eq(postLikes.postId, id as string), eq(postLikes.userId, req.user.id)))
        .limit(1);
      isLiked = !!likeRecord;
    }

    res.json({
      success: true,
      data: {
        ...toCamelCase(post),
        isLiked,
      },
    });
  } catch (err) {
    console.error("Get post error:", err);
    res.status(500).json({ success: false, error: "服务器错误" });
  }
});

// GET /api/v1/community/:id/comments - 获取评论（嵌套结构）
router.get("/:id/comments", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const data = await db.select().from(comments)
      .where(eq(comments.postId, id as string))
      .orderBy(comments.createdAt);

    const allComments = data.map((row: any) => toCamelCase(row));
    const topLevel = allComments.filter((c: any) => !c.parentId);
    const replies = allComments.filter((c: any) => c.parentId);

    const nest = (commentList: any[]) => commentList.map((c: any) => ({
      ...c,
      replies: replies.filter((r: any) => r.parentId === c.id),
    }));

    res.json({ success: true, data: nest(topLevel) });
  } catch (err) {
    console.error("Get comments error:", err);
    res.status(500).json({ success: false, error: "获取评论失败" });
  }
});

// ==================== 写操作（需要登录） ====================
router.post("/", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { title, content, tag } = req.body;
    if (!title?.trim()) {
      return res.status(400).json({ success: false, error: "请输入标题" });
    }

    if (!req.user) {
      return res.status(401).json({ success: false, error: "请先登录" });
    }

    const [newPost] = await db.insert(posts).values({
      userId: req.user.id,
      userName: req.user.nickname || "匿名用户",
      title: title.trim(),
      content: content || "",
      tag: tag || "B 全部",
      likes: 0,
      comments: 0,
      featured: 0,
    }).returning();

    res.json({ success: true, data: toCamelCase(newPost) });
  } catch (err) {
    console.error("Create post error:", err);
    res.status(500).json({ success: false, error: "创建帖子失败" });
  }
});

// POST /api/v1/community/:id/comments - 创建评论
router.post("/:id/comments", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { content, parentId } = req.body;
    if (!content?.trim()) {
      return res.status(400).json({ success: false, error: "请输入评论内容" });
    }

    if (!req.user) {
      return res.status(401).json({ success: false, error: "请先登录" });
    }

    // 检查帖子是否存在
    const [post] = await db.select().from(posts).where(eq(posts.id, id as string)).limit(1);
    if (!post) {
      return res.status(404).json({ success: false, error: "帖子不存在" });
    }

    const [newComment] = await db.insert(comments).values({
      postId: id as string,
      userId: req.user.id,
      userName: req.user.nickname || "匿名用户",
      content: content.trim(),
      parentId: parentId || null,
      likes: 0,
    }).returning();

    // 原子递增评论数
    await db.update(posts)
      .set({ comments: (post.comments || 0) + 1 })
      .where(eq(posts.id, id as string));

    res.json({ success: true, data: toCamelCase(newComment) });
  } catch (err) {
    console.error("Create comment error:", err);
    res.status(500).json({ success: false, error: "评论失败" });
  }
});

// DELETE /api/v1/community/comments/:commentId - 删除评论
router.delete("/comments/:commentId", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { commentId } = req.params;

    if (!req.user) {
      return res.status(401).json({ success: false, error: "请先登录" });
    }

    // 获取评论信息
    const [comment] = await db.select().from(comments)
      .where(eq(comments.id, commentId as string))
      .limit(1);

    if (!comment) {
      return res.status(404).json({ success: false, error: "评论不存在" });
    }

    // 校验权限：只能删除自己的评论
    if (comment.userId !== req.user.id) {
      return res.status(403).json({ success: false, error: "无权限删除该评论" });
    }

    // 统计该帖子下的评论数（用于计算级联删除后的准确数量）
    const beforeComments = await db.select().from(comments)
      .where(eq(comments.postId, comment.postId));

    // 删除评论（数据库会级联删除子评论）
    await db.delete(comments).where(eq(comments.id, commentId as string));

    // 重新统计并更新帖子评论数
    const afterComments = await db.select().from(comments)
      .where(eq(comments.postId, comment.postId));

    await db.update(posts)
      .set({ comments: afterComments.length })
      .where(eq(posts.id, comment.postId));

    res.json({ success: true, message: "删除成功" });
  } catch (err) {
    console.error("Delete comment error:", err);
    res.status(500).json({ success: false, error: "删除失败" });
  }
});

// PUT /api/v1/community/:id/like - 点赞/取消点赞（切换）
router.put("/:id/like", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const pid = id as string;

    if (!req.user) {
      return res.status(401).json({ success: false, error: "请先登录" });
    }

    // 检查帖子是否存在
    const [post] = await db.select().from(posts).where(eq(posts.id, pid)).limit(1);
    if (!post) {
      return res.status(404).json({ success: false, error: "帖子不存在" });
    }

    // 检查是否已点赞
    const [existingLike] = await db.select().from(postLikes)
      .where(and(eq(postLikes.postId, pid), eq(postLikes.userId, req.user.id)))
      .limit(1);

    if (existingLike) {
      // 取消点赞
      await db.delete(postLikes)
        .where(eq(postLikes.id, existingLike.id));
      const newLikes = Math.max(0, (post.likes || 0) - 1);
      await db.update(posts).set({ likes: newLikes }).where(eq(posts.id, pid));
      res.json({ success: true, data: { likes: newLikes, isLiked: false } });
    } else {
      // 点赞
      await db.insert(postLikes).values({
        postId: pid,
        userId: req.user.id,
      });
      const newLikes = (post.likes || 0) + 1;
      await db.update(posts).set({ likes: newLikes }).where(eq(posts.id, pid));
      res.json({ success: true, data: { likes: newLikes, isLiked: true } });
    }
  } catch (err) {
    console.error("Like post error:", err);
    res.status(500).json({ success: false, error: "操作失败" });
  }
});

// POST /api/v1/community/follow - 关注用户
router.post("/follow", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { followingName } = req.body;
    if (!followingName) {
      return res.status(400).json({ success: false, error: "参数不完整" });
    }

    if (!req.user) {
      return res.status(401).json({ success: false, error: "请先登录" });
    }

    // 不能关注自己
    if (req.user.nickname === followingName) {
      return res.status(400).json({ success: false, error: "不能关注自己" });
    }

    // 查找被关注用户
    const [followingUser] = await db.select().from(users)
      .where(eq(users.nickname, followingName))
      .limit(1);

    if (!followingUser) {
      return res.status(404).json({ success: false, error: "用户不存在" });
    }

    // 检查是否已关注
    const [existingFollow] = await db.select().from(follows)
      .where(and(
        eq(follows.followerId, req.user.id),
        eq(follows.followingId, followingUser.id),
      ))
      .limit(1);

    if (existingFollow) {
      return res.status(409).json({ success: false, error: "已关注该用户" });
    }

    const [newFollow] = await db.insert(follows).values({
      followerId: req.user.id,
      followingId: followingUser.id,
    }).returning();

    res.json({ success: true, data: toCamelCase(newFollow) });
  } catch (err) {
    console.error("Follow error:", err);
    res.status(500).json({ success: false, error: "关注失败" });
  }
});

// DELETE /api/v1/community/follow - 取消关注
router.delete("/follow", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { followingName } = req.body;
    if (!followingName) {
      return res.status(400).json({ success: false, error: "参数不完整" });
    }

    if (!req.user) {
      return res.status(401).json({ success: false, error: "请先登录" });
    }

    // 查找被关注用户
    const [followingUser] = await db.select().from(users)
      .where(eq(users.nickname, followingName))
      .limit(1);

    if (!followingUser) {
      return res.status(404).json({ success: false, error: "用户不存在" });
    }

    await db.delete(follows)
      .where(and(
        eq(follows.followerId, req.user.id),
        eq(follows.followingId, followingUser.id),
      ));

    res.json({ success: true, message: "已取消关注" });
  } catch (err) {
    console.error("Unfollow error:", err);
    res.status(500).json({ success: false, error: "取消关注失败" });
  }
});

// DELETE /api/v1/community/:id - 删除帖子
router.delete("/:id", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const pid = id as string;

    if (!req.user) {
      return res.status(401).json({ success: false, error: "请先登录" });
    }

    const [post] = await db.select().from(posts)
      .where(eq(posts.id, pid))
      .limit(1);

    if (!post) {
      return res.status(404).json({ success: false, error: "帖子不存在" });
    }

    // 校验权限：只能删除自己的帖子
    if (post.userId !== req.user.id) {
      return res.status(403).json({ success: false, error: "无权限删除该帖子" });
    }

    await db.delete(posts).where(eq(posts.id, pid));

    res.json({ success: true, message: "删除成功" });
  } catch (err) {
    console.error("Delete post error:", err);
    res.status(500).json({ success: false, error: "删除失败" });
  }
});

export default router;
