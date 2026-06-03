import express from "express";
import cors from "cors";
import writingRouter from "./routes/writing.js";
import aiRouter from "./routes/ai.js";
import communityRouter from "./routes/community.js";

const app = express();
const port = process.env.PORT || 9091;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Static files (under /api/v1 so the proxy forwards them correctly)
app.use('/api/v1/static', express.static('public'));

app.get('/api/v1/health', (req, res) => {
  console.log('Health check success');
  res.status(200).json({ status: 'ok' });
});

// Routes
app.use('/api/v1/writing', writingRouter);
app.use('/api/v1/ai', aiRouter);
app.use('/api/v1/community', communityRouter);

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}/`);
});
