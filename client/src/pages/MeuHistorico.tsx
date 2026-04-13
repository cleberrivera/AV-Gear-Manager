import { trpc } from "@/lib/trpc";
import {
  ArrowDownCircle,
  ArrowDownToLine,
  ArrowUpCircle,
  Calendar,
  ClipboardList,
  Download,
  Loader2,
  Search,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

// ─── OS ativas com botao de devolucao em lote ────────────────────────────────
function MinhasOSAtivas() {
  const utils = trpc.useUtils();
  const { data: orders, isLoading } = trpc.serviceOrder.list.useQuery({ status: "in_use" });

  const returnMutation = trpc.usage.returnByOS.useMutation({
    onSuccess: (data) => {
      toast.success(`Devolucao registrada para ${data.count} equipamento(s).`);
      utils.serviceOrder.list.invalidate();
      utils.usage.myHistory.invalidate();
    },
    onError: (e) => toast.error(`Erro na devolucao: ${e.message}`),
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-4">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Carregando ordens ativas...</span>
      </div>
    );
  }

  if (!orders?.length) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <ClipboardList className="h-4 w-4 text-green-600" />
        <h2 className="text-sm font-semibold text-foreground">Ordens de Servico Em Uso</h2>
        <span className="bg-green-100 text-green-700 text-xs font-medium px-1.5 py-0.5 rounded-full">
          {orders.length}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        Clique em "Devolver Tudo" para registrar a devolucao de todos os equipamentos de uma OS.
      </p>
      <div className="space-y-2">
        {orders.map((order) => (
          <div key={order.id} className="rounded-lg border border-green-200 bg-green-50/40 p-3 px-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold">OS No{order.orderNumber}</span>
                  <span className="text-xs bg-green-100 text-green-700 border border-green-300 px-1.5 py-0.5 rounded-full">
                    Em Uso
                  </span>
                </div>
                {order.project && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Projeto: <span className="font-medium text-foreground">{order.project}</span>
                  </p>
                )}
                {order.exitAt && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Saida: {new Date(order.exitAt).toLocaleString("pt-BR")}
                  </p>
                )}
              </div>
              <button
                disabled={returnMutation.isPending}
                onClick={() => {
                  if (confirm(`Devolver todos os equipamentos da OS No${order.orderNumber}?`)) {
                    returnMutation.mutate({ serviceOrderId: order.id });
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-green-500 text-green-700 text-sm font-medium hover:bg-green-100 disabled:opacity-50 shrink-0"
              >
                {returnMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ArrowDownToLine className="h-3.5 w-3.5" />
                )}
                Devolver Tudo
              </button>
            </div>
          </div>
        ))}
      </div>
      <hr className="border-border" />
    </div>
  );
}

