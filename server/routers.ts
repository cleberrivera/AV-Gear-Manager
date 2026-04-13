import { TRPCError } from "@trpc/server";
import { z } from "zod";
import nodemailer from "nodemailer";
import { calcularDocumentosDisponiveis } from "../shared/documents";
import { login, register, clearSessionCookie, setSessionCookie } from "./auth";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./trpc";
import { gerarDocumentoHTML } from "./documentGenerator";
import type { DocumentType } from "../shared/documents";
import {
  createEquipment,
  createEquipmentRequest,
  createServiceOrder,
  createUsagesBatch,
  deleteEquipment,
  deleteServiceOrder,
  detectAndCreateOverdueAlerts,
  findEquipmentByCode,
  getAllEquipments,
  getAllUsers,
  getAlerts,
  getAvailabilityCsv,
  getCurrentAvailability,
  getEquipmentRequests,
  getOrCreateDraftServiceOrder,
  getServiceOrderById,
  getServiceOrders,
  getSystemConfig,
  getUsages,
  getUsagesByIds,
  getUsageStats,
  resolveAlert,
  reviewEquipmentRequest,
  searchEquipments,
  setSystemConfig,
  setUserRole,
  updateEquipment,
  updateServiceOrder,
  createUsage,
} from "./db";

export const appRouter = router({
  // ─── Auth ──────────────────────────────────────────────────────────────────
  auth: router({
    me: publicProcedure.query(({ ctx }) => {
      if (!ctx.user) return null;
      const { password, ...safeUser } = ctx.user;
      return safeUser;
    }),

    login: publicProcedure
      .input(z.object({
        email: z.string().email("E-mail inválido."),
        password: z.string().min(1, "Senha é obrigatória."),
      }))
      .mutation(async ({ ctx, input }) => {
        const result = await login(input.email, input.password);
        if ("error" in result) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: result.error });
        }
        setSessionCookie(ctx.req, ctx.res, result.token);
        const { password, ...safeUser } = result.user!;
        return { success: true, user: safeUser };
      }),

    register: publicProcedure
      .input(z.object({
        name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres."),
        email: z.string().email("E-mail inválido."),
        password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres."),
      }))
      .mutation(async ({ ctx, input }) => {
        const result = await register(input.name, input.email, input.password);
        if ("error" in result) {
          throw new TRPCError({ code: "CONFLICT", message: result.error });
        }
        setSessionCookie(ctx.req, ctx.res, result.token!);
        const { password, ...safeUser } = result.user!;
        return { success: true, user: safeUser };
      }),

    logout: publicProcedure.mutation(({ ctx }) => {
      clearSessionCookie(ctx.req, ctx.res);
      return { success: true } as const;
    }),
  }),

  // ─── Equipments ────────────────────────────────────────────────────────────
  equipment: router({
    list: publicProcedure
      .input(z.object({ includeInactive: z.boolean().optional() }).optional())
      .query(({ input }) => getAllEquipments(input?.includeInactive)),

    search: publicProcedure
      .input(z.object({ query: z.string().min(1) }))
      .query(({ input }) => searchEquipments(input.query)),

    findByCode: publicProcedure
      .input(z.object({ code: z.string().min(1) }))
      .query(({ input }) => findEquipmentByCode(input.code)),

    create: adminProcedure
      .input(z.object({
        name: z.string().min(1),
        category: z.string().optional(),
        brand: z.string().optional(),
        model: z.string().optional(),
        quantity: z.number().int().min(1).optional(),
        description: z.string().optional(),
        isActive: z.boolean().optional(),
        barcode: z.string().min(1, "O código de barras é obrigatório."),
        patrimonyNumber: z.string().optional(),
        serialNumber: z.string().optional(),
      }))
      .mutation(({ input }) => createEquipment({ ...input, quantity: input.quantity ?? 1 })),

    update: adminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).optional(),
        category: z.string().optional(),
        brand: z.string().optional(),
        model: z.string().optional(),
        quantity: z.number().int().min(1).optional(),
        description: z.string().optional(),
        isActive: z.boolean().optional(),
        barcode: z.string().optional(),
        patrimonyNumber: z.string().optional(),
        serialNumber: z.string().optional(),
      }))
      .mutation(({ input }) => {
        const { id, ...data } = input;
        return updateEquipment(id, data);
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => deleteEquipment(input.id)),
  }),

  // ─── Equipment Requests ────────────────────────────────────────────────────
  requests: router({
    create: protectedProcedure
      .input(z.object({
        name: z.string().min(1, "Nome do equipamento é obrigatório."),
        category: z.string().optional(),
        brand: z.string().optional(),
        model: z.string().optional(),
        quantity: z.number().int().min(1).default(1),
        justification: z.string().optional(),
      }))
      .mutation(({ ctx, input }) =>
        createEquipmentRequest({ ...input, userId: ctx.user.id, status: "pending" })
      ),

    myRequests: protectedProcedure.query(({ ctx }) =>
      getEquipmentRequests(undefined, ctx.user.id)
    ),

    listPending: adminProcedure.query(() => getEquipmentRequests("pending")),

    listAll: adminProcedure
      .input(z.object({ status: z.enum(["pending", "approved", "rejected"]).optional() }).optional())
      .query(({ input }) => getEquipmentRequests(input?.status)),

    review: adminProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(["approved", "rejected"]),
        adminNotes: z.string().optional(),
      }))
      .mutation(({ input }) =>
        reviewEquipmentRequest(input.id, input.status, input.adminNotes)
      ),
  }),

  // ─── Usages ────────────────────────────────────────────────────────────────
  usage: router({
    /**
     * Registro em lote — usa transação para gerar IDs determinísticos.
     * Corrige o bug do projeto original que buscava "últimos N registros".
     */
    register: protectedProcedure
      .input(z.object({
        equipmentIds: z.array(z.number()).min(1, "Selecione ao menos um equipamento."),
        action: z.enum(["checkout", "checkin"]),
        project: z.string().optional(),
        notes: z.string().optional(),
        usedAt: z.date().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { equipmentIds, action, project, notes, usedAt } = input;
        const now = usedAt ?? new Date();

        // Buscar nomes para a OS
        const allEquipments = await getAllEquipments();
        const equipmentNames: Record<number, string> = {};
        for (const eq of allEquipments) {
          equipmentNames[eq.id] = eq.name;
        }

        // Registrar em transação — retorna IDs determinísticos
        const usageIds = await createUsagesBatch(
          equipmentIds.map((equipmentId) => ({
            userId: ctx.user.id,
            equipmentId,
            action,
            project: project || null,
            notes: notes || null,
            usedAt: now,
          }))
        );

        // Criar/atualizar OS de rascunho
        const orderNumber = await getOrCreateDraftServiceOrder(
          ctx.user.id,
          ctx.user.name ?? ctx.user.email,
          action,
          project || null,
          equipmentIds,
          equipmentNames
        );

        return { success: true, count: equipmentIds.length, orderNumber, usageIds };
      }),

    /** Registro rápido via scanner */
    scanRegister: protectedProcedure
      .input(z.object({
        code: z.string().min(1),
        action: z.enum(["checkout", "checkin"]),
        project: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const equipment = await findEquipmentByCode(input.code);
        if (!equipment) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `Equipamento não encontrado para o código: ${input.code}`,
          });
        }
        await createUsage({
          userId: ctx.user.id,
          equipmentId: equipment.id,
          action: input.action,
          project: input.project || null,
          notes: input.notes || null,
          usedAt: new Date(),
        });
        return { success: true, equipment };
      }),

    myHistory: protectedProcedure
      .input(z.object({
        dateFrom: z.date().optional(),
        dateTo: z.date().optional(),
        equipmentId: z.number().optional(),
        action: z.enum(["checkout", "checkin"]).optional(),
        project: z.string().optional(),
        search: z.string().optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      }).optional())
      .query(({ ctx, input }) =>
        getUsages({ ...input, userId: ctx.user.id })
      ),

    /**
     * Histórico geral — CORRIGIDO: agora requer admin.
     * Usuários comuns devem usar myHistory.
     */
    allHistory: adminProcedure
      .input(z.object({
        userId: z.number().optional(),
        equipmentId: z.number().optional(),
        action: z.enum(["checkout", "checkin"]).optional(),
        project: z.string().optional(),
        dateFrom: z.date().optional(),
        dateTo: z.date().optional(),
        search: z.string().optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      }).optional())
      .query(({ input }) => getUsages(input ?? {})),

    availability: publicProcedure.query(() => getCurrentAvailability()),

    exportAvailabilityCsv: protectedProcedure.query(async () => {
      const csv = await getAvailabilityCsv();
      const rows = await getCurrentAvailability();
      return { csv, count: rows.length };
    }),

    stats: protectedProcedure
      .input(z.object({
        dateFrom: z.date().optional(),
        dateTo: z.date().optional(),
      }).optional())
      .query(({ input }) => getUsageStats(input?.dateFrom, input?.dateTo)),

    getAvailableDocuments: protectedProcedure
      .input(z.object({
        status: z.enum(["checkout", "checkin", "renovacao"]).nullable(),
        temMovimentacao: z.boolean().default(false),
      }))
      .query(({ input }) => calcularDocumentosDisponiveis(input.status, input.temMovimentacao)),

    /**
     * Gera documento HTML — CORRIGIDO: usa getUsagesByIds() ao invés de buscar 10k registros.
     */
    generateDocument: protectedProcedure
      .input(z.object({
        tipo: z.enum(["ROMANEIO_SAIDA", "ROMANEIO_RETORNO", "ROMANEIO_RENOVACAO", "NOTA_FISCAL_TRANSPORTE"]),
        usageIds: z.array(z.number()).optional(),
        projeto: z.string().optional(),
        observacoes: z.string().optional(),
        dateFrom: z.date().optional(),
        dateTo: z.date().optional(),
        userId: z.number().optional(),
        equipmentId: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        let registros;
        if (input.usageIds && input.usageIds.length > 0) {
          registros = await getUsagesByIds(input.usageIds);
        } else {
          registros = await getUsages({
            dateFrom: input.dateFrom,
            dateTo: input.dateTo,
            userId: input.userId,
            equipmentId: input.equipmentId,
            limit: 500,
          });
        }

        if (registros.length === 0) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Nenhum registro encontrado." });
        }

        const config = await getSystemConfig();
        const html = gerarDocumentoHTML({
          tipo: input.tipo as DocumentType,
          registros,
          geradoPor: ctx.user.name ?? ctx.user.email,
          geradoEm: new Date(),
          projeto: input.projeto,
          observacoes: input.observacoes,
          companyName: config.company_name,
          companyAddress: config.company_address,
          companyPhone: config.company_phone,
          companyEmail: config.company_email,
          companyCnpj: config.company_cnpj,
          companyLogoUrl: config.company_logo_url,
        });
        return { html, count: registros.length };
      }),

    sendDocumentByEmail: protectedProcedure
      .input(z.object({
        tipo: z.enum(["ROMANEIO_SAIDA", "ROMANEIO_RETORNO", "ROMANEIO_RENOVACAO", "NOTA_FISCAL_TRANSPORTE"]),
        email: z.string().email("E-mail inválido."),
        html: z.string().min(1, "HTML do documento é obrigatório."),
        projeto: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const tipoLabels: Record<string, string> = {
          ROMANEIO_SAIDA: "Romaneio de Saída",
          ROMANEIO_RETORNO: "Romaneio de Retorno",
          ROMANEIO_RENOVACAO: "Romaneio de Renovação",
          NOTA_FISCAL_TRANSPORTE: "Nota Fiscal de Transporte",
        };
        const titulo = tipoLabels[input.tipo] ?? input.tipo;
        const projeto = input.projeto ? ` — ${input.projeto}` : "";
        const assunto = `${titulo}${projeto} | AV Gear Manager`;

        const smtpHost = process.env.SMTP_HOST;
        const smtpUser = process.env.SMTP_USER;
        const smtpPass = process.env.SMTP_PASS;
        const smtpFrom = process.env.SMTP_FROM ?? smtpUser ?? "noreply@avequipment.com";

        let transporter;
        if (smtpHost && smtpUser && smtpPass) {
          transporter = nodemailer.createTransport({
            host: smtpHost,
            port: parseInt(process.env.SMTP_PORT ?? "587"),
            secure: process.env.SMTP_SECURE === "true",
            auth: { user: smtpUser, pass: smtpPass },
          });
        } else {
          const testAccount = await nodemailer.createTestAccount();
          transporter = nodemailer.createTransport({
            host: "smtp.ethereal.email",
            port: 587,
            secure: false,
            auth: { user: testAccount.user, pass: testAccount.pass },
          });
        }

        const info = await transporter.sendMail({
          from: `"AV Gear Manager" <${smtpFrom}>`,
          to: input.email,
          subject: assunto,
          html: input.html,
        });

        const previewUrl = nodemailer.getTestMessageUrl(info);
        return { success: true, messageId: info.messageId, previewUrl: previewUrl || null };
      }),

    /** Devolução em lote via OS */
    returnByOS: protectedProcedure
      .input(z.object({
        serviceOrderId: z.number(),
        project: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const order = await getServiceOrderById(input.serviceOrderId);
        if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "OS não encontrada." });
        const items = order.items ?? [];
        if (items.length === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "A OS não possui equipamentos." });

        const now = new Date();
        await createUsagesBatch(
          items
            .filter((item) => item.equipmentId)
            .map((item) => ({
              userId: ctx.user.id,
              equipmentId: item.equipmentId,
              action: "checkin" as const,
              project: input.project ?? order.project ?? null,
              notes: input.notes ?? null,
              usedAt: now,
            }))
        );

        await updateServiceOrder(input.serviceOrderId, { status: "completed", returnAt: now }, undefined);
        return { success: true, count: items.length };
      }),

    /** Retirada em lote via OS */
    checkoutByOS: protectedProcedure
      .input(z.object({
        serviceOrderId: z.number(),
        project: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const order = await getServiceOrderById(input.serviceOrderId);
        if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "OS não encontrada." });
        const items = order.items ?? [];
        if (items.length === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "A OS não possui equipamentos." });

        const now = new Date();
        await createUsagesBatch(
          items
            .filter((item) => item.equipmentId)
            .map((item) => ({
              userId: ctx.user.id,
              equipmentId: item.equipmentId,
              action: "checkout" as const,
              project: input.project ?? order.project ?? null,
              notes: input.notes ?? null,
              usedAt: now,
            }))
        );

        await updateServiceOrder(input.serviceOrderId, { status: "in_use", exitAt: now }, undefined);
        return { success: true, count: items.length };
      }),

    exportCsv: protectedProcedure
      .input(z.object({
        userId: z.number().optional(),
        equipmentId: z.number().optional(),
        action: z.enum(["checkout", "checkin"]).optional(),
        project: z.string().optional(),
        dateFrom: z.date().optional(),
        dateTo: z.date().optional(),
        search: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        const rows = await getUsages({ ...input, limit: 10000 });
        const header = "ID,Usuário,Equipamento,Categoria,Barcode,Patrimônio,Ação,Projeto,Observações,Data/Hora\n";
        const lines = rows.map((r) =>
          [
            r.id,
            `"${r.userName ?? ""}"`,
            `"${r.equipmentName ?? ""}"`,
            `"${r.equipmentCategory ?? ""}"`,
            `"${r.equipmentBarcode ?? ""}"`,
            `"${r.equipmentPatrimony ?? ""}"`,
            r.action === "checkout" ? "Retirada" : "Devolução",
            `"${r.project ?? ""}"`,
            `"${(r.notes ?? "").replace(/"/g, '""')}"`,
            r.usedAt ? new Date(r.usedAt).toLocaleString("pt-BR") : "",
          ].join(",")
        );
        return { csv: header + lines.join("\n"), count: rows.length };
      }),
  }),

  // ─── Alerts ────────────────────────────────────────────────────────────────
  alerts: router({
    list: protectedProcedure
      .input(z.object({ onlyOpen: z.boolean().optional() }).optional())
      .query(({ input }) => getAlerts(input?.onlyOpen !== false)),

    resolve: protectedProcedure
      .input(z.object({ id: z.number(), notes: z.string().optional() }))
      .mutation(({ ctx, input }) => resolveAlert(input.id, ctx.user.id, input.notes)),

    detectOverdue: adminProcedure
      .input(z.object({ thresholdHours: z.number().int().min(1).default(24) }).optional())
      .mutation(({ input }) => detectAndCreateOverdueAlerts(input?.thresholdHours ?? 24)),
  }),

  // ─── Users ─────────────────────────────────────────────────────────────────
  users: router({
    list: adminProcedure.query(() => getAllUsers()),
    setRole: adminProcedure
      .input(z.object({
        userId: z.number(),
        role: z.enum(["user", "admin"]),
      }))
      .mutation(async ({ input, ctx }) => {
        if (input.userId === ctx.user.id) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Você não pode alterar seu próprio papel." });
        }
        await setUserRole(input.userId, input.role);
        return { success: true };
      }),
  }),

  // ─── Service Orders ────────────────────────────────────────────────────────
  serviceOrder: router({
    list: protectedProcedure
      .input(z.object({ status: z.string().optional(), mine: z.boolean().optional() }).optional())
      .query(({ ctx, input }) =>
        getServiceOrders({
          status: input?.status,
          createdBy: input?.mine ? ctx.user.id : undefined,
        })
      ),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => getServiceOrderById(input.id)),

    create: protectedProcedure
      .input(z.object({
        type: z.enum(["saida", "retorno", "renovacao"]).default("saida"),
        project: z.string().min(1, "Projeto é obrigatório"),
        clientName: z.string().optional(),
        clientFantasy: z.string().optional(),
        clientCnpj: z.string().optional(),
        requester: z.string().optional(),
        requesterPhone: z.string().optional(),
        requesterEmail: z.string().email().optional().or(z.literal("")),
        responsibleUserId: z.number().optional(),
        exitAt: z.date().optional(),
        startAt: z.date().optional(),
        endAt: z.date().optional(),
        returnAt: z.date().optional(),
        notes: z.string().optional(),
        items: z.array(z.object({
          equipmentId: z.number(),
          equipmentName: z.string(),
          equipmentUnit: z.string().optional(),
          quantity: z.number().int().min(1).default(1),
          notes: z.string().optional(),
        })).min(1, "Adicione pelo menos um equipamento"),
      }))
      .mutation(async ({ ctx, input }) => {
        const { items, ...data } = input;
        const orderNumber = await createServiceOrder(
          { ...data, createdBy: ctx.user.id },
          items
        );
        return { success: true, orderNumber };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(["draft", "approved", "in_use", "completed", "cancelled"]).optional(),
        type: z.enum(["saida", "retorno", "renovacao"]).optional(),
        project: z.string().optional(),
        clientName: z.string().optional(),
        clientFantasy: z.string().optional(),
        clientCnpj: z.string().optional(),
        requester: z.string().optional(),
        requesterPhone: z.string().optional(),
        requesterEmail: z.string().email().optional().or(z.literal("")),
        responsibleUserId: z.number().optional(),
        exitAt: z.date().optional(),
        startAt: z.date().optional(),
        endAt: z.date().optional(),
        returnAt: z.date().optional(),
        notes: z.string().optional(),
        items: z.array(z.object({
          equipmentId: z.number(),
          equipmentName: z.string(),
          equipmentUnit: z.string().optional(),
          quantity: z.number().int().min(1).default(1),
          notes: z.string().optional(),
        })).optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, items, ...data } = input;
        await updateServiceOrder(id, data, items);
        return { success: true };
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteServiceOrder(input.id);
        return { success: true };
      }),

    generateDocument: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const order = await getServiceOrderById(input.id);
        if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "OS não encontrada" });
        const config = await getSystemConfig();
        return { order, config };
      }),
  }),

  // ─── System Config — CORRIGIDO: requer autenticação ────────────────────────
  config: router({
    get: protectedProcedure.query(() => getSystemConfig()),
    set: adminProcedure
      .input(z.record(z.string(), z.string()))
      .mutation(async ({ input }) => {
        await setSystemConfig(input);
        return { success: true };
      }),
    uploadLogo: adminProcedure
      .input(z.object({
        fileBase64: z.string().min(1),
        mimeType: z.string().min(1),
        fileName: z.string().min(1),
      }))
      .mutation(async ({ input }) => {
        // Salvar no filesystem local ao invés de storage externo
        const fs = await import("node:fs/promises");
        const path = await import("node:path");
        const ext = input.fileName.split(".").pop() ?? "png";
        const fileName = `company-logo-${Date.now()}.${ext}`;
        const uploadDir = path.resolve("public/uploads");
        await fs.mkdir(uploadDir, { recursive: true });
        const filePath = path.join(uploadDir, fileName);
        const buffer = Buffer.from(input.fileBase64, "base64");
        await fs.writeFile(filePath, buffer);
        const url = `/uploads/${fileName}`;
        await setSystemConfig({ company_logo_url: url });
        return { success: true, url };
      }),
  }),
});

export type AppRouter = typeof appRouter;
