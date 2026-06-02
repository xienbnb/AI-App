import express from "express";
import cors from "cors";
import writingRouter from "./routes/writing.js";

const app = express();
const port = process.env.PORT || 9091;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Static files
app.use('/static', express.static('public'));

app.get('/api/v1/health', (req, res) => {
  console.log('Health check success');
  res.status(200).json({ status: 'ok' });
});

// Routes
app.use('/api/v1/writing', writingRouter);

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}/`);
});
