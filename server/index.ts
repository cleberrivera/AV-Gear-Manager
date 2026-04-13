import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import path from "node:path";
import fs from "node:fs";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "./routers";
import { createContext } from "./trpc";

const app = express();
const PORT = parseInt(process.env.PORT ?? "3000", 10);
const isDev = process.env.NODE_ENV === "development";

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));

// ─── Serve uploaded files ────────────────────────────────────────────────────
const uploadsDir = path.resolve("public/uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use("/uploads", express.static(uploadsDir));

// ─── tRPC API ────────────────────────────────────────────────────────────────
app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext: ({ req, res }) => createContext({ req, res }),
    onError: ({ error, path }) => {
      if (error.code === "INTERNAL_SERVER_ERROR") {
        console.error(`[tRPC Error] ${path}:`, error);
      }
    },
  })
);

// ─── Development: proxy to Vite ──────────────────────────────────────────────
if (isDev) {
  console.log(`[Server] API running on http://localhost:${PORT}`);
  console.log(`[Server] Frontend dev server at http://localhost:5173`);
} else {
  // ─── Production: serve static files ──────────────────────────────────────
  const staticDir = path.resolve("dist/public");
  if (fs.existsSync(staticDir)) {
    app.use(express.static(staticDir));
    // SPA fallback
    app.get("*", (_req, res) => {
      res.sendFile(path.join(staticDir, "index.html"));
    });
  }
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`[AV Gear Manager] Server running on http://localhost:${PORT}`);
  if (isDev) {
    // Show local network IP for smartphone access
    const nets = require("node:os").networkInterfaces();
    for (const name of Object.keys(nets)) {
      for (const net of nets[name] ?? []) {
        if (net.family === "IPv4" && !net.internal) {
          console.log(`[AV Gear Manager] Network: http://${net.address}:5173`);
        }
      }
    }
  }
});
