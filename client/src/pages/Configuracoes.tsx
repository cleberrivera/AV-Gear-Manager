import { useAuth } from "@/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import {
  Building2,
  Cog,
  Eye,
  EyeOff,
  ImageIcon,
  Loader2,
  Save,
  Shield,
  ShieldCheck,
  Upload,
  Users,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

// ─── Secoes visiveis por perfil ──────────────────────────────────────────────
const SECTIONS = [
  { key: "registrar_uso", label: "Registrar Uso", description: "Registrar retirada e devolucao de equipamentos" },
  { key: "historico_geral", label: "Historico Geral", description: "Ver registros de todos os usuarios" },
  { key: "disponibilidade", label: "Disponibilidade", description: "Ver quem esta com cada equipamento" },
  { key: "equipamentos", label: "Gerenciar Equipamentos", description: "Criar, editar e excluir equipamentos" },
  { key: "inventario", label: "Inventario", description: "Ver inventario completo com barcodes" },
  { key: "alertas", label: "Alertas de Atraso", description: "Ver e resolver alertas de nao devolucao" },
  { key: "ordens_servico", label: "Ordens de Servico", description: "Visualizar, imprimir e baixar PDF" },
  { key: "scanner", label: "Scanner", description: "Usar scanner de codigo de barras" },
  { key: "exportar_csv", label: "Exportar CSV", description: "Baixar relatorios em CSV" },
];

