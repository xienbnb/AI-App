import { Router, type Request, type Response } from "express";
import { exportUserData, importUserData, exportBook } from "../services/backup.service.js";

const router = Router();

// 导出全部数据
router.get("/export", async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: "未登录" });
    }

    const data = await exportUserData(userId);
    
    // 设置下载头
    const fileName = `写作数据_${new Date().toISOString().split('T')[0]}.json`;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
    
    res.json(data);
  } catch (err: any) {
    console.error("[BACKUP] Export error:", err);
    res.status(500).json({ success: false, error: err.message || "导出失败" });
  }
});

// 导入数据
router.post("/import", async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: "未登录" });
    }

    const { data, mode } = req.body;
    if (!data) {
      return res.status(400).json({ success: false, error: "导入数据不能为空" });
    }

    const result = await importUserData(userId, data, mode || 'merge');

    res.json({
      success: true,
      message: `导入完成，成功${result.imported}本，跳过${result.skipped}本`,
      data: result,
    });
  } catch (err: any) {
    console.error("[BACKUP] Import error:", err);
    res.status(500).json({ success: false, error: err.message || "导入失败" });
  }
});

// 导出单本书
router.get("/export/book/:bookId", async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: "未登录" });
    }

    const { bookId } = req.params;
    const data = await exportBook(userId, bookId as string);

    const fileName = `${data.book.title || '书籍'}_${new Date().toISOString().split('T')[0]}.json`;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);

    res.json(data);
  } catch (err: any) {
    console.error("[BACKUP] Export book error:", err);
    res.status(500).json({ success: false, error: err.message || "导出失败" });
  }
});

export default router;
