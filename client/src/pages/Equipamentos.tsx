import { useAuth } from "@/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { EQUIPMENT_CATEGORIES } from "@shared/categories";
import { BrowserMultiFormatReader } from "@zxing/library";
import {
  AlertCircle, Camera, CheckCircle, CheckCircle2, Edit, Loader2,
  Package, Plus, QrCode, RefreshCw, Search, Trash2, Upload, XCircle,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

type OcrState =
  | { status: "idle" }
  | { status: "scanning" }
  | { status: "processing" }
  | { status: "success"; value: string; imageUrl: string }
  | { status: "error"; message: string };

type EquipmentForm = {
  name: string;
  category: string;
  brand: string;
  model: string;
  quantity: number;
  description: string;
  isActive: boolean;
  barcode: string;
};

const emptyForm: EquipmentForm = {
  name: "", category: "", brand: "", model: "", quantity: 1,
  description: "", isActive: true, barcode: "",
};

// ─── OCR / Barcode capture component ────────────────────────────────────────
function OcrBarcodeField({ value, onChange, required, disabled }: {
  value: string; onChange: (v: string) => void; required?: boolean; disabled?: boolean;
}) {
  const [ocrState, setOcrState] = useState<OcrState>({ status: "idle" });
  const [mode, setMode] = useState<"camera" | "upload" | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    readerRef.current?.reset();
    readerRef.current = null;
    setMode(null);
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const startCamera = async () => {
    setOcrState({ status: "scanning" });
    setMode("camera");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      const reader = new BrowserMultiFormatReader();
      readerRef.current = reader;
      reader.decodeFromStream(stream, videoRef.current!, (result) => {
        if (result) {
          const code = result.getText();
          stopCamera();
          onChange(code);
          setOcrState({ status: "success", value: code, imageUrl: "" });
          toast.success("Codigo lido com sucesso!");
        }
      });
    } catch {
      stopCamera();
      setOcrState({ status: "error", message: "Nao foi possivel acessar a camera." });
    }
  };

  const processImage = async (file: File) => {
    setOcrState({ status: "processing" });
    setMode("upload");
    const imageUrl = URL.createObjectURL(file);
    try {
      const reader = new BrowserMultiFormatReader();
      const result = await reader.decodeFromImageUrl(imageUrl);
      const code = result.getText();
      onChange(code);
      setOcrState({ status: "success", value: code, imageUrl });
      toast.success("Codigo lido com sucesso!");
    } catch {
      setOcrState({ status: "error", message: "Nao foi possivel ler o codigo. Digite manualmente." });
      onChange("");
    }
  };

  const reset = () => { stopCamera(); setOcrState({ status: "idle" }); setMode(null); onChange(""); };
  const isConfirmed = ocrState.status === "success" || value.trim().length > 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium flex items-center gap-1.5">
          <QrCode className="h-3.5 w-3.5 text-primary" />
          Codigo de Barras (OCR) {required && <span className="text-destructive">*</span>}
        </label>
        {isConfirmed && (
          <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
            <CheckCircle2 className="h-3.5 w-3.5" /> Confirmado
          </span>
        )}
      </div>
      <div className="relative">
        <input
          placeholder="Ex: EQ-001 ou escaneie abaixo..."
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            if (e.target.value) setOcrState({ status: "success", value: e.target.value, imageUrl: "" });
            else setOcrState({ status: "idle" });
          }}
          disabled={disabled}
          className={`w-full px-3 py-2 pr-10 rounded-lg border bg-background text-sm ${isConfirmed ? "border-green-500" : required && !value ? "border-destructive/50" : ""}`}
        />
        {value && (
          <button type="button" onClick={reset} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <XCircle className="h-4 w-4" />
          </button>
        )}
      </div>
      {mode === "camera" && (
        <div className="relative rounded-lg overflow-hidden border bg-black aspect-video">
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
          <div className="absolute bottom-3 left-0 right-0 flex justify-center">
            <button type="button" onClick={stopCamera} className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium flex items-center gap-1.5">
              <XCircle className="h-3.5 w-3.5" /> Cancelar
            </button>
          </div>
          {ocrState.status === "scanning" && (
            <div className="absolute top-3 left-0 right-0 flex justify-center">
              <span className="bg-black/60 text-white text-xs px-3 py-1 rounded-full flex items-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin" /> Aponte para o codigo...
              </span>
            </div>
          )}
        </div>
      )}
      {ocrState.status === "processing" && (
        <div className="flex items-center justify-center py-6 border rounded-lg bg-muted/30">
          <Loader2 className="h-5 w-5 animate-spin text-primary mr-2" />
          <span className="text-sm text-muted-foreground">Lendo codigo...</span>
        </div>
      )}
      {ocrState.status === "error" && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
          <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
          <p className="text-xs text-destructive">{ocrState.message}</p>
        </div>
      )}
      {mode !== "camera" && ocrState.status !== "processing" && (
        <div className="flex gap-2">
          <button type="button" onClick={startCamera} disabled={disabled} className="flex-1 h-9 flex items-center justify-center gap-1.5 rounded-lg border text-sm">
            <Camera className="h-4 w-4" /> Usar Camera
          </button>
          <button type="button" onClick={() => fileInputRef.current?.click()} disabled={disabled} className="flex-1 h-9 flex items-center justify-center gap-1.5 rounded-lg border text-sm">
            <Upload className="h-4 w-4" /> Enviar Foto
          </button>
          {value && (
            <button type="button" onClick={reset} disabled={disabled} className="h-9 px-3 rounded-lg border text-sm">
              <RefreshCw className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
      <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={(e) => { const file = e.target.files?.[0]; if (file) processImage(file); e.target.value = ""; }} />
      {required && !value && ocrState.status !== "scanning" && ocrState.status !== "processing" && (
        <p className="text-xs text-destructive flex items-center gap-1">
          <AlertCircle className="h-3 w-3" /> O codigo de barras e obrigatorio para cadastrar.
        </p>
      )}
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────
export default function Equipamentos() {
  const { isAdmin } = useAuth();
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<EquipmentForm>(emptyForm);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"lista" | "solicitacoes">("lista");

  const { data: equipments, isLoading } = trpc.equipment.list.useQuery({ includeInactive: showInactive });
  const { data: pendingRequests } = trpc.requests.listPending.useQuery(undefined, { enabled: isAdmin });
  const utils = trpc.useUtils();

  const createMut = trpc.equipment.create.useMutation({
    onSuccess: () => { toast.success("Equipamento criado!"); utils.equipment.list.invalidate(); setDialogOpen(false); setForm(emptyForm); },
    onError: (e) => toast.error(e.message),
  });
  const updateMut = trpc.equipment.update.useMutation({
    onSuccess: () => { toast.success("Equipamento atualizado!"); utils.equipment.list.invalidate(); setDialogOpen(false); setEditingId(null); setForm(emptyForm); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMut = trpc.equipment.delete.useMutation({
    onSuccess: () => { toast.success("Equipamento desativado."); utils.equipment.list.invalidate(); setDeleteConfirm(null); },
    onError: (e) => toast.error(e.message),
  });
  const reviewMut = trpc.requests.review.useMutation({
    onSuccess: (_, vars) => {
      toast.success(vars.status === "approved" ? "Aprovado!" : "Rejeitado.");
      utils.requests.listPending.invalidate();
      utils.equipment.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Package className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-40" />
          <p className="font-medium">Acesso restrito</p>
          <p className="text-sm text-muted-foreground mt-1">Apenas administradores podem gerenciar equipamentos.</p>
        </div>
      </div>
    );
  }

  const filtered = (equipments ?? []).filter(
    (eq) =>
      eq.name.toLowerCase().includes(search.toLowerCase()) ||
      (eq.category ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (eq.brand ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (eq.model ?? "").toLowerCase().includes(search.toLowerCase())
  );
  const byCategory = filtered.reduce<Record<string, typeof filtered>>((acc, eq) => {
    const cat = eq.category ?? "Outros";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(eq);
    return acc;
  }, {});
  const categories = Object.keys(byCategory).sort();

  const openCreate = () => { setEditingId(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (eq: (typeof filtered)[0]) => {
    setEditingId(eq.id);
    setForm({ name: eq.name, category: eq.category ?? "", brand: eq.brand ?? "", model: eq.model ?? "", quantity: eq.quantity ?? 1, description: eq.description ?? "", isActive: eq.isActive, barcode: eq.barcode ?? "" });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!form.name.trim()) { toast.warning("Nome e obrigatorio."); return; }
    if (!editingId && !form.barcode.trim()) { toast.error("Codigo de barras e obrigatorio."); return; }
    const payload = { ...form, category: form.category || undefined, brand: form.brand || undefined, model: form.model || undefined, description: form.description || undefined, barcode: form.barcode.trim() || undefined };
    if (editingId) updateMut.mutate({ id: editingId, ...payload });
    else createMut.mutate({ ...payload, barcode: form.barcode.trim() });
  };

  const isPending = createMut.isPending || updateMut.isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Equipamentos</h1>
          <p className="text-muted-foreground text-sm mt-1">Gerencie a lista de equipamentos.</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium">
          <Plus className="h-4 w-4" /> Novo Equipamento
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b">
        <button onClick={() => setActiveTab("lista")} className={`py-2.5 px-4 text-sm font-medium border-b-2 transition-colors ${activeTab === "lista" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>
          Lista de Equipamentos
        </button>
        <button onClick={() => setActiveTab("solicitacoes")} className={`py-2.5 px-4 text-sm font-medium border-b-2 transition-colors relative ${activeTab === "solicitacoes" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>
          Solicitacoes
          {(pendingRequests?.length ?? 0) > 0 && (
            <span className="ml-1.5 inline-flex items-center justify-center h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold">
              {pendingRequests!.length}
            </span>
          )}
        </button>
      </div>

      {activeTab === "lista" && (
        <div className="space-y-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-9 pr-3 py-2 rounded-lg border bg-background text-sm" />
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="accent-primary" />
              Mostrar inativos
            </label>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : categories.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Package className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Nenhum equipamento encontrado.</p>
            </div>
          ) : (
            categories.map((cat) => (
              <div key={cat}>
                <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{cat}</h2>
                <div className="space-y-2">
                  {byCategory[cat].map((eq) => (
                    <div key={eq.id} className={`rounded-lg border bg-card py-3 px-4 ${!eq.isActive ? "opacity-60" : ""}`}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-sm">{eq.name}</p>
                            {!eq.isActive && <span className="text-xs px-1.5 py-0.5 rounded border bg-muted">Inativo</span>}
                            <span className="text-xs px-1.5 py-0.5 rounded border">Qtd: {eq.quantity ?? 1}</span>
                            {eq.barcode && (
                              <span className="text-xs px-1.5 py-0.5 rounded border border-primary/30 bg-primary/5 font-mono text-primary flex items-center gap-1">
                                <QrCode className="h-2.5 w-2.5" />{eq.barcode}
                              </span>
                            )}
                          </div>
                          {(eq.brand || eq.model) && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {eq.brand && <span className="font-medium">{eq.brand}</span>}
                              {eq.brand && eq.model && " · "}
                              {eq.model}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => openEdit(eq)} className="p-1.5 rounded hover:bg-muted"><Edit className="h-3.5 w-3.5" /></button>
                          {eq.isActive && (
                            <button onClick={() => setDeleteConfirm(eq.id)} className="p-1.5 rounded hover:bg-muted text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === "solicitacoes" && <RequestsList reviewMut={reviewMut} />}

      {/* Create/Edit Dialog */}
      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-xl border shadow-lg max-w-md w-full max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <h2 className="text-lg font-semibold">{editingId ? "Editar Equipamento" : "Novo Equipamento"}</h2>
            <OcrBarcodeField value={form.barcode} onChange={(v) => setForm((f) => ({ ...f, barcode: v }))} required={!editingId} disabled={isPending} />
            <div className="border-t pt-4 space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Nome *</label>
                <input placeholder="Ex: Sony FX30" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm">Marca</label>
                  <input placeholder="Sony" value={form.brand} onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm">Modelo</label>
                  <input placeholder="FX30" value={form.model} onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm">Categoria</label>
                  <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm">
                    <option value="">Selecionar</option>
                    {EQUIPMENT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm">Quantidade</label>
                  <input type="number" min={1} value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: parseInt(e.target.value) || 1 }))} className="w-full px-3 py-2 rounded-lg border text-sm" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm">Descricao</label>
                <textarea placeholder="Detalhes..." value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} className="w-full px-3 py-2 rounded-lg border text-sm resize-none" />
              </div>
              {editingId && (
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} className="accent-primary" />
                  Equipamento ativo
                </label>
              )}
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDialogOpen(false)} className="px-4 py-2 rounded-lg border text-sm">Cancelar</button>
              <button onClick={handleSubmit} disabled={isPending} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 flex items-center gap-2">
                {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {editingId ? "Salvar" : "Criar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteConfirm !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-xl border shadow-lg max-w-sm w-full p-6 space-y-4">
            <h2 className="text-lg font-semibold">Desativar Equipamento</h2>
            <p className="text-sm text-muted-foreground">Este equipamento sera desativado. O historico sera preservado.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 rounded-lg border text-sm">Cancelar</button>
              <button onClick={() => deleteConfirm && deleteMut.mutate({ id: deleteConfirm })} disabled={deleteMut.isPending} className="px-4 py-2 rounded-lg bg-destructive text-white text-sm font-medium disabled:opacity-50">
                {deleteMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin inline" />}
                Desativar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RequestsList({ reviewMut }: { reviewMut: any }) {
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const { data: requests, isLoading } = trpc.requests.listAll.useQuery(
    statusFilter !== "all" ? { status: statusFilter as any } : {}
  );
  const [reviewNotes, setReviewNotes] = useState<Record<number, string>>({});
  const statusLabels: Record<string, string> = { pending: "Pendente", approved: "Aprovado", rejected: "Rejeitado" };
  const statusColors: Record<string, string> = { pending: "bg-amber-100 text-amber-800", approved: "bg-green-100 text-green-800", rejected: "bg-red-100 text-red-800" };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {["all", "pending", "approved", "rejected"].map((s) => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${statusFilter === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
            {s === "all" ? "Todas" : statusLabels[s]}
          </button>
        ))}
      </div>
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (requests ?? []).length === 0 ? (
        <div className="text-center py-12 text-muted-foreground"><Package className="h-10 w-10 mx-auto mb-3 opacity-30" /><p className="text-sm">Nenhuma solicitacao.</p></div>
      ) : (
        (requests ?? []).map((req) => (
          <div key={req.id} className="rounded-lg border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-medium text-sm">{req.name}</p>
              <span className={`text-xs px-2 py-0.5 rounded-full border ${statusColors[req.status]}`}>{statusLabels[req.status]}</span>
            </div>
            <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
              {req.category && <span>Categoria: <span className="text-foreground">{req.category}</span></span>}
              {req.brand && <span>Marca: <span className="text-foreground">{req.brand}</span></span>}
              <span>Qtd: <span className="text-foreground">{req.quantity}</span></span>
            </div>
            {req.justification && <p className="text-xs text-muted-foreground italic">"{req.justification}"</p>}
            <p className="text-xs text-muted-foreground">Por <span className="font-medium text-foreground">{req.userName ?? "Usuario"}</span> em {new Date(req.createdAt).toLocaleString("pt-BR")}</p>
            {req.status === "pending" && (
              <div className="space-y-2 pt-1 border-t">
                <input placeholder="Nota para o usuario (opcional)..." value={reviewNotes[req.id] ?? ""}
                  onChange={(e) => setReviewNotes((n) => ({ ...n, [req.id]: e.target.value }))} className="w-full px-3 py-1.5 rounded-lg border text-xs" />
                <div className="flex gap-2">
                  <button onClick={() => reviewMut.mutate({ id: req.id, status: "approved", adminNotes: reviewNotes[req.id] })} disabled={reviewMut.isPending}
                    className="flex-1 py-1.5 rounded-lg bg-green-600 text-white text-xs font-medium flex items-center justify-center gap-1.5">
                    <CheckCircle className="h-3.5 w-3.5" /> Aprovar
                  </button>
                  <button onClick={() => reviewMut.mutate({ id: req.id, status: "rejected", adminNotes: reviewNotes[req.id] })} disabled={reviewMut.isPending}
                    className="flex-1 py-1.5 rounded-lg border text-destructive text-xs font-medium flex items-center justify-center gap-1.5">
                    <XCircle className="h-3.5 w-3.5" /> Rejeitar
                  </button>
                </div>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
