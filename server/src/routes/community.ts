import { Router, type Request, type Response } from "express";
import { getSupabaseClient } from "../storage/database/supabase-client.js";
import { toCamelCase } from "../utils/case-transform.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// ==================== 静态路由（必须在 /:id 之前） ====================

// GET /api/v1/community - 获取帖子列表
router.get("/", async (req: Request, res: Response) => {
  try {
    const { tag } = req.query;
    const client = getSupabaseClient();

    let query = client.from("posts").select("*").order("created_at", { ascending: false });

    if (tag && tag !== "B 全部") {
      query = query.eq("tag", tag as string);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Get posts error:", error);
      return res.status(500).json({ success: false, message: "获取帖子失败" });
    }

    const posts = (data || []).map((row: any) => toCamelCase(row));
    res.json({ success: true, data: posts });
  } catch (err) {
    console.error("Get posts error:", err);
    res.status(500).json({ success: false, message: "服务器错误" });
  }
});

// POST /api/v1/community - 创建帖子
router.post("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const { title, content, tag } = req.body;
    if (!title?.trim()) {
      return res.status(400).json({ success: false, message: "请输入标题" });
    }

    const client = getSupabaseClient();
    const { data, error } = await client.from("posts").insert({
      user_id: req.user!.id,
      user_name: req.user!.nickname || req.user!.id,
      title: title.trim(),
      content: content || "",
      tag: tag || "B 全部",
      likes: 0,
      comments: 0,
      featured: 0,
    }).select().single();

    if (error) {
      console.error("Create post error:", error);
      return res.status(500).json({ success: false, message: "创建帖子失败" });
    }

    res.json({ success: true, data: toCamelCase(data) });
  } catch (err) {
    console.error("Create post error:", err);
    res.status(500).json({ success: false, message: "服务器错误" });
  }
});

// GET /api/v1/community/hot - 热门推荐
router.get("/hot", async (_req: Request, res: Response) => {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client.from("posts")
      .select("*")
      .order("likes", { ascending: false })
      .order("comments", { ascending: false })
      .limit(10);

    if (error) {
      console.error("Get hot posts error:", error);
      return res.status(500).json({ success: false, message: "获取热门帖子失败" });
    }

    res.json({ success: true, data: (data || []).map((row: any) => toCamelCase(row)) });
  } catch (err) {
    console.error("Get hot posts error:", err);
    res.status(500).json({ success: false, message: "服务器错误" });
  }
});

// GET /api/v1/community/search - 搜索帖子
router.get("/search", async (req: Request, res: Response) => {
  try {
    const { q } = req.query;
    if (!q || typeof q !== "string") {
      return res.status(400).json({ success: false, message: "请输入搜索关键词" });
    }
    const client = getSupabaseClient();
    const { data, error } = await client.from("posts")
      .select("*")
      .or(`title.ilike.%${q}%,content.ilike.%${q}%,user_name.ilike.%${q}%`)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      console.error("Search posts error:", error);
      return res.status(500).json({ success: false, message: "搜索失败" });
    }

    res.json({ success: true, data: (data || []).map((row: any) => toCamelCase(row)) });
  } catch (err) {
    console.error("Search posts error:", err);
    res.status(500).json({ success: false, message: "服务器错误" });
  }
});

// POST /api/v1/community/follow - 关注用户
router.post("/follow", requireAuth, async (req: Request, res: Response) => {
  try {
    const { followingName } = req.body;
    if (!followingName) {
      return res.status(400).json({ success: false, message: "参数不完整" });
    }
    if (req.user!.nickname === followingName) {
      return res.status(400).json({ success: false, message: "不能关注自己" });
    }

    const client = getSupabaseClient();
    const { data, error } = await client.from("follows").insert({
      follower_name: req.user!.nickname || req.user!.id,
      following_name: followingName,
    }).select().single();

    if (error) {
      if ((error as any).code === "23505") {
        return res.status(409).json({ success: false, message: "已关注该用户" });
      }
      console.error("Follow error:", error);
      return res.status(500).json({ success: false, message: "关注失败" });
    }

    res.json({ success: true, data: toCamelCase(data) });
  } catch (err) {
    console.error("Follow error:", err);
    res.status(500).json({ success: false, message: "服务器错误" });
  }
});

// DELETE /api/v1/community/follow - 取消关注
router.delete("/follow", requireAuth, async (req: Request, res: Response) => {
  try {
    const { followingName } = req.body;
    if (!followingName) {
      return res.status(400).json({ success: false, message: "参数不完整" });
    }

    const client = getSupabaseClient();
    const { error } = await client.from("follows")
      .delete()
      .eq("follower_name", req.user!.nickname || req.user!.id)
      .eq("following_name", followingName);

    if (error) {
      console.error("Unfollow error:", error);
      return res.status(500).json({ success: false, message: "取消关注失败" });
    }

    res.json({ success: true, message: "已取消关注" });
  } catch (err) {
    console.error("Unfollow error:", err);
    res.status(500).json({ success: false, message: "服务器错误" });
  }
});

// GET /api/v1/community/follow/check - 检查是否已关注
router.get("/follow/check", async (req: Request, res: Response) => {
  try {
    const { followerName, followingName } = req.query;
    if (!followerName || !followingName) {
      return res.json({ success: true, data: false });
    }

    const client = getSupabaseClient();
    const { data } = await client.from("follows")
      .select("id")
      .eq("follower_name", followerName as string)
      .eq("following_name", followingName as string)
      .maybeSingle();

    res.json({ success: true, data: !!data });
  } catch (err) {
    console.error("Check follow error:", err);
    res.status(500).json({ success: false, message: "服务器错误" });
  }
});

