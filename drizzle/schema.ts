import {
  boolean,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";
import { relations } from "drizzle-orm";

// ─── Users ───────────────────────────────────────────────────────────────────

export const users = mysqlTable(
  "users",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    email: varchar("email", { length: 320 }).notNull().unique(),
    password: varchar("password", { length: 255 }).notNull(),
    role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
    isActive: boolean("isActive").default(true).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
    lastSignedIn: timestamp("lastSignedIn"),
  },
  (t) => [
    index("idx_users_email").on(t.email),
    index("idx_users_role").on(t.role),
  ]
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Equipments ──────────────────────────────────────────────────────────────

export const equipments = mysqlTable(
  "equipments",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    category: varchar("category", { length: 100 }),
    brand: varchar("brand", { length: 150 }),
    model: varchar("model", { length: 150 }),
    quantity: int("quantity").default(1).notNull(),
    description: text("description"),
    isActive: boolean("isActive").default(true).notNull(),
    barcode: varchar("barcode", { length: 128 }).unique(),
    patrimonyNumber: varchar("patrimonyNumber", { length: 64 }).unique(),
    serialNumber: varchar("serialNumber", { length: 128 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (t) => [
    index("idx_equipments_active").on(t.isActive),
    index("idx_equipments_category").on(t.category),
    index("idx_equipments_barcode").on(t.barcode),
    index("idx_equipments_patrimony").on(t.patrimonyNumber),
    index("idx_equipments_serial").on(t.serialNumber),
  ]
);

export type Equipment = typeof equipments.$inferSelect;
export type InsertEquipment = typeof equipments.$inferInsert;

// ─── Equipment Usages ────────────────────────────────────────────────────────

export const equipmentUsages = mysqlTable(
  "equipment_usages",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId")
      .notNull()
      .references(() => users.id),
    equipmentId: int("equipmentId")
      .notNull()
      .references(() => equipments.id),
    action: mysqlEnum("action", ["checkout", "checkin"]).notNull(),
    project: varchar("project", { length: 255 }),
    notes: text("notes"),
    usedAt: timestamp("usedAt").defaultNow().notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [
    index("idx_usages_equipment_date").on(t.equipmentId, t.usedAt),
    index("idx_usages_user_date").on(t.userId, t.usedAt),
    index("idx_usages_action_date").on(t.action, t.usedAt),
    index("idx_usages_used_at").on(t.usedAt),
  ]
);

export type EquipmentUsage = typeof equipmentUsages.$inferSelect;
export type InsertEquipmentUsage = typeof equipmentUsages.$inferInsert;

// ─── Equipment Requests ──────────────────────────────────────────────────────

export const equipmentRequests = mysqlTable(
  "equipment_requests",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId")
      .notNull()
      .references(() => users.id),
    name: varchar("name", { length: 255 }).notNull(),
    category: varchar("category", { length: 100 }),
    brand: varchar("brand", { length: 150 }),
    model: varchar("model", { length: 150 }),
    quantity: int("quantity").default(1).notNull(),
    justification: text("justification"),
    status: mysqlEnum("status", ["pending", "approved", "rejected"])
      .default("pending")
      .notNull(),
    adminNotes: text("adminNotes"),
    reviewedAt: timestamp("reviewedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (t) => [
    index("idx_requests_status").on(t.status),
    index("idx_requests_user").on(t.userId),
  ]
);

export type EquipmentRequest = typeof equipmentRequests.$inferSelect;
export type InsertEquipmentRequest = typeof equipmentRequests.$inferInsert;

// ─── Equipment Alerts ────────────────────────────────────────────────────────

export const equipmentAlerts = mysqlTable(
  "equipment_alerts",
  {
    id: int("id").autoincrement().primaryKey(),
    equipmentId: int("equipmentId")
      .notNull()
      .references(() => equipments.id),
    usageId: int("usageId")
      .notNull()
      .references(() => equipmentUsages.id),
    userId: int("userId")
      .notNull()
      .references(() => users.id),
    alertType: mysqlEnum("alertType", ["overdue", "missing"])
      .default("overdue")
      .notNull(),
    thresholdHours: int("thresholdHours").default(24).notNull(),
    resolvedAt: timestamp("resolvedAt"),
    resolvedBy: int("resolvedBy").references(() => users.id),
    notes: text("notes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (t) => [
    index("idx_alerts_resolved").on(t.resolvedAt),
    index("idx_alerts_usage").on(t.usageId),
    index("idx_alerts_equipment").on(t.equipmentId),
  ]
);

export type EquipmentAlert = typeof equipmentAlerts.$inferSelect;
export type InsertEquipmentAlert = typeof equipmentAlerts.$inferInsert;

// ─── Ordens de Servico ──────────────────────────────────────────────────────

export const serviceOrders = mysqlTable(
  "service_orders",
  {
    id: int("id").autoincrement().primaryKey(),
    orderNumber: int("orderNumber").notNull().unique(),
    status: mysqlEnum("status", [
      "draft",
      "approved",
      "in_use",
      "completed",
      "cancelled",
    ])
      .default("draft")
      .notNull(),
    type: mysqlEnum("type", ["saida", "retorno", "renovacao"])
      .default("saida")
      .notNull(),
    project: varchar("project", { length: 255 }).notNull(),
    clientName: varchar("clientName", { length: 255 }),
    clientFantasy: varchar("clientFantasy", { length: 255 }),
    clientCnpj: varchar("clientCnpj", { length: 20 }),
    requester: varchar("requester", { length: 255 }),
    requesterPhone: varchar("requesterPhone", { length: 30 }),
    requesterEmail: varchar("requesterEmail", { length: 320 }),
    responsibleUserId: int("responsibleUserId").references(() => users.id),
    exitAt: timestamp("exitAt"),
    startAt: timestamp("startAt"),
    endAt: timestamp("endAt"),
    returnAt: timestamp("returnAt"),
    notes: text("notes"),
    createdBy: int("createdBy")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (t) => [
    index("idx_orders_status").on(t.status),
    index("idx_orders_created_by").on(t.createdBy, t.status, t.createdAt),
    index("idx_orders_number").on(t.orderNumber),
  ]
);

export type ServiceOrder = typeof serviceOrders.$inferSelect;
export type InsertServiceOrder = typeof serviceOrders.$inferInsert;

// ─── Itens da OS ─────────────────────────────────────────────────────────────

export const serviceOrderItems = mysqlTable(
  "service_order_items",
  {
    id: int("id").autoincrement().primaryKey(),
    serviceOrderId: int("serviceOrderId")
      .notNull()
      .references(() => serviceOrders.id, { onDelete: "cascade" }),
    equipmentId: int("equipmentId")
      .notNull()
      .references(() => equipments.id),
    equipmentName: varchar("equipmentName", { length: 255 }).notNull(),
    equipmentUnit: varchar("equipmentUnit", { length: 50 }).default("UN"),
    quantity: int("quantity").default(1).notNull(),
    notes: text("notes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [
    index("idx_order_items_order").on(t.serviceOrderId),
    index("idx_order_items_equipment").on(t.equipmentId),
  ]
);

export type ServiceOrderItem = typeof serviceOrderItems.$inferSelect;
export type InsertServiceOrderItem = typeof serviceOrderItems.$inferInsert;

// ─── Configuracoes do Sistema ────────────────────────────────────────────────

export const systemConfig = mysqlTable("system_config", {
  id: int("id").autoincrement().primaryKey(),
  key: varchar("key", { length: 100 }).notNull().unique(),
  value: text("value"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SystemConfig = typeof systemConfig.$inferSelect;
export type InsertSystemConfig = typeof systemConfig.$inferInsert;

// ─── Relations ───────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  usages: many(equipmentUsages),
  requests: many(equipmentRequests),
  alerts: many(equipmentAlerts),
  serviceOrders: many(serviceOrders),
}));

export const equipmentsRelations = relations(equipments, ({ many }) => ({
  usages: many(equipmentUsages),
  alerts: many(equipmentAlerts),
  orderItems: many(serviceOrderItems),
}));

export const equipmentUsagesRelations = relations(
  equipmentUsages,
  ({ one }) => ({
    user: one(users, {
      fields: [equipmentUsages.userId],
      references: [users.id],
    }),
    equipment: one(equipments, {
      fields: [equipmentUsages.equipmentId],
      references: [equipments.id],
    }),
  })
);

export const equipmentRequestsRelations = relations(
  equipmentRequests,
  ({ one }) => ({
    user: one(users, {
      fields: [equipmentRequests.userId],
      references: [users.id],
    }),
  })
);

export const equipmentAlertsRelations = relations(
  equipmentAlerts,
  ({ one }) => ({
    equipment: one(equipments, {
      fields: [equipmentAlerts.equipmentId],
      references: [equipments.id],
    }),
    usage: one(equipmentUsages, {
      fields: [equipmentAlerts.usageId],
      references: [equipmentUsages.id],
    }),
    user: one(users, {
      fields: [equipmentAlerts.userId],
      references: [users.id],
    }),
  })
);

export const serviceOrdersRelations = relations(
  serviceOrders,
  ({ one, many }) => ({
    createdByUser: one(users, {
      fields: [serviceOrders.createdBy],
      references: [users.id],
    }),
    items: many(serviceOrderItems),
  })
);

export const serviceOrderItemsRelations = relations(
  serviceOrderItems,
  ({ one }) => ({
    serviceOrder: one(serviceOrders, {
      fields: [serviceOrderItems.serviceOrderId],
      references: [serviceOrders.id],
    }),
    equipment: one(equipments, {
      fields: [serviceOrderItems.equipmentId],
      references: [equipments.id],
    }),
  })
);
