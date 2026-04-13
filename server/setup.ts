/**
 * Auto-setup: creates .env, waits for MySQL, pushes schema, seeds admin.
 * Safe to run multiple times — all operations are idempotent.
 *
 * Usage:
 *   npx tsx server/setup.ts          (run standalone)
 *   import { setup } from './setup'  (call from code)
 */
import "dotenv/config";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import mysql from "mysql2/promise";

const ENV_PATH = path.resolve(".env");

// ─── 1. Create .env if missing ──────────────────────────────────────────────

async function ensureEnv() {
  if (fs.existsSync(ENV_PATH)) {
    console.log("[Setup] .env already exists, skipping creation");
    return;
  }

  const jwtSecret = crypto.randomBytes(32).toString("hex");
  const envContent = [
    "# ─── Database (Docker Compose default) ─────────────────────────",
    "DATABASE_URL=mysql://avmanager:avmanager123@localhost:3306/av_gear_manager",
    "",
    "# ─── Authentication ──────────────────────────────────────────────",
    `JWT_SECRET=${jwtSecret}`,
    "JWT_EXPIRES_IN=7d",
    "",
    "# ─── First admin account (email used on registration) ───────────",
    "ADMIN_EMAIL=admin@avmanager.com",
    "",
    "# ─── Server ──────────────────────────────────────────────────────",
    "PORT=3000",
    "",
    "# ─── SMTP (optional) ─────────────────────────────────────────────",
    "# SMTP_HOST=smtp.gmail.com",
    "# SMTP_PORT=587",
    "# SMTP_USER=your@email.com",
    "# SMTP_PASS=your-app-password",
    "# SMTP_FROM=AV Gear Manager <your@email.com>",
    "",
  ].join("\n");

  fs.writeFileSync(ENV_PATH, envContent);
  console.log("[Setup] Created .env with auto-generated JWT_SECRET");
  console.log("[Setup] Default admin email: admin@avmanager.com");

  // Reload env vars
  const dotenv = await import("dotenv");
  dotenv.config({ path: ENV_PATH, override: true });
}

// ─── 2. Wait for MySQL to be ready ──────────────────────────────────────────

async function waitForMySQL(maxRetries = 30, intervalMs = 2000): Promise<mysql.Connection> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set. Run setup again.");

  console.log("[Setup] Waiting for MySQL...");

  for (let i = 1; i <= maxRetries; i++) {
    try {
      const conn = await mysql.createConnection(url);
      await conn.ping();
      console.log("[Setup] MySQL is ready!");
      return conn;
    } catch (err: any) {
      if (i === maxRetries) {
        console.error(`[Setup] MySQL not reachable after ${maxRetries} attempts.`);
        console.error("[Setup] Make sure MySQL is running:");
        console.error("        docker compose up -d");
        console.error(`[Setup] Last error: ${err.message}`);
        process.exit(1);
      }
      process.stdout.write(`  attempt ${i}/${maxRetries}...\r`);
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }
  throw new Error("unreachable");
}

// ─── 3. Push schema to database ─────────────────────────────────────────────

function pushSchema() {
  console.log("[Setup] Syncing database schema (drizzle-kit push)...");
  try {
    execSync("npx drizzle-kit push --force", {
      stdio: "pipe",
      env: { ...process.env },
    });
    console.log("[Setup] Schema synced successfully!");
  } catch (err: any) {
    // drizzle-kit push may output to stderr even on success
    const output = err.stdout?.toString() + err.stderr?.toString();
    if (output?.includes("No changes")) {
      console.log("[Setup] Schema already up to date.");
    } else {
      console.error("[Setup] Schema push output:", output);
      throw err;
    }
  }
}

// ─── 4. Ensure uploads directory ────────────────────────────────────────────

function ensureUploadsDir() {
  const uploadsDir = path.resolve("public/uploads");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log("[Setup] Created public/uploads/ directory");
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

export async function setup() {
  console.log("╔══════════════════════════════════════════╗");
  console.log("║     AV Gear Manager — Setup              ║");
  console.log("╚══════════════════════════════════════════╝");
  console.log();

  ensureEnv();
  ensureUploadsDir();

  const conn = await waitForMySQL();
  conn.destroy();

  pushSchema();

  console.log();
  console.log("[Setup] All done! The system is ready.");
  console.log();
}

// Run directly when called as script
const isDirectRun =
  process.argv[1]?.replace(/\\/g, "/").endsWith("server/setup.ts");
if (isDirectRun) {
  setup()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("[Setup] Fatal error:", err);
      process.exit(1);
    });
}