// ─── Pagina principal ────────────────────────────────────────────────────────
export default function MeuHistorico() {
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const [action, setAction] = useState<"all" | "checkout" | "checkin">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [equipmentId, setEquipmentId] = useState<string>("all");

  const { data: equipments } = trpc.equipment.list.useQuery();
  const { data: history, isLoading } = trpc.usage.myHistory.useQuery({
    action: action !== "all" ? action : undefined,
    dateFrom: dateFrom ? new Date(dateFrom) : undefined,
    dateTo: dateTo ? new Date(dateTo) : undefined,
    equipmentId: equipmentId !== "all" ? parseInt(equipmentId) : undefined,
    search: search || undefined,
    limit: 200,
  });

  const returnSingleMutation = trpc.usage.register.useMutation({
    onSuccess: () => {
      toast.success("Devolucao registrada com sucesso.");
      utils.usage.myHistory.invalidate();
      utils.serviceOrder.list.invalidate();
    },
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });

  const exportQuery = trpc.usage.exportCsv.useQuery(
    {
      action: action !== "all" ? action : undefined,
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(dateTo) : undefined,
      equipmentId: equipmentId !== "all" ? parseInt(equipmentId) : undefined,
      search: search || undefined,
    },
    { enabled: false }
  );

  const handleExport = async () => {
    const result = await exportQuery.refetch();
    if (result.data?.csv) {
      const blob = new Blob([result.data.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `meu-historico-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`${result.data.count} registros exportados.`);
    }
  };

  const clearFilters = () => {
    setSearch("");
    setAction("all");
    setDateFrom("");
    setDateTo("");
    setEquipmentId("all");
  };

  // Identificar equipamentos ainda em uso
  const equipmentsInUse = new Set<number>();
  const seenEquipments = new Set<number>();
  const sortedHistory = [...(history ?? [])].sort(
    (a, b) => new Date(b.usedAt).getTime() - new Date(a.usedAt).getTime()
  );
  for (const item of sortedHistory) {
    if (!item.equipmentId) continue;
    if (!seenEquipments.has(item.equipmentId)) {
      seenEquipments.add(item.equipmentId);
      if (item.action === "checkout") {
        equipmentsInUse.add(item.equipmentId);
      }
    }
  }

  const hasFilters = search || action !== "all" || dateFrom || dateTo || equipmentId !== "all";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Meu Historico</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Todos os equipamentos que voce registrou.
          </p>
        </div>
        <button
          onClick={handleExport}
          disabled={exportQuery.isFetching}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm hover:bg-muted disabled:opacity-50"
        >
          {exportQuery.isFetching ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          Exportar CSV
        </button>
      </div>

      {/* OS ativas */}
      <MinhasOSAtivas />

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="relative sm:col-span-2 lg:col-span-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            placeholder="Buscar projeto ou obs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 px-3 py-2 rounded-lg border bg-background text-sm"
          />
        </div>
        <select
          value={action}
          onChange={(e) => setAction(e.target.value as typeof action)}
          className="px-3 py-2 rounded-lg border bg-background text-sm"
        >
          <option value="all">Todas as acoes</option>
          <option value="checkout">Retirada</option>
          <option value="checkin">Devolucao</option>
        </select>
        <select
          value={equipmentId}
          onChange={(e) => setEquipmentId(e.target.value)}
          className="px-3 py-2 rounded-lg border bg-background text-sm"
        >
          <option value="all">Todos os equipamentos</option>
          {(equipments ?? []).map((eq) => (
            <option key={eq.id} value={String(eq.id)}>{eq.name}</option>
          ))}
        </select>
        <div className="flex gap-2">
          <div className="flex-1 space-y-1">
            <label className="text-xs text-muted-foreground">De</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full px-3 py-2 rounded-lg border bg-background text-sm" />
          </div>
          <div className="flex-1 space-y-1">
            <label className="text-xs text-muted-foreground">Ate</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full px-3 py-2 rounded-lg border bg-background text-sm" />
          </div>
        </div>
      </div>

      {hasFilters && (
        <button onClick={clearFilters} className="text-xs text-muted-foreground hover:text-foreground">
          Limpar filtros
        </button>
      )}

      {/* Results */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (history ?? []).length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Calendar className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nenhum registro encontrado.</p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">{history?.length} registro(s) encontrado(s)</p>
          {history?.map((item) => {
            const isStillOut = item.action === "checkout" && item.equipmentId && equipmentsInUse.has(item.equipmentId);
            return (
              <div
                key={item.id}
                className={`rounded-lg border p-3 px-4 ${isStillOut ? "border-amber-200 bg-amber-50/30" : "bg-card"}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${item.action === "checkout" ? "bg-amber-100" : "bg-green-100"}`}>
                    {item.action === "checkout" ? (
                      <ArrowUpCircle className="h-4 w-4 text-amber-600" />
                    ) : (
                      <ArrowDownCircle className="h-4 w-4 text-green-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm">{item.equipmentName}</p>
                      <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full border ${item.action === "checkout" ? "border-amber-300 text-amber-700 bg-amber-50" : "border-green-300 text-green-700 bg-green-50"}`}>
                        {item.action === "checkout" ? "Retirada" : "Devolucao"}
                      </span>
                      {isStillOut && (
                        <span className="text-xs font-medium px-1.5 py-0.5 rounded-full border border-orange-300 text-orange-700 bg-orange-50">
                          Em uso
                        </span>
                      )}
                    </div>
                    {item.project && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Projeto: <span className="font-medium text-foreground">{item.project}</span>
                      </p>
                    )}
                    {item.notes && (
                      <p className="text-xs text-muted-foreground mt-0.5 italic">{item.notes}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(item.usedAt).toLocaleString("pt-BR")}
                    </p>
                  </div>
                  {isStillOut && item.equipmentId && (
                    <button
                      disabled={returnSingleMutation.isPending}
                      onClick={() => {
                        if (confirm(`Devolver "${item.equipmentName}"?`)) {
                          returnSingleMutation.mutate({
                            equipmentIds: [item.equipmentId!],
                            action: "checkin",
                            project: item.project ?? undefined,
                          });
                        }
                      }}
                      className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg border border-green-400 text-green-700 text-xs font-medium hover:bg-green-50 disabled:opacity-50"
                    >
                      {returnSingleMutation.isPending ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <ArrowDownToLine className="h-3 w-3" />
                      )}
                      Devolver
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
