import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { Request, Response } from "express";
import type { User } from "../drizzle/schema";
import { getUserFromRequest } from "./auth";

// ─── Context ─────────────────────────────────────────────────────────────────

export type TrpcContext = {
  req: Request;
  res: Response;
  user: User | null;
};

export async function createContext(opts: {
  req: Request;
  res: Response;
}): Promise<TrpcContext> {
  const user = await getUserFromRequest(opts.req);
  return { req: opts.req, res: opts.res, user };
}

// ─── tRPC init ───────────────────────────────────────────────────────────────

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

// ─── Middleware: require authenticated user ──────────────────────────────────

const requireUser = t.middleware(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Faça login para continuar.",
    });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

export const protectedProcedure = t.procedure.use(requireUser);

// ──��� Middleware: require admin ───────────────────────────────────────────────

const requireAdmin = t.middleware(async ({ ctx, next }) => {
  if (!ctx.user || ctx.user.role !== "admin") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Acesso restrito a administradores.",
    });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

export const adminProcedure = t.procedure.use(requireAdmin);
