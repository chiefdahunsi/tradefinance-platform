import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import path from "path";

import authRoutes from "./routes/auth";
import businessRoutes from "./routes/business";
import applicationRoutes from "./routes/applications";
import documentRoutes from "./routes/documents";
import kycRoutes from "./routes/kyc";
import analystRoutes from "./routes/analyst";
import adminRoutes from "./routes/admin";
import notificationRoutes from "./routes/notifications";
import { apiLimiter } from "./middleware/rate-limit";

const app = express();
const PORT = process.env.PORT || 4000;

// ─── Security headers ────────────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }, // allow signed S3 URLs to load
  contentSecurityPolicy: false, // handled by Next.js on frontend
}));

// ─── CORS ────────────────────────────────────────────────────────────────────
app.use(cors({
  origin: [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    process.env.WEB_URL || "",
  ].filter(Boolean),
  credentials: true,
}));

// ─── Logging ─────────────────────────────────────────────────────────────────
app.use(morgan("dev"));

// ─── Body parsing ────────────────────────────────────────────────────────────
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// ─── Rate limit all API routes ───────────────────────────────────────────────
app.use("/api", apiLimiter);

// ─── Health + static ─────────────────────────────────────────────────────────
app.get("/health", (_, res) => res.json({ status: "ok", timestamp: new Date().toISOString() }));
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/business", businessRoutes);
app.use("/api/applications", applicationRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/kyc", kycRoutes);
app.use("/api/analyst", analystRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/notifications", notificationRoutes);

// ─── 404 handler ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} not found` });
});

// ─── Global error handler ────────────────────────────────────────────────────
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ success: false, message: "An unexpected error occurred. Please try again." });
});

app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
});

export default app;
