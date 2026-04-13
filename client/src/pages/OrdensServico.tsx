import { useAuth } from "@/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { FileText, Loader2, Plus, Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ServiceOrderCard } from "@/components/ServiceOrderCard";
import { ServiceOrderModal } from "@/components/ServiceOrderModal";
import { ServiceOrderViewModal } from "@/components/ServiceOrderViewModal";
import { OSDocumentModal } from "@/components/OSDocumentModal";

export default function OrdensServico() {
  const { isAdmin } = useAuth();

  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterSearch, setFilterSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [viewId, setViewId] = useState<number | null>(null);
  const [docId, setDocId] = useState<number | null>(null);

  const { data: orders, isLoading, refetch } = trpc.serviceOrder.list.useQuery(
    filterStatus !== "all" ? { status: filterStatus } : {}
  );

  const filtered = (orders ?? []).filter((o) => {
    if (!filterSearch) return true;
    const q = filterSearch.toLowerCase();
    return (
      String(o.orderNumber).includes(q) ||
      (o.project ?? "").toLowerCase().includes(q) ||
      (o.clientName ?? "").toLowerCase().includes(q) ||
      (o.clientFantasy ?? "").toLowerCase().includes(q) ||
      (o.requester ?? "").toLowerCase().includes(q)
    );
  });

  const statusCounts = {
    all: orders?.length ?? 0,
    draft: orders?.filter((o) => o.status === "draft").length ?? 0,
    approved: orders?.filter((o) => o.status === "approved").length ?? 0,
    in_use: orders?.filter((o) => o.status === "in_use").length ?? 0,
    completed: orders?.filter((o) => o.status === "completed").length ?? 0,
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Ordens de Servico</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gerencie as ordens de servico de equipamentos audiovisuais
          </p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Nova OS
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            className="w-full pl-9 px-3 py-2 rounded-lg border bg-background text-sm"
            placeholder="Buscar por no, projeto, cliente..."
            value={filterSearch}
            onChange={(e) => setFilterSearch(e.target.value)}
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 rounded-lg border bg-background text-sm w-full sm:w-48"
        >
          <option value="all">Todos ({statusCounts.all})</option>
          <option value="draft">Rascunho ({statusCounts.draft})</option>
          <option value="approved">Aprovada ({statusCounts.approved})</option>
          <option value="in_use">Em Uso ({statusCounts.in_use})</option>
          <option value="completed">Concluida ({statusCounts.completed})</option>
        </select>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-52 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center mb-4">
            <FileText className="h-7 w-7 text-muted-foreground" />
          </div>
          <p className="font-semibold text-lg">Nenhuma OS encontrada</p>
          <p className="text-sm text-muted-foreground mt-1">
            {filterSearch || filterStatus !== "all"
              ? "Tente ajustar os filtros de busca."
              : "Clique em \"Nova OS\" para criar a primeira ordem de servico."}
          </p>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {filtered.length} ordem{filtered.length !== 1 ? "s" : ""} encontrada{filtered.length !== 1 ? "s" : ""}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((order) => (
              <ServiceOrderCard
                key={order.id}
                order={{
                  id: order.id,
                  orderNumber: order.orderNumber,
                  status: order.status as any,
                  type: order.type as any,
                  project: order.project,
                  clientName: order.clientName,
                  clientFantasy: order.clientFantasy,
                  requester: order.requester,
                  exitAt: order.exitAt,
                  startAt: order.startAt,
                  createdByName: order.createdByName,
                }}
                onView={(id) => setViewId(id)}
                onEdit={(id) => setEditId(id)}
                onDocument={(id) => setDocId(id)}
                onShare={(id) => {
                  const url = `${window.location.origin}/ordens-servico?id=${id}`;
                  navigator.clipboard.writeText(url).then(() => toast.success("Link copiado!"));
                }}
                onDeleted={() => refetch()}
                isAdmin={isAdmin}
              />
            ))}
          </div>
        </>
      )}

      {/* Modals */}
      <ServiceOrderModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSaved={() => refetch()}
      />

      <ServiceOrderModal
        open={!!editId}
        editId={editId}
        onClose={() => setEditId(null)}
        onSaved={() => refetch()}
      />

      <ServiceOrderViewModal
        open={!!viewId}
        orderId={viewId}
        onClose={() => setViewId(null)}
      />

      <OSDocumentModal
        open={!!docId}
        orderId={docId}
        onClose={() => setDocId(null)}
      />
    </div>
  );
}
