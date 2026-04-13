import { trpc } from "@/lib/trpc";
import { Building2, Calendar, FileText, Loader2, Phone, User } from "lucide-react";

interface ServiceOrderViewModalProps {
  open: boolean;
  orderId: number | null;
  onClose: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho", approved: "Aprovada", in_use: "Em Uso",
  completed: "Concluida", cancelled: "Cancelada",
};
const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600", approved: "bg-blue-100 text-blue-700",
  in_use: "bg-green-100 text-green-700", completed: "bg-purple-100 text-purple-700",
  cancelled: "bg-red-100 text-red-600",
};
const TYPE_LABELS: Record<string, string> = {
  saida: "Saida", retorno: "Retorno", renovacao: "Renovacao",
};

function formatDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export function ServiceOrderViewModal({ open, orderId, onClose }: ServiceOrderViewModalProps) {
  const { data: order, isLoading } = trpc.serviceOrder.getById.useQuery(
    { id: orderId! },
    { enabled: !!orderId && open }
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card rounded-xl border shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          <h2 className="text-lg font-semibold">
            {order ? `OS No${order.orderNumber} — ${TYPE_LABELS[order.type] ?? order.type}` : "Ordem de Servico"}
          </h2>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !order ? (
          <p className="text-center text-muted-foreground py-8">OS nao encontrada.</p>
        ) : (
          <div className="space-y-4">
            {/* Status + Project */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xl font-bold">{order.project}</p>
                <p className="text-sm text-muted-foreground">
                  Criado em {formatDate(order.createdAt)} por {order.createdByName ?? "—"}
                </p>
              </div>
              <span className={`text-sm font-medium px-2.5 py-1 rounded-full ${STATUS_COLORS[order.status] ?? ""}`}>
                {STATUS_LABELS[order.status] ?? order.status}
              </span>
            </div>

            <hr className="border-border" />

            {/* Client */}
            {(order.clientName || order.clientFantasy) && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Cliente</p>
                <div className="flex items-start gap-2">
                  <Building2 className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                  <div>
                    {order.clientName && <p className="font-medium">{order.clientName}</p>}
                    {order.clientFantasy && <p className="text-sm text-muted-foreground">{order.clientFantasy}</p>}
                    {order.clientCnpj && <p className="text-sm text-muted-foreground">CNPJ: {order.clientCnpj}</p>}
                  </div>
                </div>
              </div>
            )}

            {/* Requester */}
            {order.requester && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Solicitante</p>
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{order.requester}</span>
                  </div>
                  {order.requesterPhone && (
                    <div className="flex items-center gap-1.5">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{order.requesterPhone}</span>
                    </div>
                  )}
                  {order.requesterEmail && (
                    <span className="text-sm text-muted-foreground">{order.requesterEmail}</span>
                  )}
                </div>
              </div>
            )}

            {/* Dates */}
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Periodo</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Saida", value: order.exitAt },
                  { label: "Inicio", value: order.startAt },
                  { label: "Fim", value: order.endAt },
                  { label: "Retorno", value: order.returnAt },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-sm">
                      <span className="font-medium">{label}:</span> {value ? formatDate(value) : "—"}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <hr className="border-border" />

            {/* Items */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Equipamentos ({order.items?.length ?? 0})
              </p>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">Produto</th>
                      <th className="text-center px-3 py-2 font-medium w-24">Qtd</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(order.items ?? []).map((item, idx) => (
                      <tr key={idx} className={idx % 2 === 0 ? "" : "bg-muted/20"}>
                        <td className="px-3 py-2">{item.equipmentName}</td>
                        <td className="px-3 py-2 text-center">
                          {item.quantity} {item.equipmentUnit ?? "UN"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Notes */}
            {order.notes && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Observacoes</p>
                <p className="text-sm bg-muted/30 rounded-lg p-3">{order.notes}</p>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end pt-4 border-t">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border text-sm">Fechar</button>
        </div>
      </div>
    </div>
  );
}
