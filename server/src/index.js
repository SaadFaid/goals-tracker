import "dotenv/config";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import authRoutes from "./routes/auth.js";
import dashboardRoutes from "./routes/dashboard.js";
import categoryRoutes from "./routes/categories.js";
import actionRoutes from "./routes/actions.js";
import resultRoutes from "./routes/results.js";
import rewardRoutes from "./routes/rewards.js";
import progressRoutes from "./routes/progress.js";
import snapshotRoutes from "./routes/snapshots.js";
import syncRoutes from "./routes/sync.js";

const app = express();
const PORT = process.env.PORT || 4000;

app.use(helmet());
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Try again later." },
});

app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);

app.use("/api/auth", authRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/categories", actionRoutes); // POST /:catId/actions
app.use("/api/categories", resultRoutes); // POST /:catId/results
app.use("/api/categories", rewardRoutes); // POST /:catId/rewards
app.use("/api/actions", actionRoutes);
app.use("/api/results", resultRoutes);
app.use("/api/rewards", rewardRoutes);
app.use("/api/progress", progressRoutes);
app.use("/api/snapshots", snapshotRoutes);
app.use("/api/sync", syncRoutes);

app.get("/api/health", (_req, res) => res.json({ ok: true }));

// Serve the built frontend (same origin) when present: the build output lives
// in ../dist relative to server/ in the monorepo. This lets Render host the
// app and API on one origin so auth cookies work without cross-site friction.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.resolve(__dirname, "../../dist");
if (fs.existsSync(distPath)) {
  const clientBuild = express.static(distPath);
  app.use(clientBuild);
  app.get(/^\/(?!api\/).*/, (_req, res, next) => {
    const file = path.join(distPath, req.path);
    if (req.path !== "/" && fs.existsSync(file) && fs.statSync(file).isFile()) {
      return next();
    }
    res.sendFile(path.join(distPath, "index.html"));
  });
}

// 404
app.use((req, res) => {
  res.status(404).json({ error: `Not found: ${req.method} ${req.path}` });
});

// Central error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || (err.code === "P2025" ? 404 : 500);
  const message = err.status ? err.message : "Internal server error";
  const body = { error: message };
  if (err.currentSum !== undefined) body.currentSum = err.currentSum;
  if (status === 500) console.error(err);
  res.status(status).json(body);
});

app.listen(PORT, () => {
  console.log(`Tchizu Goal Tracker API listening on http://localhost:${PORT}`);
});