// GET /api/v1/community/user/:userName - 用户主页信息
router.get("/user/:userName", async (req: Request, res: Response) => {
  try {
    const { userName } = req.params;
    const client = getSupabaseClient();

    const [postsRes, followersRes, followingRes] = await Promise.all([
      client.from("posts").select("*").eq("user_name", userName).order("created_at", { ascending: false }),
      client.from("follows").select("id", { count: "exact", head: true }).eq("following_name", userName),
      client.from("follows").select("id", { count: "exact", head: true }).eq("follower_name", userName),
    ]);

    res.json({
      success: true,
      data: {
        userName,
        posts: (postsRes.data || []).map((row: any) => toCamelCase(row)),
        followers: followersRes.count || 0,
        following: followingRes.count || 0,
      },
    });
  } catch (err) {
    console.error("Get user error:", err);
    res.status(500).json({ success: false, message: "服务器错误" });
  }
});

// ==================== 动态路由（带 :id 参数，放在静态路由之后） ====================

// GET /api/v1/community/:id - 获取帖子详情
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const client = getSupabaseClient();
    const { data, error } = await client.from("posts").select("*").eq("id", id).single();

    if (error || !data) {
      return res.status(404).json({ success: false, message: "帖子不存在" });
    }

    res.json({ success: true, data: toCamelCase(data) });
  } catch (err) {
    console.error("Get post error:", err);
    res.status(500).json({ success: false, message: "服务器错误" });
  }
});

// GET /api/v1/community/:id/comments - 获取评论（嵌套结构）
router.get("/:id/comments", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const client = getSupabaseClient();
    const { data, error } = await client.from("comments")
      .select("*")
      .eq("post_id", id)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Get comments error:", error);
      return res.status(500).json({ success: false, message: "获取评论失败" });
    }

    const allComments = (data || []).map((row: any) => toCamelCase(row));
    const topLevel = allComments.filter((c: any) => !c.parentId);
    const replies = allComments.filter((c: any) => c.parentId);

    const nest = (comments: any[]) => comments.map((c: any) => ({
      ...c,
      replies: replies.filter((r: any) => r.parentId === c.id),
    }));

    res.json({ success: true, data: nest(topLevel) });
  } catch (err) {
    console.error("Get comments error:", err);
    res.status(500).json({ success: false, message: "服务器错误" });
  }
});

// POST /api/v1/community/:id/comments - 创建评论
router.post("/:id/comments", requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { content, parentId } = req.body;
    if (!content?.trim()) {
      return res.status(400).json({ success: false, message: "请输入评论内容" });
    }

    const client = getSupabaseClient();
    const { data, error } = await client.from("comments").insert({
      post_id: id,
      user_id: req.user!.id,
      user_name: req.user!.nickname || req.user!.id,
      content: content.trim(),
      parent_id: parentId || null,
    }).select().single();

    if (error) {
      console.error("Create comment error:", error);
      return res.status(500).json({ success: false, message: "评论失败" });
    }

    res.json({ success: true, data: toCamelCase(data) });
  } catch (err) {
    console.error("Create comment error:", err);
    res.status(500).json({ success: false, message: "服务器错误" });
  }
});

// DELETE /api/v1/community/comments/:commentId - 删除评论
router.delete("/comments/:commentId", requireAuth, async (req: Request, res: Response) => {
  try {
    const { commentId } = req.params;
    const client = getSupabaseClient();

    const { data: comment } = await client.from("comments").select("post_id, user_id").eq("id", commentId).single();
    if (!comment) {
      return res.status(404).json({ success: false, message: "评论不存在" });
    }

    // 只能删除自己的评论
    if ((comment as any).user_id !== req.user!.id) {
      return res.status(403).json({ success: false, message: "无权删除他人评论" });
    }

    const { error } = await client.from("comments").delete().eq("id", commentId);
    if (error) {
      console.error("Delete comment error:", error);
      return res.status(500).json({ success: false, message: "删除失败" });
    }

    const postId = (comment as any).post_id;
    const { data: post } = await client.from("posts").select("comments").eq("id", postId).single();
    const newCount = Math.max(0, ((post as any)?.comments || 0) - 1);
    await client.from("posts").update({ comments: newCount }).eq("id", postId);

    res.json({ success: true, message: "删除成功" });
  } catch (err) {
    console.error("Delete comment error:", err);
    res.status(500).json({ success: false, message: "服务器错误" });
  }
});

// PUT /api/v1/community/:id/like - 点赞
router.put("/:id/like", requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const client = getSupabaseClient();

    const { data: existing } = await client.from("posts").select("likes").eq("id", id).single();
    if (!existing) {
      return res.status(404).json({ success: false, message: "帖子不存在" });
    }

    const newLikes = (existing.likes || 0) + 1;
    const { error } = await client.from("posts").update({ likes: newLikes }).eq("id", id);

    if (error) {
      return res.status(500).json({ success: false, message: "点赞失败" });
    }

    res.json({ success: true, data: { likes: newLikes } });
  } catch (err) {
    console.error("Like post error:", err);
    res.status(500).json({ success: false, message: "服务器错误" });
  }
});

export default router;