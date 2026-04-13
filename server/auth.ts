import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import type { Request, Response } from "express";
import { getUserByEmail, getUserById, createUser, updateUserLastSignedIn } from "./db";
import type { User } from "../drizzle/schema";

const COOKIE_NAME = "av_session";
const SALT_ROUNDS = 12;

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is required");
  return new TextEncoder().encode(secret);
}

function getJwtExpiry(): string {
  return process.env.JWT_EXPIRES_IN ?? "7d";
}

// ─── Password ────────────────────────────────────────────────────────────────

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ─── JWT ─────────────────────────────────────────────────────────────────────

export async function createToken(userId: number): Promise<string> {
  return new SignJWT({ sub: String(userId) })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(getJwtExpiry())
    .sign(getJwtSecret());
}

export async function verifyToken(token: string): Promise<number | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    const userId = parseInt(payload.sub ?? "", 10);
    return isNaN(userId) ? null : userId;
  } catch {
    return null;
  }
}

// ─── Cookie helpers ──────────────────────────────────────────────────────────

function getCookieOptions(req: Request) {
  const isSecure =
    req.secure || req.headers["x-forwarded-proto"] === "https";
  return {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 dias
  };
}

export function setSessionCookie(req: Request, res: Response, token: string) {
  res.cookie(COOKIE_NAME, token, getCookieOptions(req));
}

export function clearSessionCookie(req: Request, res: Response) {
  res.clearCookie(COOKIE_NAME, { ...getCookieOptions(req), maxAge: -1 });
}

// ─── Auth from request ───────────────────────────────────────────────────────

export async function getUserFromRequest(
  req: Request
): Promise<User | null> {
  // Tenta cookie primeiro
  const token =
    req.cookies?.[COOKIE_NAME] ??
    extractBearerToken(req.headers.authorization);

  if (!token) return null;

  const userId = await verifyToken(token);
  if (!userId) return null;

  const user = await getUserById(userId);
  if (!user || !user.isActive) return null;

  return user;
}

function extractBearerToken(header?: string): string | null {
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice(7);
}

// ─── Login / Register ────────────────────────────────────────────────────────

export async function login(email: string, password: string) {
  const user = await getUserByEmail(email.toLowerCase().trim());
  if (!user) return { error: "Credenciais inválidas." };
  if (!user.isActive) return { error: "Conta desativada. Contate o administrador." };

  const valid = await verifyPassword(password, user.password);
  if (!valid) return { error: "Credenciais inválidas." };

  await updateUserLastSignedIn(user.id);
  const token = await createToken(user.id);
  return { token, user };
}

export async function register(
  name: string,
  email: string,
  password: string
) {
  const normalizedEmail = email.toLowerCase().trim();
  const existing = await getUserByEmail(normalizedEmail);
  if (existing) return { error: "Este e-mail já está cadastrado." };

  const hashed = await hashPassword(password);

  // Primeiro usuário ou email admin → admin
  const isAdmin = normalizedEmail === process.env.ADMIN_EMAIL?.toLowerCase();
  const id = await createUser({
    name: name.trim(),
    email: normalizedEmail,
    password: hashed,
    role: isAdmin ? "admin" : "user",
  });

  const user = await getUserById(id);
  const token = await createToken(id);
  return { token, user };
}
