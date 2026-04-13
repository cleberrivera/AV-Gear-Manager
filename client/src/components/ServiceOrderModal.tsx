import { trpc } from "@/lib/trpc";
import { Loader2, Minus, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface ItemRow {
  equipmentId: number;
  equipmentName: string;
  equipmentUnit: string;
  quantity: number;
  notes: string;
}

interface ServiceOrderModalProps {
  open: boolean;
  onClose: () => void;
  editId?: number | null;
  onSaved?: () => void;
}

function toDatetimeLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function ServiceOrderModal({ open, onClose, editId, onSaved }: ServiceOrderModalProps) {
  const isEdit = !!editId;
  const utils = trpc.useUtils();

  const [type, setType] = useState<"saida" | "retorno" | "renovacao">("saida");
  const [project, setProject] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientFantasy, setClientFantasy] = useState("");
  const [clientCnpj, setClientCnpj] = useState("");
  const [requester, setRequester] = useState("");
  const [requesterPhone, setRequesterPhone] = useState("");
  const [requesterEmail, setRequesterEmail] = useState("");
  const [exitAt, setExitAt] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [returnAt, setReturnAt] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<ItemRow[]>([
    { equipmentId: 0, equipmentName: "", equipmentUnit: "UN", quantity: 1, notes: "" },
  ]);
  const [equipSearch, setEquipSearch] = useState<string[]>([""]);

  const { data: equipmentList } = trpc.equipment.list.useQuery({ includeInactive: false });
  const { data: existingOrder } = trpc.serviceOrder.getById.useQuery(
    { id: editId! },
    { enabled: isEdit && open }
  );

  useEffect(() => {
    if (existingOrder && isEdit) {
      setType(existingOrder.type as "saida" | "retorno" | "renovacao");
      setProject(existingOrder.project ?? "");
      setClientName(existingOrder.clientName ?? "");
      setClientFantasy(existingOrder.clientFantasy ?? "");
      setClientCnpj(existingOrder.clientCnpj ?? "");
      setRequester(existingOrder.requester ?? "");
      setRequesterPhone(existingOrder.requesterPhone ?? "");
      setRequesterEmail(existingOrder.requesterEmail ?? "");
      setExitAt(existingOrder.exitAt ? toDatetimeLocal(new Date(existingOrder.exitAt)) : "");
      setStartAt(existingOrder.startAt ? toDatetimeLocal(new Date(existingOrder.startAt)) : "");
      setEndAt(existingOrder.endAt ? toDatetimeLocal(new Date(existingOrder.endAt)) : "");
      setReturnAt(existingOrder.returnAt ? toDatetimeLocal(new Date(existingOrder.returnAt)) : "");
      setNotes(existingOrder.notes ?? "");
      if (existingOrder.items && existingOrder.items.length > 0) {
        setItems(existingOrder.items.map((i) => ({
          equipmentId: i.equipmentId,
          equipmentName: i.equipmentName,
          equipmentUnit: i.equipmentUnit ?? "UN",
          quantity: i.quantity,
          notes: i.notes ?? "",
        })));
        setEquipSearch(existingOrder.items.map((i) => i.equipmentName));
      }
    }
  }, [existingOrder, isEdit]);

  const resetForm = () => {
    setType("saida");
    setProject("");
    setClientName("");
    setClientFantasy("");
    setClientCnpj("");
    setRequester("");
    setRequesterPhone("");
    setRequesterEmail("");
    setExitAt(toDatetimeLocal(new Date()));
    setStartAt("");
    setEndAt("");
    setReturnAt("");
    setNotes("");
    setItems([{ equipmentId: 0, equipmentName: "", equipmentUnit: "UN", quantity: 1, notes: "" }]);
    setEquipSearch([""]);
  };

  const createMutation = trpc.serviceOrder.create.useMutation({
    onSuccess: (data) => {
      toast.success(`OS No${data.orderNumber} criada com sucesso!`);
      utils.serviceOrder.list.invalidate();
      resetForm();
      onSaved?.();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.serviceOrder.update.useMutation({
    onSuccess: () => {
      toast.success("OS atualizada com sucesso!");
      utils.serviceOrder.list.invalidate();
      onSaved?.();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = () => {
    if (!project.trim()) { toast.error("Informe o projeto/identificacao."); return; }
    const validItems = items.filter((i) => i.equipmentName.trim() && i.quantity > 0);
    if (validItems.length === 0) { toast.error("Adicione pelo menos um equipamento."); return; }

    const payload = {
      type,
      project: project.trim(),
      clientName: clientName || undefined,
      clientFantasy: clientFantasy || undefined,
      clientCnpj: clientCnpj || undefined,
      requester: requester || undefined,
      requesterPhone: requesterPhone || undefined,
      requesterEmail: requesterEmail || undefined,
      exitAt: exitAt ? new Date(exitAt) : undefined,
      startAt: startAt ? new Date(startAt) : undefined,
      endAt: endAt ? new Date(endAt) : undefined,
      returnAt: returnAt ? new Date(returnAt) : undefined,
      notes: notes || undefined,
      items: validItems.map((i) => ({
        equipmentId: i.equipmentId || 0,
        equipmentName: i.equipmentName.trim(),
        equipmentUnit: i.equipmentUnit || "UN",
        quantity: i.quantity,
        notes: i.notes || undefined,
      })),
    };

    if (isEdit) {
      updateMutation.mutate({ id: editId!, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const addItem = () => {
    setItems((prev) => [...prev, { equipmentId: 0, equipmentName: "", equipmentUnit: "UN", quantity: 1, notes: "" }]);
    setEquipSearch((prev) => [...prev, ""]);
  };

  const removeItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
    setEquipSearch((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateItem = (idx: number, field: keyof ItemRow, value: string | number) => {
    setItems((prev) => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };

  const selectEquipment = (idx: number, equip: { id: number; name: string; brand?: string | null; model?: string | null }) => {
    const fullName = [equip.name, equip.brand, equip.model].filter(Boolean).join(" - ");
    setItems((prev) => prev.map((item, i) => i === idx ? { ...item, equipmentId: equip.id, equipmentName: fullName } : item));
    setEquipSearch((prev) => prev.map((s, i) => i === idx ? fullName : s));
  };

  const filteredEquipments = (search: string) =>
    (equipmentList ?? []).filter((e) =>
      !search || e.name.toLowerCase().includes(search.toLowerCase()) ||
      (e.brand ?? "").toLowerCase().includes(search.toLowerCase())
    ).slice(0, 8);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card rounded-xl border shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4">
        <h2 className="text-lg font-semibold">{isEdit ? "Editar Ordem de Servico" : "Nova Ordem de Servico"}</h2>

        {/* Type + Project */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-sm font-medium">Tipo *</label>
            <select value={type} onChange={(e) => setType(e.target.value as any)} className="w-full px-3 py-2 rounded-lg border bg-background text-sm">
              <option value="saida">Saida</option>
              <option value="retorno">Retorno</option>
              <option value="renovacao">Renovacao</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Projeto / Identificacao *</label>
            <input value={project} onChange={(e) => setProject(e.target.value)} placeholder="Ex: Gravacao Comercial" className="w-full px-3 py-2 rounded-lg border bg-background text-sm" />
          </div>
        </div>

        {/* Client */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-sm font-medium">Razao Social</label>
            <input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Nome da empresa" className="w-full px-3 py-2 rounded-lg border bg-background text-sm" />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Nome Fantasia</label>
            <input value={clientFantasy} onChange={(e) => setClientFantasy(e.target.value)} placeholder="Nome fantasia" className="w-full px-3 py-2 rounded-lg border bg-background text-sm" />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">CNPJ</label>
          <input value={clientCnpj} onChange={(e) => setClientCnpj(e.target.value)} placeholder="00.000.000/0001-00" className="w-full px-3 py-2 rounded-lg border bg-background text-sm max-w-xs" />
        </div>

        {/* Requester */}
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-sm font-medium">Solicitante</label>
            <input value={requester} onChange={(e) => setRequester(e.target.value)} placeholder="Nome" className="w-full px-3 py-2 rounded-lg border bg-background text-sm" />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Celular</label>
            <input value={requesterPhone} onChange={(e) => setRequesterPhone(e.target.value)} placeholder="(11) 99999-9999" className="w-full px-3 py-2 rounded-lg border bg-background text-sm" />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">E-mail</label>
            <input type="email" value={requesterEmail} onChange={(e) => setRequesterEmail(e.target.value)} placeholder="email@empresa.com" className="w-full px-3 py-2 rounded-lg border bg-background text-sm" />
          </div>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-sm font-medium">Saida</label>
            <input type="datetime-local" value={exitAt} onChange={(e) => setExitAt(e.target.value)} className="w-full px-3 py-2 rounded-lg border bg-background text-sm" />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Inicio</label>
            <input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} className="w-full px-3 py-2 rounded-lg border bg-background text-sm" />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Fim</label>
            <input type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} className="w-full px-3 py-2 rounded-lg border bg-background text-sm" />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Retorno</label>
            <input type="datetime-local" value={returnAt} onChange={(e) => setReturnAt(e.target.value)} className="w-full px-3 py-2 rounded-lg border bg-background text-sm" />
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-1">
          <label className="text-sm font-medium">Observacoes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observacoes adicionais..." rows={2} className="w-full px-3 py-2 rounded-lg border bg-background text-sm resize-none" />
        </div>

        {/* Equipment items */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-base font-semibold">Equipamentos *</label>
            <button type="button" onClick={addItem} className="flex items-center gap-1 px-2.5 py-1 rounded-lg border text-sm hover:bg-muted">
              <Plus className="h-3.5 w-3.5" /> Adicionar
            </button>
          </div>

          {items.map((item, idx) => (
            <div key={idx} className="border rounded-lg p-3 space-y-2 bg-muted/30">
              <div className="flex items-center gap-2">
                <div className="flex-1 relative">
                  <input
                    value={equipSearch[idx] ?? item.equipmentName}
                    onChange={(e) => {
                      setEquipSearch((prev) => prev.map((s, i) => i === idx ? e.target.value : s));
                      updateItem(idx, "equipmentName", e.target.value);
                      updateItem(idx, "equipmentId", 0);
                    }}
                    placeholder="Buscar equipamento..."
                    className="w-full px-3 py-2 rounded-lg border bg-background text-sm"
                  />
                  {equipSearch[idx] && filteredEquipments(equipSearch[idx]).length > 0 && item.equipmentId === 0 && (
                    <div className="absolute z-50 top-full left-0 right-0 bg-card border rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                      {filteredEquipments(equipSearch[idx]).map((e) => (
                        <button
                          key={e.id}
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
                          onClick={() => selectEquipment(idx, e)}
                        >
                          <span className="font-medium">{e.name}</span>
                          {(e.brand || e.model) && (
                            <span className="text-muted-foreground ml-1">— {[e.brand, e.model].filter(Boolean).join(" ")}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <input
                  type="text"
                  value={item.equipmentUnit}
                  onChange={(e) => updateItem(idx, "equipmentUnit", e.target.value)}
                  placeholder="UN"
                  className="w-20 px-3 py-2 rounded-lg border bg-background text-sm"
                />

                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => updateItem(idx, "quantity", Math.max(1, item.quantity - 1))} className="h-8 w-8 rounded-lg border flex items-center justify-center hover:bg-muted">
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                  <button type="button" onClick={() => updateItem(idx, "quantity", item.quantity + 1)} className="h-8 w-8 rounded-lg border flex items-center justify-center hover:bg-muted">
                    <Plus className="h-3 w-3" />
                  </button>
                </div>

                {items.length > 1 && (
                  <button type="button" onClick={() => removeItem(idx)} className="h-8 w-8 flex items-center justify-center text-destructive hover:bg-destructive/10 rounded-lg">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <button onClick={() => { resetForm(); onClose(); }} disabled={isPending} className="px-4 py-2 rounded-lg border text-sm">
            Cancelar
          </button>
          <button onClick={handleSubmit} disabled={isPending} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 flex items-center gap-2">
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEdit ? "Salvar Alteracoes" : "Criar OS"}
          </button>
        </div>
      </div>
    </div>
  );
}
