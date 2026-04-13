import { useAuth } from "@/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { EQUIPMENT_CATEGORIES } from "@shared/categories";
import { CheckCircle, ClipboardList, Loader2, PlusCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type EquipmentItem = {
  id: number;
  name: string;
  category: string | null;
  brand?: string | null;
  model?: string | null;
  quantity?: number | null;
};

export default function Home() {
  const { user } = useAuth();
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [action, setAction] = useState<"checkout" | "checkin">("checkout");
  const [project, setProject] = useState("");
  const [notes, setNotes] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [reqDialog, setReqDialog] = useState(false);
  const [reqForm, setReqForm] = useState({
    name: "",
    category: "",
    brand: "",
    model: "",
    quantity: 1,
    justification: "",
  });

  const { data: equipments, isLoading } = trpc.equipment.list.useQuery();
  const utils = trpc.useUtils();

  const registerMutation = trpc.usage.register.useMutation({
    onSuccess: (data) => {
      const osMsg = data.orderNumber ? ` — OS #${data.orderNumber}` : "";
      toast.success(
        `${data.count} equipamento(s) registrado(s)!${osMsg}`
      );
      setSelectedIds([]);
      setProject("");
      setNotes("");
      setSubmitted(true);
      utils.usage.availability.invalidate();
      setTimeout(() => setSubmitted(false), 3000);
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const requestMutation = trpc.requests.create.useMutation({
    onSuccess: () => {
      toast.success("Solicitacao enviada!");
      setReqDialog(false);
      setReqForm({ name: "", category: "", brand: "", model: "", quantity: 1, justification: "" });
    },
    onError: (err) => toast.error(err.message),
  });

  const byCategory = (equipments ?? []).reduce<Record<string, EquipmentItem[]>>(
    (acc, eq) => {
      const cat = eq.category ?? "Outros";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(eq as EquipmentItem);
      return acc;
    },
    {}
  );

  const categories = Object.keys(byCategory).sort();
  const filteredCats =
    categoryFilter === "all"
      ? categories
      : categories.filter((c) => c === categoryFilter);

  const toggleEquipment = (id: number) =>
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIds.length === 0) {
      toast.warning("Selecione ao menos um equipamento.");
      return;
    }
    registerMutation.mutate({
      equipmentIds: selectedIds,
      action,
      project: project || undefined,
      notes: notes || undefined,
    });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Registrar Uso</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Ola, <span className="font-medium text-foreground">{user?.name}</span>. Registre a
            retirada ou devolucao de equipamentos.
          </p>
        </div>
        <button
          onClick={() => setReqDialog(true)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm hover:bg-muted"
        >
          <PlusCircle className="h-4 w-4" /> Solicitar Equipamento
        </button>
      </div>

      {submitted && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-green-50 border border-green-200 text-green-800">
          <CheckCircle className="h-5 w-5 shrink-0" />
          <span className="text-sm font-medium">Registro realizado com sucesso!</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Acao */}
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm font-medium mb-3">Tipo de Acao</p>
          <div className="flex gap-4">
            {(["checkout", "checkin"] as const).map((a) => (
              <label key={a} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="action"
                  value={a}
                  checked={action === a}
                  onChange={() => setAction(a)}
                  className="accent-primary"
                />
                <span className="text-sm font-medium">
                  {a === "checkout" ? "Retirada" : "Devolucao"}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Equipamentos */}
        <div className="rounded-xl border bg-card">
          <div className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Equipamentos</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {selectedIds.length > 0
                    ? `${selectedIds.length} selecionado(s)`
                    : "Selecione os equipamentos"}
                </p>
              </div>
              {selectedIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedIds([])}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Limpar
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5 mt-3">
              <button
                type="button"
                onClick={() => setCategoryFilter("all")}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${categoryFilter === "all" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
              >
                Todos
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${categoryFilter === cat ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
          <div className="p-4 pt-2 space-y-4">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              filteredCats.map((cat) => (
                <div key={cat}>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    {cat}
                  </p>
                  <div className="space-y-2">
                    {byCategory[cat].map((eq) => {
                      const checked = selectedIds.includes(eq.id);
                      const subtitle = [eq.brand, eq.model]
                        .filter(Boolean)
                        .join(" · ");
                      return (
                        <label
                          key={eq.id}
                          className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${checked ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"}`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleEquipment(eq.id)}
                            className="mt-0.5 accent-primary"
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-medium leading-tight">
                              {eq.name}
                            </p>
                            {subtitle && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {subtitle}
                              </p>
                            )}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Detalhes */}
        <div className="rounded-xl border bg-card p-4 space-y-4">
          <p className="text-sm font-medium">Detalhes Opcionais</p>
          <div className="space-y-1.5">
            <label className="text-sm">Projeto / Evento</label>
            <input
              placeholder="Ex: Gravacao Campanha Verao 2025"
              value={project}
              onChange={(e) => setProject(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border bg-background text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm">Observacoes</label>
            <textarea
              placeholder="Condicao do equipamento, localizacao, etc."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 rounded-lg border bg-background text-sm resize-none"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
          <ClipboardList className="h-3.5 w-3.5" />
          <span>
            Data/hora automatica:{" "}
            <strong>{new Date().toLocaleString("pt-BR")}</strong>
          </span>
        </div>

        <button
          type="submit"
          disabled={registerMutation.isPending || selectedIds.length === 0}
          className="w-full py-3 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {registerMutation.isPending && (
            <Loader2 className="h-4 w-4 animate-spin" />
          )}
          Registrar{" "}
          {action === "checkout" ? "Retirada" : "Devolucao"}
          {selectedIds.length > 0 && ` (${selectedIds.length})`}
        </button>
      </form>

      {/* Dialog Solicitacao */}
      {reqDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-xl border shadow-lg max-w-md w-full p-6 space-y-4">
            <h2 className="text-lg font-semibold">Solicitar Novo Equipamento</h2>
            <p className="text-sm text-muted-foreground">
              Nao encontrou o equipamento? Envie uma solicitacao ao administrador.
            </p>
            <div className="space-y-3">
              <input
                placeholder="Nome do Equipamento *"
                value={reqForm.name}
                onChange={(e) => setReqForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border text-sm"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  placeholder="Marca"
                  value={reqForm.brand}
                  onChange={(e) => setReqForm((f) => ({ ...f, brand: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border text-sm"
                />
                <input
                  placeholder="Modelo"
                  value={reqForm.model}
                  onChange={(e) => setReqForm((f) => ({ ...f, model: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border text-sm"
                />
              </div>
              <select
                value={reqForm.category}
                onChange={(e) => setReqForm((f) => ({ ...f, category: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border text-sm"
              >
                <option value="">Categoria</option>
                {EQUIPMENT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <textarea
                placeholder="Justificativa (opcional)"
                value={reqForm.justification}
                onChange={(e) => setReqForm((f) => ({ ...f, justification: e.target.value }))}
                rows={2}
                className="w-full px-3 py-2 rounded-lg border text-sm resize-none"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setReqDialog(false)}
                className="px-4 py-2 rounded-lg border text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (!reqForm.name.trim()) {
                    toast.warning("Informe o nome.");
                    return;
                  }
                  requestMutation.mutate({
                    ...reqForm,
                    category: reqForm.category || undefined,
                    brand: reqForm.brand || undefined,
                    model: reqForm.model || undefined,
                    justification: reqForm.justification || undefined,
                  });
                }}
                disabled={requestMutation.isPending}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 flex items-center gap-2"
              >
                {requestMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Enviar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
