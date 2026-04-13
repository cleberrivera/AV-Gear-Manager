import "dotenv/config";
import {
  and,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  like,
  lte,
  or,
  sql,
} from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import {
  equipmentAlerts,
  equipmentRequests,
  equipmentUsages,
  equipments,
  serviceOrderItems,
  serviceOrders,
  systemConfig,
  users,
  type InsertEquipment,
  type InsertEquipmentRequest,
  type InsertEquipmentUsage,
  type InsertServiceOrder,
} from "../drizzle/schema";

// ─── Database Connection (singleton pool) ────────────────────────────────────

let _pool: mysql.Pool | null = null;
let _db: ReturnType<typeof drizzle> | null = null;

function getPool(): mysql.Pool {
  if (!_pool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is required");
    _pool = mysql.createPool(url);
  }
  return _pool;
}

export function getDb() {
  if (!_db) {
    _db = drizzle(getPool() as any);
  }
  return _db;
}

// ─── Users ───────────────────────────────────────────────────────────────────

export async function getUserByEmail(email: string) {
  const db = getDb();
  const result = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  return result[0] ?? undefined;
}

export async function getUserById(id: number) {
  const db = getDb();
  const result = await db
    .select()
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  return result[0] ?? undefined;
}

export async function createUser(data: {
  name: string;
  email: string;
  password: string;
  role?: "user" | "admin";
}) {
  const db = getDb();
  const [result] = await db.insert(users).values(data).$returningId();
  return result.id;
}

export async function updateUserLastSignedIn(id: number) {
  const db = getDb();
  await db
    .update(users)
    .set({ lastSignedIn: new Date() })
    .where(eq(users.id, id));
}

export async function getAllUsers() {
  const db = getDb();
  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      isActive: users.isActive,
      lastSignedIn: users.lastSignedIn,
    })
    .from(users)
    .orderBy(users.name);
}

export async function setUserRole(
  userId: number,
  role: "user" | "admin"
): Promise<void> {
  const db = getDb();
  await db.update(users).set({ role }).where(eq(users.id, userId));
}

// ─── Equipments ──────────────────────────────────────────────────────────────

export async function getAllEquipments(includeInactive = false) {
  const db = getDb();
  if (!includeInactive) {
    return db
      .select()
      .from(equipments)
      .where(eq(equipments.isActive, true))
      .orderBy(equipments.category, equipments.name);
  }
  return db
    .select()
    .from(equipments)
    .orderBy(equipments.category, equipments.name);
}

export async function getEquipmentById(id: number) {
  const db = getDb();
  const result = await db
    .select()
    .from(equipments)
    .where(eq(equipments.id, id))
    .limit(1);
  return result[0] ?? undefined;
}

/** Busca equipamento por barcode, patrimônio ou serial — para scanner */
export async function findEquipmentByCode(code: string) {
  const db = getDb();
  const trimmed = code.trim();
  if (!trimmed) return undefined;
  const result = await db
    .select()
    .from(equipments)
    .where(
      and(
        eq(equipments.isActive, true),
        or(
          eq(equipments.barcode, trimmed),
          eq(equipments.patrimonyNumber, trimmed),
          eq(equipments.serialNumber, trimmed)
        )
      )
    )
    .limit(1);
  return result[0] ?? undefined;
}

/** Busca por texto livre — limitada a 20 resultados */
export async function searchEquipments(query: string) {
  const db = getDb();
  const q = `%${query.trim()}%`;
  return db
    .select()
    .from(equipments)
    .where(
      and(
        eq(equipments.isActive, true),
        or(
          like(equipments.name, q),
          like(equipments.barcode, q),
          like(equipments.patrimonyNumber, q),
          like(equipments.serialNumber, q),
          like(equipments.brand, q),
          like(equipments.model, q)
        )
      )
    )
    .orderBy(equipments.category, equipments.name)
    .limit(20);
}

export async function createEquipment(
  data: Omit<InsertEquipment, "id" | "createdAt" | "updatedAt">
) {
  const db = getDb();
  const [result] = await db.insert(equipments).values(data).$returningId();
  return result.id;
}

