import { useAuth } from "@/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { CheckCircle, Clock, Download, HelpCircle, Loader2, RefreshCw, Search, XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type StatusFilter = "all" | "available" | "in_use" | "no_record";

function getStatus(lastAction: string | null) {
  if (!lastAction) return "no_record";
  if (lastAction === "checkout") return "in_use";
  return "available";
}

const STATUS_CONFIG = {
  in_use: {
    label: "Em Uso",
    badgeClass: "bg-amber-100 text-amber-800 border border-amber-200",
    cardClass: "border-amber-200 bg-amber-50/40",
  },
  available: {
    label: "Disponivel",
    badgeClass: "bg-green-100 text-green-800 border border-green-200",
    cardClass: "border-green-200 bg-green-50/40",
  },
  no_record: {
    label: "Sem Registro",
    badgeClass: "bg-slate-100 text-slate-600 border border-slate-200",
    cardClass: "border-border bg-background",
  },
} as const;

export default function Disponibilidade() {
  const { isAuthenticated } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const { data: availability, isLoading, refetch, isFetching } = trpc.usage.availability.useQuery(undefined, {
    refetchInterval: 30000,
  });

  const exportQuery = trpc.usage.exportAvailabilityCsv.useQuery(undefined, { enabled: false });

  const handleExportCsv = async () => {
    if (!isAuthenticated) { toast.warning("Faca login para exportar."); return; }
    try {
      const result = await exportQuery.refetch();
      if (!result.data) return;
      const blob = new Blob([result.data.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `disponibilidade_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`CSV exportado com ${result.data.count} equipamentos.`);
    } catch {
      toast.error("Erro ao exportar CSV.");
    }
  };

  const allItems = availability ?? [];
  const categories = Array.from(new Set(allItems.map((i) => i.equipmentCategory ?? "Outros"))).sort();

  const filtered = allItems.filter((item) => {
    const status = getStatus(item.lastAction);
    const matchStatus = statusFilter === "all" || status === statusFilter;
    const matchCategory = categoryFilter === "all" || item.equipmentCategory === categoryFilter;
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      item.equipmentName.toLowerCase().includes(q) ||
      (item.equipmentCategory ?? "").toLowerCase().includes(q) ||
      (item.userName ?? "").toLowerCase().includes(q) ||
      (item.lastProject ?? "").toLowerCase().includes(q);
    return matchStatus && matchCategory && matchSearch;
  });

  const byCategory = filtered.reduce<Record<string, typeof filtered>>((acc, item) => {
    const cat = item.equipmentCategory ?? "Outros";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  const filteredCategories = Object.keys(byCategory).sort();

  const countIn = allItems.filter((i) => getStatus(i.lastAction) === "in_use").length;
  const countAvail = allItems.filter((i) => getStatus(i.lastAction) === "available").length;
  const countNone = allItems.filter((i) => getStatus(i.lastAction) === "no_record").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Disponibilidade</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Status atual de todos os equipamentos. Atualizado automaticamente a cada 30 segundos.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            Atualizar
          </button>
          {isAuthenticated && (
            <button
              onClick={handleExportCsv}
              disabled={exportQuery.isFetching}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm hover:bg-muted disabled:opacity-50"
            >
              {exportQuery.isFetching
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Download className="h-4 w-4" />}
              Exportar CSV
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <button
          onClick={() => setStatusFilter(statusFilter === "available" ? "all" : "available")}
          className={`rounded-xl border p-3 text-left transition-all ${statusFilter === "available" ? "ring-2 ring-green-400 border-green-300 bg-green-50" : "border-border bg-card hover:bg-muted/40"}`}
        >
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span className="text-xs text-muted-foreground">Disponivel</span>
          </div>
          <p className="text-2xl font-bold text-green-700">{countAvail}</p>
        </button>
        <button
          onClick={() => setStatusFilter(statusFilter === "in_use" ? "all" : "in_use")}
          className={`rounded-xl border p-3 text-left transition-all ${statusFilter === "in_use" ? "ring-2 ring-amber-400 border-amber-300 bg-amber-50" : "border-border bg-card hover:bg-muted/40"}`}
        >
          <div className="flex items-center gap-2 mb-1">
            <XCircle className="h-4 w-4 text-amber-600" />
            <span className="text-xs text-muted-foreground">Em Uso</span>
          </div>
          <p className="text-2xl font-bold text-amber-700">{countIn}</p>
        </button>
        <button
          onClick={() => setStatusFilter(statusFilter === "no_record" ? "all" : "no_record")}
          className={`rounded-xl border p-3 text-left transition-all ${statusFilter === "no_record" ? "ring-2 ring-slate-400 border-slate-300 bg-slate-50" : "border-border bg-card hover:bg-muted/40"}`}
        >
          <div className="flex items-center gap-2 mb-1">
            <HelpCircle className="h-4 w-4 text-slate-400" />
            <span className="text-xs text-muted-foreground">Sem Registro</span>
          </div>
          <p className="text-2xl font-bold text-slate-600">{countNone}</p>
        </button>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            placeholder="Buscar equipamento, usuario, projeto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 px-3 py-2 rounded-lg border bg-background text-sm"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border bg-background text-sm min-w-[150px]"
        >
          <option value="all">Todas categorias</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-6">
          {filteredCategories.map((cat) => (
            <div key={cat}>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{cat}</h2>
              <div className="grid gap-2">
                {byCategory[cat].map((item) => {
                  const status = getStatus(item.lastAction);
                  const cfg = STATUS_CONFIG[status];
                  const subtitle = [item.equipmentBrand, item.equipmentModel].filter(Boolean).join(" · ");
                  return (
                    <div key={item.equipmentId} className={`rounded-lg border p-3 px-4 ${cfg.cardClass}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm leading-tight">{item.equipmentName}</p>
                          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
                          {status === "in_use" && item.userName && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Com <span className="font-medium text-foreground">{item.userName}</span>
                              {item.lastProject && <> · <span className="italic">{item.lastProject}</span></>}
                            </p>
                          )}
                          {status === "in_use" && item.lastUsedAt && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                              <Clock className="h-3 w-3" />
                              {new Date(item.lastUsedAt).toLocaleString("pt-BR")}
                            </p>
                          )}
                          {status === "available" && item.lastUsedAt && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Devolvido por <span className="font-medium">{item.userName}</span> em {new Date(item.lastUsedAt).toLocaleString("pt-BR")}
                            </p>
                          )}
                        </div>
                        <span className={`shrink-0 text-xs font-medium px-2 py-1 rounded-full ${cfg.badgeClass}`}>
                          {cfg.label}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-sm">Nenhum equipamento encontrado com os filtros selecionados.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
