import { trpc } from "@/lib/trpc";
import { Download, ExternalLink, Loader2, Mail, Printer, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface OSDocumentModalProps {
  open: boolean;
  orderId: number | null;
  onClose: () => void;
}

function fmt(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function fmtLong(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
}

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function buildOSHTML(order: any, config: Record<string, string>): string {
  const typeLabels: Record<string, string> = { saida: "Saida", retorno: "Retorno", renovacao: "Renovacao" };
  const typeLabel = typeLabels[order.type] ?? order.type;
  const logoUrl = config.company_logo_url ?? "";
  const companyName = escHtml(config.company_name ?? "AV Gear Manager");
  const companyAddress = escHtml(config.company_address ?? "");
  const companyPhone = escHtml(config.company_phone ?? "");
  const companyEmail = escHtml(config.company_email ?? "");
  const companyCnpj = escHtml(config.company_cnpj ?? "");

  const logoHtml = logoUrl && /^(https?:\/\/|\/)/i.test(logoUrl)
    ? `<img src="${escHtml(logoUrl)}" alt="${companyName}" style="max-height:80px;max-width:300px;object-fit:contain;" />`
    : `<div style="font-size:24px;font-weight:bold;color:#222;">${companyName}</div>`;

  const itemRows = (order.items ?? [])
    .map((item: any, i: number) =>
      `<tr style="background:${i % 2 === 0 ? "#fff" : "#f9f9f9"};">
        <td style="padding:8px 10px;border:1px solid #ccc;">${escHtml(item.equipmentName)}</td>
        <td style="padding:8px 10px;border:1px solid #ccc;text-align:center;white-space:nowrap;">${item.quantity} ${escHtml(item.equipmentUnit ?? "UN")}</td>
       </tr>`
    ).join("");

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<title>OS No ${order.orderNumber}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#222;background:#fff;}
.page{width:210mm;min-height:297mm;margin:0 auto;padding:20mm 18mm;background:#fff;}
.logo-block{text-align:center;margin-bottom:20px;}
.section{border:1px solid #bbb;margin-bottom:12px;border-radius:2px;}
.section-header{background:#f0f0f0;padding:6px 10px;font-weight:bold;font-size:13px;border-bottom:1px solid #bbb;}
.section-body{padding:8px 10px;}
.section-body p{margin-bottom:4px;line-height:1.5;}
.periods-table,.items-table{width:100%;border-collapse:collapse;}
.periods-table th,.periods-table td{border:1px solid #ccc;padding:7px 10px;font-size:12px;}
.periods-table th{background:#f0f0f0;font-weight:bold;}
.items-table th{background:#f0f0f0;font-weight:bold;padding:8px 10px;border:1px solid #ccc;text-align:left;}
.items-table td{padding:8px 10px;border:1px solid #ccc;}
.sig-block{margin-top:40px;display:flex;justify-content:space-between;gap:30px;}
.sig-line{flex:1;border-top:1px solid #555;padding-top:6px;text-align:center;font-size:11px;color:#555;}
@media print{body{background:#fff;}.page{margin:0;padding:15mm;}}
</style>
</head>
<body>
<div class="page">
<div class="logo-block">
  ${logoHtml}
  ${companyAddress || companyPhone || companyEmail || companyCnpj ? `<div style="font-size:11px;color:#555;margin-top:6px;line-height:1.6;">${companyAddress ? companyAddress + "<br/>" : ""}${companyPhone ? "Tel: " + companyPhone : ""}${companyEmail ? " | " + companyEmail : ""}${companyCnpj ? " | CNPJ: " + companyCnpj : ""}</div>` : ""}
</div>

<div class="section">
  <div class="section-header" style="text-align:center;font-size:14px;">ORDEM DE SERVICO No ${order.orderNumber}</div>
  <div class="section-body">
    <p>${fmtLong(order.createdAt ?? new Date())}</p>
    <p><strong>Identificacao:</strong> ${escHtml(order.project ?? "")}</p>
    ${order.notes ? `<p><strong>Observacoes:</strong> ${escHtml(order.notes)}</p>` : ""}
  </div>
</div>

<div class="section">
  <div class="section-header">Cliente:</div>
  <div class="section-body">
    ${order.clientName || order.clientFantasy
      ? `<p>${order.clientName ? `<strong>Razao Social:</strong> ${escHtml(order.clientName)}` : ""}${order.clientName && order.clientFantasy ? " - " : ""}${order.clientFantasy ? `<strong>Fantasia:</strong> ${escHtml(order.clientFantasy)}` : ""}</p>`
      : "<p>—</p>"}
    ${order.requester || order.requesterPhone || order.requesterEmail
      ? `<p>${order.requester ? `<strong>Solicitante:</strong> ${escHtml(order.requester)}` : ""}${order.requesterPhone ? ` - <strong>Celular:</strong> ${escHtml(order.requesterPhone)}` : ""}${order.requesterEmail ? ` - <strong>Email:</strong> ${escHtml(order.requesterEmail)}` : ""}</p>`
      : ""}
    ${order.clientCnpj ? `<p><strong>CNPJ:</strong> ${escHtml(order.clientCnpj)}</p>` : ""}
  </div>
</div>

<div class="section"><div class="section-header">${escHtml(typeLabel)}</div></div>

<div class="section">
  <div class="section-header">Periodo(s)</div>
  <div class="section-body" style="padding:0;">
    <table class="periods-table">
      <tr><th>Saida</th><th>Inicio</th><th>Fim</th><th>Retorno</th></tr>
      <tr><td>${fmt(order.exitAt ?? order.createdAt)}</td><td>${fmt(order.startAt)}</td><td>${fmt(order.endAt)}</td><td>${fmt(order.returnAt)}</td></tr>
    </table>
  </div>
</div>

<div class="section">
  <div class="section-header">Produto(s)</div>
  <div class="section-body" style="padding:0;">
    <table class="items-table">
      <thead><tr><th style="width:80%;">Produto</th><th style="width:20%;text-align:center;">Quantidade</th></tr></thead>
      <tbody>${itemRows}</tbody>
    </table>
  </div>
</div>

<div class="sig-block">
  <div class="sig-line">Responsavel pela Retirada<br/><span style="font-size:10px;">Data: ___/___/______</span></div>
  <div class="sig-line">Responsavel pela Entrega<br/><span style="font-size:10px;">Data: ___/___/______</span></div>
  <div class="sig-line">${companyName}<br/><span style="font-size:10px;">Carimbo / Assinatura</span></div>
</div>
</div>
</body>
</html>`;
}

export function OSDocumentModal({ open, orderId, onClose }: OSDocumentModalProps) {
  const [emailInput, setEmailInput] = useState("");
  const [showEmailForm, setShowEmailForm] = useState(false);

  const { data, isLoading } = trpc.serviceOrder.generateDocument.useQuery(
    { id: orderId! },
    { enabled: !!orderId && open }
  );

  const sendEmailMutation = trpc.usage.sendDocumentByEmail.useMutation({
    onSuccess: (result) => {
      toast.success("E-mail enviado com sucesso!");
      if (result.previewUrl) {
        toast.info(`Preview (modo teste): ${result.previewUrl}`, { duration: 8000 });
      }
      setShowEmailForm(false);
      setEmailInput("");
    },
    onError: (e) => toast.error(`Erro ao enviar: ${e.message}`),
  });

  const generateHTML = (): string | null => {
    if (!data) return null;
    return buildOSHTML(data.order, data.config);
  };

  const handlePrint = () => {
    const html = generateHTML();
    if (!html) return;
    const win = window.open("", "_blank");
    if (!win) { toast.error("Popup bloqueado. Permita popups para imprimir."); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  };

  const handleOpenNewTab = () => {
    const html = generateHTML();
    if (!html) return;
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  };

  const handleSendEmail = () => {
    if (!emailInput || !emailInput.includes("@")) { toast.error("Informe um e-mail valido."); return; }
    const html = generateHTML();
    if (!html) return;
    const osNum = data?.order?.orderNumber ?? 0;
    sendEmailMutation.mutate({
      tipo: "ROMANEIO_SAIDA",
      email: emailInput,
      html,
      projeto: `OS No${osNum} — ${data?.order?.project ?? ""}`,
    });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/50">
      <div className="bg-card border-b px-6 pt-5 pb-3 shrink-0">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <h2 className="text-lg font-semibold">
            {data?.order ? `OS No${data.order.orderNumber} — ${data.order.project}` : "Documento OS"}
          </h2>
          <button onClick={() => { setShowEmailForm(false); onClose(); }} className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex flex-wrap gap-2 mt-3 max-w-4xl mx-auto">
          <button onClick={handlePrint} disabled={isLoading || !data} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm hover:bg-muted disabled:opacity-50">
            <Printer className="h-3.5 w-3.5" /> Imprimir
          </button>
          <button onClick={() => setShowEmailForm(!showEmailForm)} disabled={isLoading || !data} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm hover:bg-muted disabled:opacity-50">
            <Mail className="h-3.5 w-3.5" /> E-mail
          </button>
          <button onClick={handleOpenNewTab} disabled={isLoading || !data} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm hover:bg-muted disabled:opacity-50">
            <ExternalLink className="h-3.5 w-3.5" /> Nova aba
          </button>
        </div>
        {showEmailForm && (
          <div className="flex gap-2 mt-2 max-w-4xl mx-auto">
            <input
              type="email"
              placeholder="destinatario@email.com"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendEmail()}
              className="flex-1 px-3 py-2 rounded-lg border bg-background text-sm"
            />
            <button onClick={handleSendEmail} disabled={sendEmailMutation.isPending} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50">
              {sendEmailMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar"}
            </button>
          </div>
        )}
      </div>

      {/* Preview */}
      <div className="flex-1 overflow-auto bg-gray-100 p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !data ? (
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            OS nao encontrada.
          </div>
        ) : (
          <div className="bg-white shadow-lg mx-auto" style={{ width: "794px", minHeight: "1123px" }}>
            <iframe
              srcDoc={generateHTML() ?? ""}
              style={{ width: "100%", height: "1123px", border: "none" }}
              title="Preview OS"
            />
          </div>
        )}
      </div>
    </div>
  );
}
