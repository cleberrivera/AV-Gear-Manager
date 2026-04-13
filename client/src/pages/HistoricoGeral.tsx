import { trpc } from "@/lib/trpc";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  BarChart3,
  Calendar,
  Download,
  Loader2,
  Search,
  Users,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

const COLORS = ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#06b6d4", "#84cc16", "#f97316"];

export default function HistoricoGeral() {
  const [search, setSearch] = useState("");
  const [action, setAction] = useState<"all" | "checkout" | "checkin">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [userId, setUserId] = useState<string>("all");
  const [equipmentId, setEquipmentId] = useState<string>("all");
  const [tab, setTab] = useState<"lista" | "por-equipamento" | "por-usuario">("lista");

  const { data: equipments } = trpc.equipment.list.useQuery();
  const { data: allUsers } = trpc.users.list.useQuery();

  const { data: history, isLoading } = trpc.usage.allHistory.useQuery({
    action: action !== "all" ? action : undefined,
    dateFrom: dateFrom ? new Date(dateFrom) : undefined,
    dateTo: dateTo ? new Date(dateTo) : undefined,
    userId: userId !== "all" ? parseInt(userId) : undefined,
    equipmentId: equipmentId !== "all" ? parseInt(equipmentId) : undefined,
    search: search || undefined,
    limit: 500,
  });

  const { data: stats } = trpc.usage.stats.useQuery({
    dateFrom: dateFrom ? new Date(dateFrom) : undefined,
    dateTo: dateTo ? new Date(dateTo) : undefined,
  });

  const exportQuery = trpc.usage.exportCsv.useQuery(
    {
      action: action !== "all" ? action : undefined,
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(dateTo) : undefined,
      userId: userId !== "all" ? parseInt(userId) : undefined,
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
      a.download = `historico-geral-${new Date().toISOString().split("T")[0]}.csv`;
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
    setUserId("all");
    setEquipmentId("all");
  };

  const hasFilters = search || action !== "all" || dateFrom || dateTo || userId !== "all" || equipmentId !== "all";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Historico Geral</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Visao completa de todos os registros da equipe.
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

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            placeholder="Buscar projeto ou observacao..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 px-3 py-2 rounded-lg border bg-background text-sm"
          />
        </div>
        <select
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          className="px-3 py-2 rounded-lg border bg-background text-sm"
        >
          <option value="all">Todos os usuarios</option>
          {(allUsers ?? []).map((u) => (
            <option key={u.id} value={String(u.id)}>{u.name ?? "Sem nome"}</option>
          ))}
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
        <select
          value={action}
          onChange={(e) => setAction(e.target.value as typeof action)}
          className="px-3 py-2 rounded-lg border bg-background text-sm"
        >
          <option value="all">Todas as acoes</option>
          <option value="checkout">Retirada</option>
          <option value="checkin">Devolucao</option>
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

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {(["lista", "por-equipamento", "por-usuario"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "lista" ? "Lista" : t === "por-equipamento" ? "Por Equipamento" : "Por Usuario"}
          </button>
        ))}
      </div>

      {/* Lista */}
      {tab === "lista" && (
        <div className="space-y-2">
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
            <>
              <p className="text-xs text-muted-foreground">{history?.length} registro(s) encontrado(s)</p>
              {history?.map((item) => (
                <div key={item.id} className="rounded-lg border bg-card p-3 px-4">
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
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        <span className="font-medium text-foreground">{item.userName ?? "Usuario desconhecido"}</span>
                        {item.project && <> · {item.project}</>}
                      </p>
                      {item.notes && <p className="text-xs text-muted-foreground italic mt-0.5">{item.notes}</p>}
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(item.usedAt).toLocaleString("pt-BR")}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* Por Equipamento */}
      {tab === "por-equipamento" && (
        <div className="space-y-4">
          {stats?.byEquipment && stats.byEquipment.length > 0 ? (
            <>
              <div className="rounded-xl border bg-card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  <p className="text-sm font-semibold">Usos por Equipamento</p>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={stats.byEquipment.slice(0, 10)} layout="vertical" margin={{ left: 0, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="equipmentName" tick={{ fontSize: 11 }} width={140} />
                    <Tooltip formatter={(v: number) => [`${v} usos`, "Total"]} />
                    <Bar dataKey="totalUsages" radius={[0, 4, 4, 0]}>
                      {stats.byEquipment.slice(0, 10).map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2">
                {stats.byEquipment.map((item, i) => (
                  <div key={item.equipmentId} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}</span>
                      <div>
                        <p className="text-sm font-medium">{item.equipmentName}</p>
                        <p className="text-xs text-muted-foreground">{item.equipmentCategory}</p>
                      </div>
                    </div>
                    <span className="text-xs font-medium bg-muted px-2 py-1 rounded-full">{item.totalUsages} usos</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-16 text-muted-foreground">
              <BarChart3 className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Nenhum dado disponivel.</p>
            </div>
          )}
        </div>
      )}

      {/* Por Usuario */}
      {tab === "por-usuario" && (
        <div className="space-y-4">
          {stats?.byUser && stats.byUser.length > 0 ? (
            <>
              <div className="rounded-xl border bg-card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Users className="h-4 w-4 text-primary" />
                  <p className="text-sm font-semibold">Usos por Usuario</p>
                </div>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={stats.byUser} margin={{ left: 0, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="userName" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => [`${v} usos`, "Total"]} />
                    <Bar dataKey="totalUsages" radius={[4, 4, 0, 0]}>
                      {stats.byUser.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2">
                {stats.byUser.map((item, i) => (
                  <div key={item.userId} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}</span>
                      <p className="text-sm font-medium">{item.userName ?? "Usuario desconhecido"}</p>
                    </div>
                    <span className="text-xs font-medium bg-muted px-2 py-1 rounded-full">{item.totalUsages} usos</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-16 text-muted-foreground">
              <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Nenhum dado disponivel.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
