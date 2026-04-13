import { Route, Switch } from "wouter";
import { Toaster } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import Login from "@/pages/Login";
import Home from "@/pages/Home";
import Scanner from "@/pages/Scanner";
import Disponibilidade from "@/pages/Disponibilidade";
import MeuHistorico from "@/pages/MeuHistorico";
import HistoricoGeral from "@/pages/HistoricoGeral";
import OrdensServico from "@/pages/OrdensServico";
import Inventario from "@/pages/Inventario";
import Alertas from "@/pages/Alertas";
import Equipamentos from "@/pages/Equipamentos";
import Configuracoes from "@/pages/Configuracoes";

function AuthenticatedApp() {
  return (
    <DashboardLayout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/scanner" component={Scanner} />
        <Route path="/disponibilidade" component={Disponibilidade} />
        <Route path="/meu-historico" component={MeuHistorico} />
        <Route path="/historico-geral" component={HistoricoGeral} />
        <Route path="/ordens-servico" component={OrdensServico} />
        <Route path="/inventario" component={Inventario} />
        <Route path="/alertas" component={Alertas} />
        <Route path="/equipamentos" component={Equipamentos} />
        <Route path="/configuracoes" component={Configuracoes} />
        <Route>
          <div className="flex items-center justify-center min-h-[60vh]">
            <p className="text-muted-foreground">Pagina nao encontrada.</p>
          </div>
        </Route>
      </Switch>
    </DashboardLayout>
  );
}

export default function App() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <>
      <Toaster position="top-right" richColors closeButton />
      <Switch>
        <Route path="/login" component={Login} />
        <Route>{isAuthenticated ? <AuthenticatedApp /> : <Login />}</Route>
      </Switch>
    </>
  );
}
