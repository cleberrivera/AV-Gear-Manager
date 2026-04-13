import { useAuth } from "@/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, Bell, BellOff, CheckCircle2, Clock, Loader2, RefreshCw, Settings2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function Alertas() {
  const { isAdmin } = useAuth();

  const [showResolved, setShowResolved] = useState(false);
  const [resolvingId, setResolvingId] = useState<number | null>(null);
  const [resolveNote, setResolveNote] = useState("");
  const [thresholdHours, setThresholdHours] = useState(24);
  const [showDetectDialog, setShowDetectDialog] = useState(false);

  const utils = trpc.useUtils();

  const { data: alerts, isLoading, refetch, isFetching } = trpc.alerts.list.useQuery(
    { onlyOpen: !showResolved },
    { refetchInterval: 60000 }
  );

  const resolveMutation = trpc.alerts.resolve.useMutation({
    onSuccess: () => {
      toast.success("Alerta resolvido.");
      setResolvingId(null);
      setResolveNote("");
      utils.alerts.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const detectMutation = trpc.alerts.detectOverdue.useMutation({
    onSuccess: (count) => {
      toast.success(count > 0 ? `${count} novo(s) alerta(s) criado(s).` : "Nenhum novo alerta detectado.");
      setShowDetectDialog(false);
      utils.alerts.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const openAlerts = (alerts ?? []).filter((a) => !a.resolvedAt);
  const resolvedAlerts = (alerts ?? []).filter((a) => a.resolvedAt);

  const formatHoursAgo = (date: Date | null) => {
    if (!date) return "";
    const diff = Date.now() - new Date(date).getTime();
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(hours / 24);
    if (days > 0) return `ha ${days} dia${days > 1 ? "s" : ""}`;
    if (hours > 0) return `ha ${hours}h`;
    return "ha menos de 1h";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            Alertas
            {openAlerts.length > 0 && (
              <span className="bg-red-500 text-white text-xs font-medium px-1.5 py-0.5 rounded-full">
                {openAlerts.length}
              </span>
            )}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Equipamentos em atraso — nao devolvidos apos o prazo configurado.
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
          {isAdmin && (
            <button
              onClick={() => setShowDetectDialog(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm hover:bg-muted"
            >
              <Settings2 className="h-4 w-4" />
              Detectar Atrasos
            </button>
          )}
        </div>
      </div>

      {/* Toggle resolvidos */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={showResolved}
          onChange={(e) => setShowResolved(e.target.checked)}
          className="accent-primary"
        />
        <span className="text-sm">Mostrar alertas resolvidos</span>
      </label>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Alertas abertos */}
          {openAlerts.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                Alertas Abertos ({openAlerts.length})
              </h2>
              <div className="space-y-3">
                {openAlerts.map((alert) => (
                  <div key={alert.id} className="rounded-lg border border-red-200 bg-red-50/40 p-3 px-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-sm">{alert.equipmentName}</p>
                          <span className="text-xs font-medium bg-red-100 text-red-700 border border-red-200 px-1.5 py-0.5 rounded-full">
                            {alert.alertType === "overdue" ? "Em Atraso" : "Extraviado"}
                          </span>
                        </div>
                        {alert.equipmentCategory && (
                          <p className="text-xs text-muted-foreground">{alert.equipmentCategory}</p>
                        )}
                        <div className="mt-1.5 space-y-0.5">
                          <p className="text-xs text-muted-foreground">
                            <span className="font-medium text-foreground">{alert.userName ?? "Usuario desconhecido"}</span>
                            {" "}esta com este equipamento
                          </p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Retirada {formatHoursAgo(alert.createdAt)} · limite: {alert.thresholdHours}h
                          </p>
                          {alert.equipmentBarcode && (
                            <p className="text-xs text-muted-foreground">Barcode: {alert.equipmentBarcode}</p>
                          )}
                          {alert.equipmentPatrimony && (
                            <p className="text-xs text-muted-foreground">Patrimonio: {alert.equipmentPatrimony}</p>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => setResolvingId(alert.id)}
                        className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-green-300 text-green-700 text-xs font-medium hover:bg-green-50"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Resolver
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Alertas resolvidos */}
          {showResolved && resolvedAlerts.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                Resolvidos ({resolvedAlerts.length})
              </h2>
              <div className="space-y-2">
                {resolvedAlerts.map((alert) => (
                  <div key={alert.id} className="rounded-lg border border-green-200 bg-green-50/30 opacity-70 p-2.5 px-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{alert.equipmentName}</p>
                        <p className="text-xs text-muted-foreground">
                          {alert.userName} · resolvido {formatHoursAgo(alert.resolvedAt)}
                        </p>
                        {alert.notes && <p className="text-xs text-muted-foreground italic mt-0.5">{alert.notes}</p>}
                      </div>
                      <span className="shrink-0 text-xs font-medium bg-green-100 text-green-700 border border-green-200 px-1.5 py-0.5 rounded-full">
                        Resolvido
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Estado vazio */}
          {openAlerts.length === 0 && (!showResolved || resolvedAlerts.length === 0) && (
            <div className="text-center py-16 text-muted-foreground">
              <BellOff className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">Nenhum alerta aberto</p>
              <p className="text-xs mt-1">
                {isAdmin
                  ? "Clique em \"Detectar Atrasos\" para verificar equipamentos nao devolvidos."
                  : "Todos os equipamentos estao dentro do prazo."}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Dialog: Resolver alerta */}
      {resolvingId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-xl border shadow-lg max-w-md w-full p-6 space-y-4">
            <h2 className="text-lg font-semibold">Resolver Alerta</h2>
            <p className="text-sm text-muted-foreground">
              Marque este alerta como resolvido. Isso indica que o equipamento foi devolvido ou a situacao foi regularizada.
            </p>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Observacao <span className="text-muted-foreground text-xs">(opcional)</span>
              </label>
              <input
                placeholder="Ex: Equipamento devolvido pessoalmente..."
                value={resolveNote}
                onChange={(e) => setResolveNote(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border bg-background text-sm"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setResolvingId(null); setResolveNote(""); }}
                className="flex-1 px-4 py-2 rounded-lg border text-sm"
              >
                Cancelar
              </button>
              <button
                disabled={resolveMutation.isPending}
                onClick={() => resolvingId && resolveMutation.mutate({ id: resolvingId, notes: resolveNote || undefined })}
                className="flex-1 px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50"
              >
                {resolveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Confirmar Resolucao"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dialog: Detectar atrasos (admin) */}
      {showDetectDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-xl border shadow-lg max-w-md w-full p-6 space-y-4">
            <h2 className="text-lg font-semibold">Detectar Equipamentos em Atraso</h2>
            <p className="text-sm text-muted-foreground">
              O sistema vai verificar todos os checkouts sem devolucao correspondente que ultrapassaram o limite de horas configurado.
            </p>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Limite de horas sem devolucao</label>
              <input
                type="number"
                min={1}
                max={168}
                value={thresholdHours}
                onChange={(e) => setThresholdHours(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border bg-background text-sm"
              />
              <p className="text-xs text-muted-foreground">Padrao: 24h. Equipamentos retirados ha mais tempo sem devolucao serao alertados.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowDetectDialog(false)}
                className="flex-1 px-4 py-2 rounded-lg border text-sm"
              >
                Cancelar
              </button>
              <button
                disabled={detectMutation.isPending}
                onClick={() => detectMutation.mutate({ thresholdHours })}
                className="flex-1 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {detectMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
                Verificar Agora
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
