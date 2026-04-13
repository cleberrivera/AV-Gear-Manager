# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# First-time setup (creates .env, waits for MySQL, syncs schema)
npm run setup

# Development — starts API (port 3000) + Vite frontend (port 5173) concurrently
npm run dev

# Run only the API or frontend separately
npm run dev:api
npm run dev:web

# Type-check without emitting
npm run check

# Production build (Vite + esbuild)
npm run build
npm start

# Database schema management (drizzle-kit)
npm run db:push       # push schema directly to DB
npm run db:generate   # generate migration files
npm run db:migrate    # apply migrations
```

**Prerequisites:** MySQL via Docker (`docker compose up -d`) or a local MySQL instance. The setup script auto-generates `.env` with connection string and JWT secret.

## Architecture

Monorepo with three layers sharing TypeScript types end-to-end:

```
server/          → Express + tRPC API (port 3000)
client/src/      → React 19 + Vite frontend (port 5173, proxies /api to server)
shared/          → Types, constants, categories shared between server and client
drizzle/         → Database schema (Drizzle ORM, MySQL)
```

### API Layer (tRPC)

`server/trpc.ts` defines three procedure levels:
- `publicProcedure` — no auth
- `protectedProcedure` — requires authenticated user
- `adminProcedure` — requires `role: "admin"`

`server/routers.ts` is the single router file with nested sub-routers: `auth`, `equipment`, `requests`, `usage`, `alerts`, `users`, `serviceOrder`, `config`. All input validation uses Zod. The `AppRouter` type is imported by the client for end-to-end type safety.

### Authentication

JWT (jose, HS256) stored in httpOnly cookie `av_session`. The first user to register with the email matching `ADMIN_EMAIL` env var gets admin role. `server/auth.ts` handles login/register/token lifecycle.

### Database

Drizzle ORM with `mysql2/promise`. Schema in `drizzle/schema.ts` defines 8 tables: `users`, `equipments`, `equipment_usages`, `equipment_requests`, `equipment_alerts`, `service_orders`, `service_order_items`, `system_config`.

`server/db.ts` contains all query functions — no raw SQL in routers. Uses transactions with `pool.getConnection()` for batch operations and atomic order number generation (`SELECT FOR UPDATE`). System config is cached with 5-minute TTL.

### Frontend

Wouter for routing (not React Router). All API calls go through `client/src/lib/trpc.ts` using `@trpc/react-query`. Pages use native HTML elements (input, select, textarea) — not shadcn form components — for consistency. Modals use `fixed inset-0` overlay pattern, not Radix Dialog.

`client/src/hooks/useAuth.ts` provides the auth context. `DashboardLayout.tsx` wraps all authenticated pages with sidebar navigation.

### Document Generation

`server/documentGenerator.ts` generates printable A4 HTML documents (Romaneio de Saida/Retorno/Renovacao, Nota Fiscal). All dynamic content is sanitized with `escapeHtml()` to prevent XSS. `OSDocumentModal.tsx` on the client generates OS-specific documents client-side using a similar approach.

## Key Conventions

- **Language:** All UI text, labels, and user-facing messages are in Brazilian Portuguese
- **Serialization:** SuperJSON transformer on tRPC for Date objects across the wire
- **Soft deletes:** Equipment uses `isActive: false` instead of actual deletion
- **Path aliases:** `@/*` maps to `client/src/*`, `@shared/*` maps to `shared/*`
- **No tests:** No test framework is configured
