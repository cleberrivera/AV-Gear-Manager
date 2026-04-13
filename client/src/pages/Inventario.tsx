import { useAuth } from "@/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Download, Edit2, Hash, Loader2, Package, QrCode, Search, Tag } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type Equipment = {
  id: number;
  name: string;
  category: string | null;
  brand: string | null;
  model: string | null;
  quantity: number;
  barcode: string | null;
  patrimonyNumber: string | null;
  serialNumber: string | null;
  isActive: boolean;
};

export default function Inventario() {
  const { isAdmin } = useAuth();

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [codeFilter, setCodeFilter] = useState<"all" | "with_barcode" | "no_barcode" | "with_patrimony" | "no_patrimony">("all");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editData, setEditData] = useState<Partial<Equipment>>({});

  const { data: equipmentList, refetch } = trpc.equipment.list.useQuery({ includeInactive: false });
  const updateMutation = trpc.equipment.update.useMutation({
    onSuccess: () => { toast.success("Equipamento atualizado."); refetch(); setEditingId(null); },
    onError: (e) => toast.error(e.message),
  });

  const categories = useMemo(
    () => Array.from(new Set((equipmentList ?? []).map((e) => e.category ?? "Outros"))).sort(),
    [equipmentList]
  );

  const filtered = useMemo(() => {
    return (equipmentList ?? []).filter((e) => {
      const q = search.toLowerCase();
      const matchSearch = !q ||
        e.name.toLowerCase().includes(q) ||
        (e.barcode ?? "").toLowerCase().includes(q) ||
        (e.patrimonyNumber ?? "").toLowerCase().includes(q) ||
        (e.serialNumber ?? "").toLowerCase().includes(q) ||
        (e.brand ?? "").toLowerCase().includes(q);
      const matchCat = categoryFilter === "all" || e.category === categoryFilter;
      const matchCode =
        codeFilter === "all" ? true :
        codeFilter === "with_barcode" ? !!e.barcode :
        codeFilter === "no_barcode" ? !e.barcode :
        codeFilter === "with_patrimony" ? !!e.patrimonyNumber :
        !e.patrimonyNumber;
      return matchSearch && matchCat && matchCode;
    });
  }, [equipmentList, search, categoryFilter, codeFilter]);

  const byCategory = useMemo(() => {
    return filtered.reduce<Record<string, typeof filtered>>((acc, e) => {
      const cat = e.category ?? "Outros";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(e);
      return acc;
    }, {});
  }, [filtered]);

  const handlePrintLabels = () => {
    const printContent = filtered
      .filter((e) => e.barcode || e.patrimonyNumber)
      .map((e) => `
        <div style="border:1px solid #ccc;padding:8px;margin:4px;display:inline-block;width:180px;font-family:monospace;font-size:11px;vertical-align:top;">
          <div style="font-weight:bold;font-size:12px;margin-bottom:4px;">${e.name}</div>
          ${e.brand ? `<div>${e.brand} ${e.model ?? ""}</div>` : ""}
          ${e.barcode ? `<div>Barcode: <b>${e.barcode}</b></div>` : ""}
          ${e.patrimonyNumber ? `<div>Patrimonio: <b>${e.patrimonyNumber}</b></div>` : ""}
          ${e.serialNumber ? `<div>Serial: ${e.serialNumber}</div>` : ""}
        </div>
      `).join("");

    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<html><head><title>Etiquetas</title></head><body>${printContent}</body></html>`);
    win.document.close();
    win.print();
  };

  const handleExportCsv = () => {
    const header = "ID,Nome,Categoria,Marca,Modelo,Quantidade,Barcode,Patrimonio,Serial";
    const lines = filtered.map((e) => [
      e.id,
      `"${e.name}"`,
      `"${e.category ?? ""}"`,
      `"${e.brand ?? ""}"`,
      `"${e.model ?? ""}"`,
      e.quantity,
      `"${e.barcode ?? ""}"`,
      `"${e.patrimonyNumber ?? ""}"`,
      `"${e.serialNumber ?? ""}"`,
    ].join(","));
    const csv = [header, ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inventario_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`CSV exportado com ${filtered.length} equipamentos.`);
  };

  const openEdit = (e: Equipment) => {
    setEditingId(e.id);
    setEditData({ barcode: e.barcode ?? "", patrimonyNumber: e.patrimonyNumber ?? "", serialNumber: e.serialNumber ?? "" });
  };

  const saveEdit = () => {
    if (!editingId) return;
    updateMutation.mutate({
      id: editingId,
      barcode: editData.barcode || undefined,
      patrimonyNumber: editData.patrimonyNumber || undefined,
      serialNumber: editData.serialNumber || undefined,
    });
  };

  const withBarcode = (equipmentList ?? []).filter((e) => e.barcode).length;
  const withPatrimony = (equipmentList ?? []).filter((e) => e.patrimonyNumber).length;
  const total = (equipmentList ?? []).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inventario</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Gerencie barcodes, numeros de patrimonio e seriais dos equipamentos.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={handlePrintLabels} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm hover:bg-muted">
            <Tag className="h-4 w-4" /> Imprimir Etiquetas
          </button>
          <button onClick={handleExportCsv} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm hover:bg-muted">
            <Download className="h-4 w-4" /> Exportar CSV
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border bg-card p-4 text-center">
          <p className="text-2xl font-bold">{total}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Total</p>
        </div>
        <div className="rounded-xl border bg-card p-4 text-center">
          <p className="text-2xl font-bold text-blue-600">{withBarcode}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Com Barcode</p>
        </div>
        <div className="rounded-xl border bg-card p-4 text-center">
          <p className="text-2xl font-bold text-purple-600">{withPatrimony}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Com Patrimonio</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            placeholder="Buscar por nome, barcode, patrimonio..."
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
          <option value="all">Todas</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          value={codeFilter}
          onChange={(e) => setCodeFilter(e.target.value as typeof codeFilter)}
          className="px-3 py-2 rounded-lg border bg-background text-sm min-w-[160px]"
        >
          <option value="all">Todos</option>
          <option value="with_barcode">Com barcode</option>
          <option value="no_barcode">Sem barcode</option>
          <option value="with_patrimony">Com patrimonio</option>
          <option value="no_patrimony">Sem patrimonio</option>
        </select>
      </div>

      {/* Lista por categoria */}
      <div className="space-y-6">
        {Object.keys(byCategory).sort().map((cat) => (
          <div key={cat}>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{cat}</h2>
            <div className="space-y-2">
              {byCategory[cat].map((e) => (
                <div key={e.id} className="rounded-lg border bg-card p-3 px-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm">{e.name}</p>
                      {(e.brand || e.model) && (
                        <p className="text-xs text-muted-foreground">{[e.brand, e.model].filter(Boolean).join(" · ")}</p>
                      )}
                      <div className="flex flex-wrap gap-2 mt-1.5">
                        {e.barcode ? (
                          <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded px-1.5 py-0.5">
                            <QrCode className="h-3 w-3" />{e.barcode}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground border border-dashed rounded px-1.5 py-0.5">
                            <QrCode className="h-3 w-3" />Sem barcode
                          </span>
                        )}
                        {e.patrimonyNumber ? (
                          <span className="inline-flex items-center gap-1 text-xs bg-purple-50 text-purple-700 border border-purple-200 rounded px-1.5 py-0.5">
                            <Hash className="h-3 w-3" />{e.patrimonyNumber}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground border border-dashed rounded px-1.5 py-0.5">
                            <Hash className="h-3 w-3" />Sem patrimonio
                          </span>
                        )}
                        {e.serialNumber && (
                          <span className="inline-flex items-center gap-1 text-xs bg-slate-50 text-slate-600 border border-slate-200 rounded px-1.5 py-0.5">
                            <Package className="h-3 w-3" />{e.serialNumber}
                          </span>
                        )}
                      </div>
                    </div>
                    {isAdmin && (
                      <button
                        onClick={() => openEdit(e as Equipment)}
                        className="h-8 w-8 shrink-0 flex items-center justify-center rounded-lg hover:bg-muted"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Package className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Nenhum equipamento encontrado.</p>
          </div>
        )}
      </div>

      {/* Dialog de edicao de codigos */}
      {editingId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-xl border shadow-lg max-w-md w-full p-6 space-y-4">
            <h2 className="text-lg font-semibold">Editar Codigos de Rastreamento</h2>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Codigo de Barras</label>
                <input
                  placeholder="Ex: EQ-001, 7891234567890..."
                  value={editData.barcode ?? ""}
                  onChange={(e) => setEditData((d) => ({ ...d, barcode: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border bg-background text-sm"
                />
                <p className="text-xs text-muted-foreground">Codigo unico para leitura via scanner laser ou camera.</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Numero de Patrimonio</label>
                <input
                  placeholder="Ex: PAT-2024-001..."
                  value={editData.patrimonyNumber ?? ""}
                  onChange={(e) => setEditData((d) => ({ ...d, patrimonyNumber: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border bg-background text-sm"
                />
                <p className="text-xs text-muted-foreground">Numero de patrimonio da instituicao.</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Numero de Serie</label>
                <input
                  placeholder="Ex: SN-ABC123..."
                  value={editData.serialNumber ?? ""}
                  onChange={(e) => setEditData((d) => ({ ...d, serialNumber: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border bg-background text-sm"
                />
                <p className="text-xs text-muted-foreground">Serial do fabricante (pode ser lido via OCR).</p>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setEditingId(null)} className="flex-1 px-4 py-2 rounded-lg border text-sm">
                Cancelar
              </button>
              <button
                onClick={saveEdit}
                disabled={updateMutation.isPending}
                className="flex-1 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
              >
                {updateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                ) : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