// ─── Upload de logo ──────────────────────────────────────────────────────────
function LogoUpload({ currentLogoUrl, onUploaded }: { currentLogoUrl: string; onUploaded: (url: string) => void }) {
  const [preview, setPreview] = useState<string>(currentLogoUrl);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();

  useEffect(() => { setPreview(currentLogoUrl); }, [currentLogoUrl]);

  const uploadMutation = trpc.config.uploadLogo.useMutation({
    onSuccess: ({ url }) => {
      toast.success("Logo enviado com sucesso!");
      setPreview(url);
      onUploaded(url);
      utils.config.get.invalidate();
    },
    onError: (e) => toast.error(`Erro ao enviar logo: ${e.message}`),
  });

  const handleFile = useCallback((file: File) => {
    if (!file.type.match(/^image\/(png|jpeg|jpg|svg\+xml|webp)$/)) {
      toast.error("Formato nao suportado. Use PNG, JPG, SVG ou WebP.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Maximo 2MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);

    const base64Reader = new FileReader();
    base64Reader.onload = (e) => {
      const base64 = (e.target?.result as string).split(",")[1];
      uploadMutation.mutate({ fileBase64: base64, mimeType: file.type, fileName: file.name });
    };
    base64Reader.readAsDataURL(file);
  }, [uploadMutation]);

  return (
    <div className="space-y-3">
      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/30"}`}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
      >
        {uploadMutation.isPending ? (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm">Enviando logo...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Upload className="h-8 w-8" />
            <div>
              <p className="text-sm font-medium">Clique para selecionar ou arraste o arquivo</p>
              <p className="text-xs mt-0.5">PNG, JPG, SVG, WebP — maximo 2MB</p>
            </div>
          </div>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
      />
      {preview ? (
        <div className="border rounded-lg p-4 bg-muted/30 relative">
          <p className="text-xs text-muted-foreground mb-2 font-medium">Preview:</p>
          <div className="flex items-center justify-center min-h-16">
            <img src={preview} alt="Logo" className="max-h-20 max-w-full object-contain" onError={() => setPreview("")} />
          </div>
          <button
            className="absolute top-2 right-2 text-muted-foreground hover:text-destructive"
            onClick={(e) => { e.stopPropagation(); setPreview(""); onUploaded(""); }}
            title="Remover logo"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="border rounded-lg p-4 bg-muted/30 flex items-center justify-center min-h-16 text-muted-foreground">
          <div className="flex flex-col items-center gap-1">
            <ImageIcon className="h-6 w-6" />
            <p className="text-xs">Nenhum logo configurado</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Gerenciamento de usuarios ───────────────────────────────────────────────
function UserManagement() {
  const { user: currentUser } = useAuth();
  const utils = trpc.useUtils();
  const { data: users, isLoading } = trpc.users.list.useQuery();

  const setRoleMutation = trpc.users.setRole.useMutation({
    onSuccess: (_, vars) => {
      toast.success(`Papel atualizado para ${vars.role === "admin" ? "Administrador" : "Usuario"}.`);
      utils.users.list.invalidate();
    },
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-8">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando usuarios...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Gerencie os privilegios de cada usuario cadastrado no sistema. Administradores tem acesso completo a todas as funcionalidades.
      </p>
      <div className="divide-y border rounded-lg overflow-hidden">
        {users?.map((u) => {
          const isCurrentUser = u.id === currentUser?.id;
          const isUserAdmin = u.role === "admin";
          return (
            <div key={u.id} className="flex items-center justify-between p-4 bg-card hover:bg-muted/30 transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-sm font-semibold text-primary">
                    {(u.name ?? u.email ?? "?")[0]?.toUpperCase()}
                  </span>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">{u.name ?? "Sem nome"}</p>
                    {isCurrentUser && (
                      <span className="text-xs border rounded-full px-1.5 py-0.5 shrink-0">Voce</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{u.email ?? "—"}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0 ml-4">
                <span className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${isUserAdmin ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                  {isUserAdmin ? <><ShieldCheck className="h-3 w-3" /> Admin</> : <><Shield className="h-3 w-3" /> Usuario</>}
                </span>
                <button
                  disabled={isCurrentUser || setRoleMutation.isPending}
                  onClick={() => setRoleMutation.mutate({ userId: u.id, role: isUserAdmin ? "user" : "admin" })}
                  className="px-3 py-1.5 rounded-lg border text-sm hover:bg-muted disabled:opacity-50"
                >
                  {isUserAdmin ? "Rebaixar" : "Promover"}
                </button>
              </div>
            </div>
          );
        })}
        {!users?.length && (
          <div className="p-8 text-center text-muted-foreground text-sm">Nenhum usuario cadastrado.</div>
        )}
      </div>
    </div>
  );
}

// ─── Permissoes por secao ────────────────────────────────────────────────────
function PermissionsConfig() {
  const utils = trpc.useUtils();
  const { data: config, isLoading } = trpc.config.get.useQuery();
  const [perms, setPerms] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (config) {
      const initial: Record<string, boolean> = {};
      const defaults: Record<string, boolean> = {
        registrar_uso: true, historico_geral: false, disponibilidade: true,
        equipamentos: false, inventario: false, alertas: false,
        ordens_servico: true, scanner: true, exportar_csv: true,
      };
      for (const s of SECTIONS) {
        const stored = config[`perm_user_${s.key}`];
        initial[s.key] = stored !== undefined ? stored === "true" : (defaults[s.key] ?? true);
      }
      setPerms(initial);
    }
  }, [config]);

  const saveMutation = trpc.config.set.useMutation({
    onSuccess: () => { toast.success("Permissoes salvas!"); utils.config.get.invalidate(); },
    onError: (e) => toast.error(`Erro ao salvar: ${e.message}`),
  });

  const handleSave = () => {
    const updates: Record<string, string> = {};
    for (const [key, val] of Object.entries(perms)) {
      updates[`perm_user_${key}`] = val ? "true" : "false";
    }
    saveMutation.mutate(updates);
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-8">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando permissoes...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Defina quais secoes do sistema os <strong>usuarios comuns</strong> podem visualizar. Administradores sempre tem acesso completo.
      </p>
      <div className="rounded-xl border bg-card">
        <div className="p-4 border-b">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Eye className="h-4 w-4" />
            Visibilidade para Usuarios Comuns
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Ative ou desative o acesso a cada secao para perfis nao-administradores.
          </p>
        </div>
        <div className="divide-y">
          {SECTIONS.map((s) => (
            <div key={s.key} className="flex items-center justify-between p-4">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  {perms[s.key] ? <Eye className="h-3.5 w-3.5 text-green-500" /> : <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />}
                  <span className="text-sm font-medium">{s.label}</span>
                  {s.key === "ordens_servico" && perms[s.key] && (
                    <span className="text-xs border rounded-full px-1.5 py-0.5 text-muted-foreground">Somente leitura</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground pl-5">{s.description}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={perms[s.key] ?? false}
                  onChange={(e) => setPerms((p) => ({ ...p, [s.key]: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-muted rounded-full peer peer-checked:bg-primary transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-transform peer-checked:after:translate-x-4" />
              </label>
            </div>
          ))}
        </div>
      </div>
      <div className="flex justify-end">
        <button onClick={handleSave} disabled={saveMutation.isPending} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50">
          {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar Permissoes
        </button>
      </div>
    </div>
  );
}

// ─── Pagina principal ────────────────────────────────────────────────────────
export default function Configuracoes() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const { data: config, isLoading } = trpc.config.get.useQuery();

  const [tab, setTab] = useState<"empresa" | "usuarios" | "permissoes">("empresa");
  const [companyName, setCompanyName] = useState("");
  const [companyFantasy, setCompanyFantasy] = useState("");
  const [companyCnpj, setCompanyCnpj] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [companyPhone, setCompanyPhone] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");
  const [companyLogoUrl, setCompanyLogoUrl] = useState("");
  const [companyWebsite, setCompanyWebsite] = useState("");
  const [osNextNumber, setOsNextNumber] = useState("");

  useEffect(() => {
    if (config) {
      setCompanyName(config.company_name ?? "");
      setCompanyFantasy(config.company_fantasy ?? "");
      setCompanyCnpj(config.company_cnpj ?? "");
      setCompanyAddress(config.company_address ?? "");
      setCompanyPhone(config.company_phone ?? "");
      setCompanyEmail(config.company_email ?? "");
      setCompanyLogoUrl(config.company_logo_url ?? "");
      setCompanyWebsite(config.company_website ?? "");
      setOsNextNumber(config.os_next_number ?? "1");
    }
  }, [config]);

  const saveMutation = trpc.config.set.useMutation({
    onSuccess: () => { toast.success("Configuracoes salvas!"); utils.config.get.invalidate(); },
    onError: (e) => toast.error(`Erro ao salvar: ${e.message}`),
  });

  const handleSave = () => {
    saveMutation.mutate({
      company_name: companyName,
      company_fantasy: companyFantasy,
      company_cnpj: companyCnpj,
      company_address: companyAddress,
      company_phone: companyPhone,
      company_email: companyEmail,
      company_logo_url: companyLogoUrl,
      company_website: companyWebsite,
      os_next_number: osNextNumber,
    });
  };

  if (user?.role !== "admin") {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Cog className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold">Acesso Restrito</h2>
        <p className="text-muted-foreground mt-2">Apenas administradores podem acessar as configuracoes.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configuracoes</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Gerencie a empresa, usuarios e permissoes de acesso ao sistema.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {([
          { key: "empresa" as const, label: "Empresa", icon: Building2 },
          { key: "usuarios" as const, label: "Usuarios", icon: Users },
          { key: "permissoes" as const, label: "Permissoes", icon: Shield },
        ]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Empresa */}
      {tab === "empresa" && (
        <>
          {isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground py-8">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando configuracoes...
            </div>
          ) : (
            <div className="space-y-4">
              {/* Company data */}
              <div className="rounded-xl border bg-card p-4 space-y-4">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Building2 className="h-4 w-4" />
                  Dados da Empresa
                </div>
                <p className="text-xs text-muted-foreground">
                  Estas informacoes aparecem no cabecalho dos documentos (OS, Romaneios).
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Razao Social</label>
                    <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Nome completo da empresa" className="w-full px-3 py-2 rounded-lg border bg-background text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Nome Fantasia</label>
                    <input value={companyFantasy} onChange={(e) => setCompanyFantasy(e.target.value)} placeholder="Nome fantasia" className="w-full px-3 py-2 rounded-lg border bg-background text-sm" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">CNPJ</label>
                  <input value={companyCnpj} onChange={(e) => setCompanyCnpj(e.target.value)} placeholder="00.000.000/0001-00" className="w-full px-3 py-2 rounded-lg border bg-background text-sm max-w-xs" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Endereco</label>
                  <input value={companyAddress} onChange={(e) => setCompanyAddress(e.target.value)} placeholder="Rua, numero, bairro, cidade - UF" className="w-full px-3 py-2 rounded-lg border bg-background text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Telefone</label>
                    <input value={companyPhone} onChange={(e) => setCompanyPhone(e.target.value)} placeholder="(11) 99999-9999" className="w-full px-3 py-2 rounded-lg border bg-background text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">E-mail</label>
                    <input type="email" value={companyEmail} onChange={(e) => setCompanyEmail(e.target.value)} placeholder="contato@empresa.com" className="w-full px-3 py-2 rounded-lg border bg-background text-sm" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Website</label>
                  <input value={companyWebsite} onChange={(e) => setCompanyWebsite(e.target.value)} placeholder="https://www.empresa.com" className="w-full px-3 py-2 rounded-lg border bg-background text-sm" />
                </div>
              </div>

              {/* Logo */}
              <div className="rounded-xl border bg-card p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Upload className="h-4 w-4" />
                  Logo da Empresa
                </div>
                <p className="text-xs text-muted-foreground">
                  Faca upload direto do logo. Aparece no topo dos documentos impressos. Recomendado: fundo transparente, altura maxima 80px.
                </p>
                <LogoUpload currentLogoUrl={companyLogoUrl} onUploaded={(url) => setCompanyLogoUrl(url)} />
              </div>

              {/* OS numbering */}
              <div className="rounded-xl border bg-card p-4 space-y-3">
                <p className="text-sm font-semibold">Numeracao de OS</p>
                <p className="text-xs text-muted-foreground">Controle a numeracao sequencial das Ordens de Servico.</p>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Proximo numero de OS</label>
                  <input type="number" min="1" value={osNextNumber} onChange={(e) => setOsNextNumber(e.target.value)} className="w-full px-3 py-2 rounded-lg border bg-background text-sm max-w-32" />
                  <p className="text-xs text-muted-foreground">A proxima OS criada recebera este numero. Altere apenas se necessario.</p>
                </div>
              </div>

              <hr className="border-border" />
              <div className="flex justify-end">
                <button onClick={handleSave} disabled={saveMutation.isPending} className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50">
                  {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Salvar Configuracoes
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Usuarios */}
      {tab === "usuarios" && <UserManagement />}

      {/* Permissoes */}
      {tab === "permissoes" && <PermissionsConfig />}
    </div>
  );
}
