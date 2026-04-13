import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/useMobile";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  Bell, Camera, ClipboardList, Cog, FileText, History,
  LayoutDashboard, LogOut, Menu, Package, QrCode, Users, Warehouse, X,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { useLocation } from "wouter";

const menuItems = [
  { icon: ClipboardList, label: "Registrar Uso", path: "/" },
  { icon: QrCode, label: "Scanner", path: "/scanner" },
  { icon: LayoutDashboard, label: "Disponibilidade", path: "/disponibilidade" },
  { icon: History, label: "Meu Historico", path: "/meu-historico" },
  { icon: Users, label: "Historico Geral", path: "/historico-geral", adminOnly: true },
  { icon: FileText, label: "Ordens de Servico", path: "/ordens-servico" },
  { icon: Warehouse, label: "Inventario", path: "/inventario" },
  { icon: Bell, label: "Alertas", path: "/alertas" },
  { icon: Package, label: "Equipamentos", path: "/equipamentos", adminOnly: true },
  { icon: Cog, label: "Configuracoes", path: "/configuracoes", adminOnly: true },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, isAdmin } = useAuth();
  const [location, navigate] = useLocation();
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const utils = trpc.useUtils();
  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      utils.auth.me.invalidate();
      navigate("/login");
    },
  });

  const visibleItems = menuItems.filter(
    (item) => !item.adminOnly || isAdmin
  );

  const sidebar = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b flex items-center gap-3">
        <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
          <Camera className="h-4 w-4 text-primary-foreground" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold truncate">AV Gear Manager</p>
          <p className="text-[10px] text-muted-foreground">Gestao de Equipamentos</p>
        </div>
        {isMobile && (
          <button onClick={() => setSidebarOpen(false)} className="ml-auto">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
        {visibleItems.map((item) => {
          const isActive = location === item.path;
          return (
            <button
              key={item.path}
              onClick={() => { navigate(item.path); setSidebarOpen(false); }}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold">
            {user?.name?.charAt(0).toUpperCase() ?? "?"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium truncate">{user?.name}</p>
            <p className="text-[10px] text-muted-foreground truncate">{user?.email}</p>
          </div>
          <button
            onClick={() => logoutMutation.mutate()}
            className="text-muted-foreground hover:text-destructive transition-colors"
            title="Sair"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop sidebar */}
      {!isMobile && (
        <aside className="w-64 border-r bg-card flex-shrink-0">
          {sidebar}
        </aside>
      )}

      {/* Mobile sidebar overlay */}
      {isMobile && sidebarOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 w-64 bg-card border-r z-50">
            {sidebar}
          </aside>
        </>
      )}

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {isMobile && (
          <div className="sticky top-0 z-30 bg-background border-b px-4 py-3 flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)}>
              <Menu className="h-5 w-5" />
            </button>
            <span className="text-sm font-semibold">AV Gear Manager</span>
          </div>
        )}
        <div className="p-4 md:p-6 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
