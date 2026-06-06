import express from "express";
import cors from "cors";
import { ZodError } from "zod";
import writingRouter from "./routes/writing.js";
import aiRouter from "./routes/ai.js";
import communityRouter from "./routes/community.js";
import authRouter from "./routes/auth.js";
import usersRouter from "./routes/users.js";
import vipRouter from "./routes/vip.js";

const app = express();
const port = process.env.PORT || 9091;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Static files
app.use('/api/v1/static', express.static('public'));

app.get('/api/v1/health', (req, res) => {
  console.log('Health check success');
  res.status(200).json({ status: 'ok' });
});

// Routes
app.use('/api/v1/writing', writingRouter);
app.use('/api/v1/ai', aiRouter);
app.use('/api/v1/community', communityRouter);
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/users', usersRouter);
app.use('/api/v1/vip', vipRouter);

// ===== Global Error Handler =====
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(`[ERROR] ${req.method} ${req.path}:`, err?.message || err);

  // Zod validation errors
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: "参数校验失败",
      details: err.issues.map((e: any) => ({
        path: e.path?.join(".") || "",
        message: e.message,
      })),
    });
  }

  // Known HTTP errors
  if (err.statusCode) {
    return res.status(err.statusCode).json({
      error: err.message || "请求处理失败",
    });
  }

  // Default 500
  res.status(500).json({
    error: "服务器内部错误",
  });
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}/`);
});