export async function updateEquipment(
  id: number,
  data: Partial<Omit<InsertEquipment, "id" | "createdAt" | "updatedAt">>
) {
  const db = getDb();
  await db.update(equipments).set(data).where(eq(equipments.id, id));
}

export async function deleteEquipment(id: number) {
  const db = getDb();
  // Soft delete — preserva histórico
  await db
    .update(equipments)
    .set({ isActive: false })
    .where(eq(equipments.id, id));
}

// ─── Equipment Usages ────────────────────────────────────────────────────────

export async function createUsage(
  data: Omit<InsertEquipmentUsage, "id" | "createdAt">
) {
  const db = getDb();
  const [result] = await db
    .insert(equipmentUsages)
    .values(data)
    .$returningId();
  return result.id;
}

/**
 * Registra múltiplos usos em transação e retorna os IDs criados.
 * Resolve o problema de concorrência do projeto original.
 */
export async function createUsagesBatch(
  entries: Array<Omit<InsertEquipmentUsage, "id" | "createdAt">>
): Promise<number[]> {
  if (entries.length === 0) return [];
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const txDb = drizzle(conn);
    const ids: number[] = [];
    for (const entry of entries) {
      const [result] = await txDb
        .insert(equipmentUsages)
        .values(entry)
        .$returningId();
      ids.push(result.id);
    }
    await conn.commit();
    return ids;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/** Busca usos por IDs específicos — substitui o hack de "buscar últimos N" */
export async function getUsagesByIds(ids: number[]) {
  if (ids.length === 0) return [];
  const db = getDb();
  return db
    .select({
      id: equipmentUsages.id,
      action: equipmentUsages.action,
      project: equipmentUsages.project,
      notes: equipmentUsages.notes,
      usedAt: equipmentUsages.usedAt,
      userId: equipmentUsages.userId,
      userName: users.name,
      equipmentId: equipmentUsages.equipmentId,
      equipmentName: equipments.name,
      equipmentCategory: equipments.category,
      equipmentBarcode: equipments.barcode,
      equipmentPatrimony: equipments.patrimonyNumber,
      equipmentBrand: equipments.brand,
      equipmentModel: equipments.model,
    })
    .from(equipmentUsages)
    .leftJoin(users, eq(equipmentUsages.userId, users.id))
    .leftJoin(equipments, eq(equipmentUsages.equipmentId, equipments.id))
    .where(inArray(equipmentUsages.id, ids))
    .orderBy(desc(equipmentUsages.usedAt));
}

export interface UsageFilters {
  userId?: number;
  equipmentId?: number;
  action?: "checkout" | "checkin";
  project?: string;
  dateFrom?: Date;
  dateTo?: Date;
  search?: string;
  limit?: number;
  offset?: number;
}

export async function getUsages(filters: UsageFilters = {}) {
  const db = getDb();
  const conditions = [];
  if (filters.userId)
    conditions.push(eq(equipmentUsages.userId, filters.userId));
  if (filters.equipmentId)
    conditions.push(eq(equipmentUsages.equipmentId, filters.equipmentId));
  if (filters.action)
    conditions.push(eq(equipmentUsages.action, filters.action));
  if (filters.project)
    conditions.push(like(equipmentUsages.project, `%${filters.project}%`));
  if (filters.dateFrom)
    conditions.push(gte(equipmentUsages.usedAt, filters.dateFrom));
  if (filters.dateTo) {
    const endOfDay = new Date(filters.dateTo);
    endOfDay.setHours(23, 59, 59, 999);
    conditions.push(lte(equipmentUsages.usedAt, endOfDay));
  }
  if (filters.search) {
    conditions.push(
      or(
        like(equipmentUsages.project, `%${filters.search}%`),
        like(equipmentUsages.notes, `%${filters.search}%`)
      )
    );
  }

  return db
    .select({
      id: equipmentUsages.id,
      action: equipmentUsages.action,
      project: equipmentUsages.project,
      notes: equipmentUsages.notes,
      usedAt: equipmentUsages.usedAt,
      userId: equipmentUsages.userId,
      userName: users.name,
      equipmentId: equipmentUsages.equipmentId,
      equipmentName: equipments.name,
      equipmentCategory: equipments.category,
      equipmentBarcode: equipments.barcode,
      equipmentPatrimony: equipments.patrimonyNumber,
      equipmentBrand: equipments.brand,
      equipmentModel: equipments.model,
    })
    .from(equipmentUsages)
    .leftJoin(users, eq(equipmentUsages.userId, users.id))
    .leftJoin(equipments, eq(equipmentUsages.equipmentId, equipments.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(equipmentUsages.usedAt))
    .limit(filters.limit ?? 200)
    .offset(filters.offset ?? 0);
}

/**
 * Disponibilidade atual de equipamentos.
 * Usa ROW_NUMBER() para evitar duplicatas quando dois registros têm o mesmo usedAt.
 */
export async function getCurrentAvailability() {
  const db = getDb();
  const result = await db.execute(sql`
    SELECT
      e.id as equipmentId,
      e.name as equipmentName,
      e.category as equipmentCategory,
      e.brand as equipmentBrand,
      e.model as equipmentModel,
      e.quantity as equipmentQuantity,
      e.barcode as equipmentBarcode,
      e.patrimonyNumber as equipmentPatrimony,
      e.serialNumber as equipmentSerial,
      latest.action as lastAction,
      latest.usedAt as lastUsedAt,
      latest.project as lastProject,
      u.id as userId,
      u.name as userName
    FROM equipments e
    LEFT JOIN (
      SELECT eu.*
      FROM (
        SELECT *,
          ROW_NUMBER() OVER (PARTITION BY equipmentId ORDER BY usedAt DESC, id DESC) as rn
        FROM equipment_usages
      ) eu
      WHERE eu.rn = 1
    ) latest ON latest.equipmentId = e.id
    LEFT JOIN users u ON latest.userId = u.id
    WHERE e.isActive = true
    ORDER BY e.category, e.name
  `);

  return (result as unknown as [any[]])[0] as Array<{
    equipmentId: number;
    equipmentName: string;
    equipmentCategory: string | null;
    equipmentBrand: string | null;
    equipmentModel: string | null;
    equipmentQuantity: number;
    equipmentBarcode: string | null;
    equipmentPatrimony: string | null;
    equipmentSerial: string | null;
    lastAction: string | null;
    lastUsedAt: Date | null;
    lastProject: string | null;
    userId: number | null;
    userName: string | null;
  }>;
}

export async function getAvailabilityCsv(): Promise<string> {
  const rows = await getCurrentAvailability();
  const header =
    "ID,Equipamento,Categoria,Marca,Modelo,Quantidade,Barcode,Patrimônio,Serial,Status,Último Uso,Projeto,Usuário";
  const esc = (v: string | null | undefined) =>
    `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = rows.map((r) => {
    const status = !r.lastAction
      ? "Sem Registro"
      : r.lastAction === "checkout"
        ? "Em Uso"
        : "Disponível";
    const lastUsed = r.lastUsedAt
      ? new Date(r.lastUsedAt).toLocaleString("pt-BR")
      : "";
    return [
      r.equipmentId,
      esc(r.equipmentName),
      esc(r.equipmentCategory),
      esc(r.equipmentBrand),
      esc(r.equipmentModel),
      r.equipmentQuantity ?? 1,
      esc(r.equipmentBarcode),
      esc(r.equipmentPatrimony),
      esc(r.equipmentSerial),
      esc(status),
      esc(lastUsed),
      esc(r.lastProject),
      esc(r.userName),
    ].join(",");
  });
  return [header, ...lines].join("\n");
}

// ─── Equipment Requests ──────────────────────────────────────────────────────

export async function createEquipmentRequest(
  data: Omit<InsertEquipmentRequest, "id" | "createdAt" | "updatedAt">
) {
  const db = getDb();
  await db.insert(equipmentRequests).values(data);
}

export async function getEquipmentRequests(
  status?: "pending" | "approved" | "rejected",
  userId?: number
) {
  const db = getDb();
  const conditions = [];
  if (status) conditions.push(eq(equipmentRequests.status, status));
  if (userId) conditions.push(eq(equipmentRequests.userId, userId));
  return db
    .select({
      id: equipmentRequests.id,
      name: equipmentRequests.name,
      category: equipmentRequests.category,
      brand: equipmentRequests.brand,
      model: equipmentRequests.model,
      quantity: equipmentRequests.quantity,
      justification: equipmentRequests.justification,
      status: equipmentRequests.status,
      adminNotes: equipmentRequests.adminNotes,
      reviewedAt: equipmentRequests.reviewedAt,
      createdAt: equipmentRequests.createdAt,
      userId: equipmentRequests.userId,
      userName: users.name,
    })
    .from(equipmentRequests)
    .leftJoin(users, eq(equipmentRequests.userId, users.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(equipmentRequests.createdAt));
}

export async function reviewEquipmentRequest(
  id: number,
  status: "approved" | "rejected",
  adminNotes?: string
) {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const txDb = drizzle(conn);

    await txDb
      .update(equipmentRequests)
      .set({ status, adminNotes: adminNotes ?? null, reviewedAt: new Date() })
      .where(eq(equipmentRequests.id, id));

    if (status === "approved") {
      const req = await txDb
        .select()
        .from(equipmentRequests)
        .where(eq(equipmentRequests.id, id))
        .limit(1);
      if (req.length > 0) {
        const r = req[0];
        await txDb.insert(equipments).values({
          name: r.name,
          category: r.category ?? undefined,
          brand: r.brand ?? undefined,
          model: r.model ?? undefined,
          quantity: r.quantity,
          isActive: true,
        });
      }
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// ─── Alerts ──────────────────────────────────────────────────────────────────

export async function getAlerts(onlyOpen = true) {
  const db = getDb();
  const conditions = onlyOpen ? [isNull(equipmentAlerts.resolvedAt)] : [];
  return db
    .select({
      id: equipmentAlerts.id,
      alertType: equipmentAlerts.alertType,
      thresholdHours: equipmentAlerts.thresholdHours,
      resolvedAt: equipmentAlerts.resolvedAt,
      notes: equipmentAlerts.notes,
      createdAt: equipmentAlerts.createdAt,
      equipmentId: equipmentAlerts.equipmentId,
      equipmentName: equipments.name,
      equipmentCategory: equipments.category,
      equipmentBarcode: equipments.barcode,
      equipmentPatrimony: equipments.patrimonyNumber,
      usageId: equipmentAlerts.usageId,
      userId: equipmentAlerts.userId,
      userName: users.name,
    })
    .from(equipmentAlerts)
    .leftJoin(equipments, eq(equipmentAlerts.equipmentId, equipments.id))
    .leftJoin(users, eq(equipmentAlerts.userId, users.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(equipmentAlerts.createdAt));
}

export async function resolveAlert(
  id: number,
  resolvedBy: number,
  notes?: string
) {
  const db = getDb();
  await db
    .update(equipmentAlerts)
    .set({ resolvedAt: new Date(), resolvedBy, notes: notes ?? null })
    .where(eq(equipmentAlerts.id, id));
}

export async function detectAndCreateOverdueAlerts(thresholdHours = 24) {
  const db = getDb();
  const threshold = new Date(Date.now() - thresholdHours * 60 * 60 * 1000);

  // Usa ROW_NUMBER para pegar apenas o último uso de cada equipamento
  const overdueResult = await db.execute(sql`
    SELECT eu.id as usageId, eu.equipmentId, eu.userId
    FROM (
      SELECT *,
        ROW_NUMBER() OVER (PARTITION BY equipmentId ORDER BY usedAt DESC, id DESC) as rn
      FROM equipment_usages
    ) eu
    WHERE eu.rn = 1
      AND eu.action = 'checkout'
      AND eu.usedAt < ${threshold}
  `);

  const overdueRows = (overdueResult as unknown as [any[]])[0] as Array<{
    usageId: number;
    equipmentId: number;
    userId: number;
  }>;

  let created = 0;
  for (const row of overdueRows) {
    const existing = await db
      .select({ id: equipmentAlerts.id })
      .from(equipmentAlerts)
      .where(
        and(
          eq(equipmentAlerts.usageId, row.usageId),
          isNull(equipmentAlerts.resolvedAt)
        )
      )
      .limit(1);

    if (existing.length === 0) {
      await db.insert(equipmentAlerts).values({
        equipmentId: row.equipmentId,
        usageId: row.usageId,
        userId: row.userId,
        alertType: "overdue",
        thresholdHours,
      });
      created++;
    }
  }
  return created;
}

// ─── Stats ───────────────────────────────────────────────────────────────────

export async function getUsageStats(dateFrom?: Date, dateTo?: Date) {
  const db = getDb();
  const conditions = [];
  if (dateFrom) conditions.push(gte(equipmentUsages.usedAt, dateFrom));
  if (dateTo) {
    const endOfDay = new Date(dateTo);
    endOfDay.setHours(23, 59, 59, 999);
    conditions.push(lte(equipmentUsages.usedAt, endOfDay));
  }

  const whereClause =
    conditions.length > 0 ? and(...conditions) : undefined;

  const byEquipment = await db
    .select({
      equipmentId: equipmentUsages.equipmentId,
      equipmentName: equipments.name,
      equipmentCategory: equipments.category,
      totalUsages: sql<number>`COUNT(*)`,
    })
    .from(equipmentUsages)
    .leftJoin(equipments, eq(equipmentUsages.equipmentId, equipments.id))
    .where(whereClause)
    .groupBy(equipmentUsages.equipmentId, equipments.name, equipments.category)
    .orderBy(desc(sql`COUNT(*)`));

  const byUser = await db
    .select({
      userId: equipmentUsages.userId,
      userName: users.name,
      totalUsages: sql<number>`COUNT(*)`,
    })
    .from(equipmentUsages)
    .leftJoin(users, eq(equipmentUsages.userId, users.id))
    .where(whereClause)
    .groupBy(equipmentUsages.userId, users.name)
    .orderBy(desc(sql`COUNT(*)`));

  return { byEquipment, byUser };
}

// ─── Service Orders ──────────────────────────────────────────────────────────

/**
 * Gera próximo número de OS de forma ATÔMICA.
 * Usa UPDATE ... SET value = value + 1 para evitar race conditions.
 */
export async function getNextOrderNumber(): Promise<number> {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const txDb = drizzle(conn);

    // Tenta incrementar atomicamente
    const result = await conn.execute(
      "UPDATE system_config SET value = value + 1 WHERE `key` = 'os_next_number'"
    );

    const affected = (result as any)[0]?.affectedRows ?? 0;
    if (affected === 0) {
      // Primeira vez — criar o registro
      await txDb
        .insert(systemConfig)
        .values({ key: "os_next_number", value: "2" });
      await conn.commit();
      return 1;
    }

    // Pegar o valor ANTES do incremento (valor atual - 1)
    const rows = await txDb
      .select({ value: systemConfig.value })
      .from(systemConfig)
      .where(eq(systemConfig.key, "os_next_number"))
      .limit(1);

    await conn.commit();
    return parseInt(rows[0]?.value ?? "1", 10) - 1;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function createServiceOrder(
  data: Omit<
    InsertServiceOrder,
    "id" | "createdAt" | "updatedAt" | "orderNumber"
  >,
  items: Array<{
    equipmentId: number;
    equipmentName: string;
    equipmentUnit?: string;
    quantity: number;
    notes?: string;
  }>
) {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const txDb = drizzle(conn);

    const orderNumber = await getNextOrderNumber();
    const [orderResult] = await txDb
      .insert(serviceOrders)
      .values({ ...data, orderNumber })
      .$returningId();
    const orderId = orderResult.id;

    if (items.length > 0) {
      await txDb
        .insert(serviceOrderItems)
        .values(items.map((i) => ({ ...i, serviceOrderId: orderId })));
    }

    await conn.commit();
    return orderNumber;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function getServiceOrders(
  filters: { status?: string; createdBy?: number } = {}
) {
  const db = getDb();
  const conditions = [];
  if (filters.status)
    conditions.push(eq(serviceOrders.status, filters.status as any));
  if (filters.createdBy)
    conditions.push(eq(serviceOrders.createdBy, filters.createdBy));

  return db
    .select({
      id: serviceOrders.id,
      orderNumber: serviceOrders.orderNumber,
      status: serviceOrders.status,
      type: serviceOrders.type,
      project: serviceOrders.project,
      clientName: serviceOrders.clientName,
      clientFantasy: serviceOrders.clientFantasy,
      requester: serviceOrders.requester,
      requesterPhone: serviceOrders.requesterPhone,
      requesterEmail: serviceOrders.requesterEmail,
      exitAt: serviceOrders.exitAt,
      startAt: serviceOrders.startAt,
      endAt: serviceOrders.endAt,
      returnAt: serviceOrders.returnAt,
      notes: serviceOrders.notes,
      createdBy: serviceOrders.createdBy,
      createdAt: serviceOrders.createdAt,
      createdByName: users.name,
    })
    .from(serviceOrders)
    .leftJoin(users, eq(serviceOrders.createdBy, users.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(serviceOrders.createdAt));
}

export async function getServiceOrderById(id: number) {
  const db = getDb();
  const orders = await db
    .select({
      id: serviceOrders.id,
      orderNumber: serviceOrders.orderNumber,
      status: serviceOrders.status,
      type: serviceOrders.type,
      project: serviceOrders.project,
      clientName: serviceOrders.clientName,
      clientFantasy: serviceOrders.clientFantasy,
      clientCnpj: serviceOrders.clientCnpj,
      requester: serviceOrders.requester,
      requesterPhone: serviceOrders.requesterPhone,
      requesterEmail: serviceOrders.requesterEmail,
      exitAt: serviceOrders.exitAt,
      startAt: serviceOrders.startAt,
      endAt: serviceOrders.endAt,
      returnAt: serviceOrders.returnAt,
      notes: serviceOrders.notes,
      createdBy: serviceOrders.createdBy,
      createdAt: serviceOrders.createdAt,
      createdByName: users.name,
    })
    .from(serviceOrders)
    .leftJoin(users, eq(serviceOrders.createdBy, users.id))
    .where(eq(serviceOrders.id, id))
    .limit(1);

  if (orders.length === 0) return undefined;
  const order = orders[0];
  const items = await db
    .select()
    .from(serviceOrderItems)
    .where(eq(serviceOrderItems.serviceOrderId, id))
    .orderBy(serviceOrderItems.id);
  return { ...order, items };
}

export async function updateServiceOrder(
  id: number,
  data: Partial<
    Omit<
      InsertServiceOrder,
      "id" | "createdAt" | "updatedAt" | "orderNumber" | "createdBy"
    >
  >,
  items?: Array<{
    equipmentId: number;
    equipmentName: string;
    equipmentUnit?: string;
    quantity: number;
    notes?: string;
  }>
) {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const txDb = drizzle(conn);

    await txDb
      .update(serviceOrders)
      .set(data)
      .where(eq(serviceOrders.id, id));

    if (items !== undefined) {
      await txDb
        .delete(serviceOrderItems)
        .where(eq(serviceOrderItems.serviceOrderId, id));
      if (items.length > 0) {
        await txDb
          .insert(serviceOrderItems)
          .values(items.map((i) => ({ ...i, serviceOrderId: id })));
      }
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function deleteServiceOrder(id: number) {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const txDb = drizzle(conn);
    await txDb
      .delete(serviceOrderItems)
      .where(eq(serviceOrderItems.serviceOrderId, id));
    await txDb.delete(serviceOrders).where(eq(serviceOrders.id, id));
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * Busca ou cria OS rascunho — em transação para evitar duplicatas.
 */
export async function getOrCreateDraftServiceOrder(
  userId: number,
  userName: string,
  action: "checkout" | "checkin",
  project: string | null,
  equipmentIds: number[],
  equipmentNames: Record<number, string>
): Promise<number> {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const txDb = drizzle(conn);

    const type = action === "checkout" ? "saida" : "retorno";
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // SELECT ... FOR UPDATE para travar a linha e evitar duplicata
    const existing = await conn.execute(
      `SELECT id, orderNumber FROM service_orders
       WHERE createdBy = ? AND status = 'draft' AND type = ? AND createdAt >= ?
       ORDER BY createdAt DESC LIMIT 1 FOR UPDATE`,
      [userId, type, today]
    );

    const existingRows = (existing as any)[0] as Array<{
      id: number;
      orderNumber: number;
    }>;

    if (existingRows.length > 0) {
      const orderId = existingRows[0].id;
      if (equipmentIds.length > 0) {
        await txDb.insert(serviceOrderItems).values(
          equipmentIds.map((eId) => ({
            serviceOrderId: orderId,
            equipmentId: eId,
            equipmentName: equipmentNames[eId] ?? "Equipamento",
            quantity: 1,
          }))
        );
      }
      await conn.commit();
      return existingRows[0].orderNumber;
    }

    // Gerar número atômico
    const numResult = await conn.execute(
      "UPDATE system_config SET value = value + 1 WHERE `key` = 'os_next_number'"
    );
    let orderNumber: number;
    if ((numResult as any)[0]?.affectedRows === 0) {
      await txDb
        .insert(systemConfig)
        .values({ key: "os_next_number", value: "2" });
      orderNumber = 1;
    } else {
      const numRows = await txDb
        .select({ value: systemConfig.value })
        .from(systemConfig)
        .where(eq(systemConfig.key, "os_next_number"))
        .limit(1);
      orderNumber = parseInt(numRows[0]?.value ?? "1", 10) - 1;
    }

    const now = new Date();
    const [orderResult] = await txDb
      .insert(serviceOrders)
      .values({
        orderNumber,
        status: "draft",
        type: type as any,
        project: project || "Sem projeto",
        requester: userName,
        createdBy: userId,
        exitAt: action === "checkout" ? now : undefined,
        returnAt: action === "checkin" ? now : undefined,
      })
      .$returningId();

    if (equipmentIds.length > 0) {
      await txDb.insert(serviceOrderItems).values(
        equipmentIds.map((eId) => ({
          serviceOrderId: orderResult.id,
          equipmentId: eId,
          equipmentName: equipmentNames[eId] ?? "Equipamento",
          quantity: 1,
        }))
      );
    }

    await conn.commit();
    return orderNumber;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// ─── System Config (com cache) ───────────────────────────────────────────────

let configCache: { data: Record<string, string>; expiry: number } | null =
  null;
const CONFIG_CACHE_TTL = 5 * 60 * 1000; // 5 minutos

export async function getSystemConfig(): Promise<Record<string, string>> {
  if (configCache && Date.now() < configCache.expiry) {
    return configCache.data;
  }
  const db = getDb();
  const rows = await db.select().from(systemConfig);
  const data = Object.fromEntries(rows.map((r) => [r.key, r.value ?? ""]));
  configCache = { data, expiry: Date.now() + CONFIG_CACHE_TTL };
  return data;
}

export async function setSystemConfig(
  updates: Record<string, string>
): Promise<void> {
  const db = getDb();
  for (const [key, value] of Object.entries(updates)) {
    await db
      .insert(systemConfig)
      .values({ key, value })
      .onDuplicateKeyUpdate({ set: { value } });
  }
  // Invalida cache
  configCache = null;
}
