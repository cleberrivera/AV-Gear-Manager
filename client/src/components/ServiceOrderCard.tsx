import { trpc } from "@/lib/trpc";
import { ArrowDownToLine, ArrowUpFromLine, Building2, Eye, FileText, Loader2, Pencil, Share2, Trash2 } from "lucide-react";
import { toast } from "sonner";

export type ServiceOrderStatus = "draft" | "approved" | "in_use" | "completed" | "cancelled";
export type ServiceOrderType = "saida" | "retorno" | "renovacao";

export interface ServiceOrderCardData {
  id: number;
  orderNumber: number;
  status: ServiceOrderStatus;
  type: ServiceOrderType;
  project: string;
  clientName?: string | null;
  clientFantasy?: string | null;
  requester?: string | null;
  exitAt?: Date | null;
  startAt?: Date | null;
  createdByName?: string | null;
}

const STATUS_CONFIG: Record<ServiceOrderStatus, { label: string; color: string; dot: string }> = {
  draft:     { label: "Rascunho",  color: "bg-gray-100 text-gray-600",     dot: "bg-gray-400" },
  approved:  { label: "Aprovada",  color: "bg-blue-100 text-blue-700",     dot: "bg-blue-500" },
  in_use:    { label: "Em Uso",    color: "bg-green-100 text-green-700",   dot: "bg-green-500" },
  completed: { label: "Concluida", color: "bg-purple-100 text-purple-700", dot: "bg-purple-500" },
  cancelled: { label: "Cancelada", color: "bg-red-100 text-red-600",       dot: "bg-red-500" },
};

const TYPE_LABELS: Record<ServiceOrderType, string> = {
  saida: "Saida",
  retorno: "Retorno",
  renovacao: "Renovacao",
};

interface ServiceOrderCardProps {
  order: ServiceOrderCardData;
  onView: (id: number) => void;
  onEdit: (id: number) => void;
  onDocument: (id: number) => void;
  onShare?: (id: number) => void;
  onDeleted?: () => void;
  isAdmin?: boolean;
}

export function ServiceOrderCard({ order, onView, onEdit, onDocument, onShare, onDeleted, isAdmin }: ServiceOrderCardProps) {
  const utils = trpc.useUtils();
  const statusCfg = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.draft;
  const typeLabel = TYPE_LABELS[order.type] ?? order.type;

  const deleteMutation = trpc.serviceOrder.delete.useMutation({
    onSuccess: () => { toast.success(`OS No${order.orderNumber} excluida.`); onDeleted?.(); },
    onError: (e) => toast.error(e.message),
  });

  const checkoutMutation = trpc.usage.checkoutByOS.useMutation({
    onSuccess: (data) => {
      toast.success(`Retirada registrada para ${data.count} equipamento(s).`);
      utils.serviceOrder.list.invalidate();
    },
    onError: (e) => toast.error(`Erro na retirada: ${e.message}`),
  });

  const returnMutation = trpc.usage.returnByOS.useMutation({
    onSuccess: (data) => {
      toast.success(`Devolucao registrada para ${data.count} equipamento(s).`);
      utils.serviceOrder.list.invalidate();
    },
    onError: (e) => toast.error(`Erro na devolucao: ${e.message}`),
  });

  const canCheckout = order.status === "draft" || order.status === "approved";
  const canReturn = order.status === "in_use";
  const isBusy = checkoutMutation.isPending || returnMutation.isPending;

  const dateLabel = order.exitAt
    ? new Date(order.exitAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : order.startAt
    ? new Date(order.startAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : null;

  const clientDisplay = order.clientFantasy || order.clientName;

  return (
    <div className="relative overflow-hidden rounded-xl border bg-card hover:shadow-md transition-shadow">
      {/* Status bar */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${statusCfg.dot}`} />

      <div className="pl-5 pr-4 py-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${statusCfg.dot}`} />
            <span className="text-sm font-semibold">{typeLabel} No{order.orderNumber}</span>
          </div>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusCfg.color}`}>
            {statusCfg.label}
          </span>
        </div>

        {dateLabel && <p className="text-lg font-bold mb-0.5">{dateLabel}</p>}
        <p className="text-sm text-muted-foreground font-medium mb-2">{order.project}</p>

        {clientDisplay && (
          <div className="flex items-center gap-1.5 text-sm mb-0.5">
            <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate font-medium">{clientDisplay}</span>
          </div>
        )}
        {order.requester && <p className="text-xs text-muted-foreground mb-3">{order.requester}</p>}
        {!order.requester && <div className="mb-3" />}

        {/* Batch actions */}
        {(canCheckout || canReturn) && (
          <div className="mb-3 flex gap-2">
            {canCheckout && (
              <button
                onClick={() => { if (confirm(`Registrar RETIRADA de todos os equipamentos da OS No${order.orderNumber}?`)) checkoutMutation.mutate({ serviceOrderId: order.id }); }}
                disabled={isBusy}
                className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg border border-orange-400 text-orange-600 text-xs font-medium hover:bg-orange-50 disabled:opacity-50"
              >
                {checkoutMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowUpFromLine className="h-3.5 w-3.5" />}
                Registrar Retirada
              </button>
            )}
            {canReturn && (
              <button
                onClick={() => { if (confirm(`Registrar DEVOLUCAO de todos os equipamentos da OS No${order.orderNumber}?`)) returnMutation.mutate({ serviceOrderId: order.id }); }}
                disabled={isBusy}
                className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg border border-green-500 text-green-700 text-xs font-medium hover:bg-green-50 disabled:opacity-50"
              >
                {returnMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowDownToLine className="h-3.5 w-3.5" />}
                Registrar Devolucao
              </button>
            )}
          </div>
        )}

        {/* Action icons */}
        <div className="flex items-center gap-2">
          <button onClick={() => onDocument(order.id)} className="h-9 w-9 rounded-full bg-teal-500 hover:bg-teal-600 text-white flex items-center justify-center" title="Gerar Documento">
            <FileText className="h-4 w-4" />
          </button>
          <button onClick={() => onView(order.id)} className="h-9 w-9 rounded-full border-2 flex items-center justify-center hover:bg-muted" title="Visualizar">
            <Eye className="h-4 w-4" />
          </button>
          {isAdmin && (
            <>
              <button onClick={() => onEdit(order.id)} className="h-9 w-9 rounded-full border-2 flex items-center justify-center hover:bg-muted" title="Editar">
                <Pencil className="h-4 w-4" />
              </button>
              <button onClick={() => onShare?.(order.id)} className="h-9 w-9 rounded-full border-2 flex items-center justify-center hover:bg-muted" title="Compartilhar">
                <Share2 className="h-4 w-4" />
              </button>
              <button
                onClick={() => { if (confirm(`Excluir OS No${order.orderNumber}?`)) deleteMutation.mutate({ id: order.id }); }}
                disabled={deleteMutation.isPending}
                className="h-9 w-9 rounded-full border-2 flex items-center justify-center hover:bg-destructive/10 text-destructive ml-auto disabled:opacity-50"
                title="Excluir"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
