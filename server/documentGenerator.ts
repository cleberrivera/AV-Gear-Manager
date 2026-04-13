/**
 * Gerador de documentos HTML para Romaneios e Nota Fiscal de Transporte.
 * Cada função retorna HTML completo com layout A4, pronto para impressão / PDF.
 *
 * SEGURANÇA: Todos os dados dinâmicos são sanitizados contra XSS.
 */

import type { DocumentType } from "../shared/documents";

// ─── XSS Sanitization ───────────────────────────────────────────────────────

function escapeHtml(str: string | null | undefined): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/** Alias curto para uso nos templates */
const h = escapeHtml;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface UsageRecord {
  id: number;
  userName?: string | null;
  equipmentName?: string | null;
  equipmentCategory?: string | null;
  equipmentBarcode?: string | null;
  equipmentPatrimony?: string | null;
  equipmentBrand?: string | null;
  equipmentModel?: string | null;
  action: string;
  project?: string | null;
  notes?: string | null;
  usedAt?: Date | string | null;
}

export interface DocumentData {
  tipo: DocumentType;
  registros: UsageRecord[];
  geradoPor: string;
  geradoEm: Date;
  projeto?: string;
  observacoes?: string;
  companyName?: string;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
  companyCnpj?: string;
  companyLogoUrl?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TIPO_LABELS: Record<DocumentType, string> = {
  ROMANEIO_SAIDA: "Romaneio de Saída",
  ROMANEIO_RETORNO: "Romaneio de Retorno",
  ROMANEIO_RENOVACAO: "Romaneio de Renovação",
  NOTA_FISCAL_TRANSPORTE: "Nota Fiscal de Transporte",
};

const TIPO_DESCRICOES: Record<DocumentType, string> = {
  ROMANEIO_SAIDA: "Documento de retirada de equipamentos para uso em produção audiovisual.",
  ROMANEIO_RETORNO: "Documento de devolução de equipamentos ao almoxarifado.",
  ROMANEIO_RENOVACAO: "Documento de extensão do período de uso dos equipamentos.",
  NOTA_FISCAL_TRANSPORTE: "Documento fiscal de transporte de equipamentos audiovisuais.",
};

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function formatDateShort(d: Date): string {
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function docNumber(tipo: DocumentType, geradoEm: Date): string {
  const prefix: Record<DocumentType, string> = {
    ROMANEIO_SAIDA: "RS",
    ROMANEIO_RETORNO: "RR",
    ROMANEIO_RENOVACAO: "RN",
    NOTA_FISCAL_TRANSPORTE: "NF",
  };
  const ts = geradoEm.getTime().toString().slice(-6);
  return `${prefix[tipo]}-${ts}`;
}

// ─── Romaneio Template ───────────────────────────────────────────────────────

function gerarRomaneioHTML(data: DocumentData): string {
  const { tipo, registros, geradoPor, geradoEm, projeto, observacoes } = data;
  const titulo = TIPO_LABELS[tipo];
  const descricao = TIPO_DESCRICOES[tipo];
  const numero = docNumber(tipo, geradoEm);

  const companyName = h(data.companyName) || "AV Gear Manager";
  const companyAddress = h(data.companyAddress);
  const companyPhone = h(data.companyPhone);
  const companyEmail = h(data.companyEmail);
  const companyCnpj = h(data.companyCnpj);
  const companyLogoUrl = data.companyLogoUrl;

  // Logo: se URL configurada, validamos que é uma URL real (não um script)
  const isValidUrl = companyLogoUrl && /^https?:\/\/.+/i.test(companyLogoUrl);
  const logoHtml = isValidUrl
    ? `<img src="${h(companyLogoUrl)}" alt="${companyName}" style="max-height:70px;max-width:250px;object-fit:contain;" />`
    : `<div style="font-size:20px;font-weight:700;color:#1e3a5f;">${companyName}</div>`;

  // Agrupar por usuário para assinaturas
  const porUsuario = registros.reduce<Record<string, UsageRecord[]>>((acc, r) => {
    const user = r.userName ?? "Usuário desconhecido";
    if (!acc[user]) acc[user] = [];
    acc[user].push(r);
    return acc;
  }, {});

  const tabelaLinhas = registros.map((r, i) => `
    <tr style="background:${i % 2 === 0 ? "#fff" : "#f9f9f9"};">
      <td style="padding:7px 8px;border:1px solid #ddd;text-align:center;">${i + 1}</td>
      <td style="padding:7px 8px;border:1px solid #ddd;">${h(r.equipmentName) || "—"}</td>
      <td style="padding:7px 8px;border:1px solid #ddd;text-align:center;">${h(r.equipmentCategory) || "—"}</td>
      <td style="padding:7px 8px;border:1px solid #ddd;text-align:center;">${h(r.equipmentBarcode) || "—"}</td>
      <td style="padding:7px 8px;border:1px solid #ddd;text-align:center;">${h(r.equipmentPatrimony) || "—"}</td>
      <td style="padding:7px 8px;border:1px solid #ddd;">${r.equipmentBrand ? `${h(r.equipmentBrand)}${r.equipmentModel ? ` · ${h(r.equipmentModel)}` : ""}` : "—"}</td>
      <td style="padding:7px 8px;border:1px solid #ddd;text-align:center;">${h(r.userName) || "—"}</td>
      <td style="padding:7px 8px;border:1px solid #ddd;text-align:center;">${formatDate(r.usedAt)}</td>
    </tr>`).join("");

  const assinaturas = Object.keys(porUsuario).map((user) => `
    <div style="flex:1;min-width:180px;text-align:center;">
      <div style="border-top:1px solid #555;padding-top:6px;margin-top:40px;">
        <div style="font-weight:600;font-size:12px;">${h(user)}</div>
        <div style="font-size:10px;color:#666;margin-top:2px;">Responsável pela ${tipo === "ROMANEIO_SAIDA" ? "retirada" : tipo === "ROMANEIO_RETORNO" ? "devolução" : "movimentação"}</div>
      </div>
    </div>`).join("");

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>${h(titulo)} — ${numero}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #1a1a1a; background: #fff; }
    .page { width: 210mm; min-height: 297mm; margin: 0 auto; padding: 15mm 15mm 20mm; background: #fff; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th { background: #1e3a5f; color: #fff; padding: 8px; text-align: left; font-size: 11px; }
    th.center { text-align: center; }
    @media print { body { padding: 0; } .page { padding: 10mm; width: 100%; } @page { size: A4; margin: 0; } }
  </style>
</head>
<body>
<div class="page">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #1e3a5f;padding-bottom:12px;margin-bottom:16px;">
    <div>
      ${logoHtml}
      ${companyAddress || companyPhone || companyEmail || companyCnpj
        ? `<div style="font-size:10px;color:#555;margin-top:6px;line-height:1.6;">
            ${companyAddress ? companyAddress + "<br/>" : ""}
            ${companyPhone ? "Tel: " + companyPhone : ""}${companyEmail ? " | " + companyEmail : ""}
            ${companyCnpj ? "<br/>CNPJ: " + companyCnpj : ""}
           </div>`
        : ""}
    </div>
    <div style="text-align:right;">
      <div style="font-size:16px;font-weight:700;color:#1e3a5f;">${h(titulo)}</div>
      <div style="font-size:13px;color:#444;margin-top:2px;">Nº ${numero}</div>
      <div style="font-size:10px;color:#888;margin-top:2px;">Emitido em: ${formatDate(geradoEm)}</div>
    </div>
  </div>

  <div style="font-size:11px;color:#555;margin-bottom:14px;">${descricao}</div>

  <div style="display:flex;gap:12px;margin-bottom:14px;">
    <div style="flex:1;border:1px solid #ddd;border-radius:4px;padding:10px;">
      <div style="font-weight:700;font-size:11px;color:#1e3a5f;margin-bottom:6px;border-bottom:1px solid #eee;padding-bottom:4px;">INFORMAÇÕES GERAIS</div>
      <p style="margin-bottom:3px;"><strong>Documento Nº:</strong> ${numero}</p>
      <p style="margin-bottom:3px;"><strong>Data de Emissão:</strong> ${formatDateShort(geradoEm)}</p>
      <p style="margin-bottom:3px;"><strong>Gerado por:</strong> ${h(geradoPor)}</p>
      <p><strong>Total de itens:</strong> ${registros.length}</p>
    </div>
    <div style="flex:1;border:1px solid #ddd;border-radius:4px;padding:10px;">
      <div style="font-weight:700;font-size:11px;color:#1e3a5f;margin-bottom:6px;border-bottom:1px solid #eee;padding-bottom:4px;">PROJETO / EVENTO</div>
      <p style="margin-bottom:3px;"><strong>Projeto:</strong> ${h(projeto) || "Não informado"}</p>
      <p style="margin-bottom:3px;"><strong>Responsáveis:</strong> ${Object.keys(porUsuario).map(h).join(", ") || "—"}</p>
      <p><strong>Tipo:</strong> ${h(titulo)}</p>
    </div>
  </div>

  <div style="font-weight:700;font-size:12px;color:#1e3a5f;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px;">Equipamentos</div>
  <table>
    <thead>
      <tr>
        <th class="center" style="width:30px;">#</th>
        <th>Equipamento</th>
        <th class="center">Categoria</th>
        <th class="center">Barcode</th>
        <th class="center">Patrimônio</th>
        <th>Marca / Modelo</th>
        <th class="center">Responsável</th>
        <th class="center">Data/Hora</th>
      </tr>
    </thead>
    <tbody>
      ${tabelaLinhas}
      <tr>
        <td colspan="8" style="padding:8px;text-align:right;font-weight:600;background:#f0f4f8;border:1px solid #ddd;">
          Total: ${registros.length} equipamento${registros.length !== 1 ? "s" : ""}
        </td>
      </tr>
    </tbody>
  </table>

  ${observacoes ? `
  <div style="margin-top:14px;border:1px solid #ddd;border-radius:4px;padding:10px;">
    <div style="font-weight:700;font-size:11px;color:#1e3a5f;margin-bottom:6px;">OBSERVAÇÕES</div>
    <p style="font-size:11px;">${h(observacoes)}</p>
  </div>` : ""}

  <div style="display:flex;gap:20px;flex-wrap:wrap;margin-top:40px;">
    ${assinaturas}
    <div style="flex:1;min-width:180px;text-align:center;">
      <div style="border-top:1px solid #555;padding-top:6px;margin-top:40px;">
        <div style="font-weight:600;font-size:12px;">Almoxarifado / Responsável</div>
        <div style="font-size:10px;color:#666;margin-top:2px;">Conferência e liberação</div>
      </div>
    </div>
  </div>

  <div style="margin-top:20px;padding-top:10px;border-top:1px solid #eee;display:flex;justify-content:space-between;font-size:9px;color:#aaa;">
    <span>${companyName} — Sistema de Gestão de Equipamentos Audiovisuais</span>
    <span>Documento gerado em ${formatDate(geradoEm)} por ${h(geradoPor)}</span>
  </div>
</div>
</body>
</html>`;
}

// ─── Nota Fiscal Template ────────────────────────────────────────────────────

function gerarNotaFiscalHTML(data: DocumentData): string {
  const { registros, geradoPor, geradoEm, projeto, observacoes } = data;
  const numero = docNumber("NOTA_FISCAL_TRANSPORTE", geradoEm);

  const companyName = h(data.companyName) || "AV Gear Manager";
  const companyAddress = h(data.companyAddress) || "Endereço não configurado";
  const companyPhone = h(data.companyPhone);
  const companyEmail = h(data.companyEmail);
  const companyCnpj = h(data.companyCnpj);
  const companyLogoUrl = data.companyLogoUrl;

  const isValidUrl = companyLogoUrl && /^https?:\/\/.+/i.test(companyLogoUrl);
  const logoHtml = isValidUrl
    ? `<img src="${h(companyLogoUrl)}" alt="${companyName}" style="max-height:60px;max-width:220px;object-fit:contain;" />`
    : `<div style="font-size:18px;font-weight:700;color:#1e3a5f;">${companyName}</div>`;

  const porUsuario = registros.reduce<Record<string, UsageRecord[]>>((acc, r) => {
    const user = r.userName ?? "Usuário desconhecido";
    if (!acc[user]) acc[user] = [];
    acc[user].push(r);
    return acc;
  }, {});

  const responsaveis = Object.keys(porUsuario).map(h).join(", ") || "—";

  // Consolidar equipamentos
  const equipMap = new Map<string, { name: string; barcode: string; patrimony: string; brand: string; qty: number }>();
  for (const r of registros) {
    const key = r.equipmentName ?? "Desconhecido";
    if (!equipMap.has(key)) {
      equipMap.set(key, {
        name: key,
        barcode: r.equipmentBarcode ?? "—",
        patrimony: r.equipmentPatrimony ?? "—",
        brand: r.equipmentBrand ? `${r.equipmentBrand}${r.equipmentModel ? ` ${r.equipmentModel}` : ""}` : "—",
        qty: 0,
      });
    }
    equipMap.get(key)!.qty += 1;
  }

  const itemRows = Array.from(equipMap.values()).map((item, i) => `
    <tr style="background:${i % 2 === 0 ? "#fff" : "#f9f9f9"};">
      <td style="padding:7px 8px;border:1px solid #ccc;text-align:center;">${i + 1}</td>
      <td style="padding:7px 8px;border:1px solid #ccc;">${h(item.name)}</td>
      <td style="padding:7px 8px;border:1px solid #ccc;">${h(item.brand)}</td>
      <td style="padding:7px 8px;border:1px solid #ccc;text-align:center;">${h(item.barcode)}</td>
      <td style="padding:7px 8px;border:1px solid #ccc;text-align:center;">${h(item.patrimony)}</td>
      <td style="padding:7px 8px;border:1px solid #ccc;text-align:center;font-weight:600;">${item.qty}</td>
      <td style="padding:7px 8px;border:1px solid #ccc;text-align:center;">UN</td>
    </tr>`).join("");

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Nota Fiscal de Transporte — ${numero}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #1a1a1a; background: #fff; }
    .page { width: 210mm; min-height: 297mm; margin: 0 auto; padding: 12mm 14mm 18mm; background: #fff; }
    .section { border: 1px solid #bbb; border-radius: 3px; margin-bottom: 10px; }
    .section-header { background: #1e3a5f; color: #fff; padding: 6px 10px; font-weight: 700; font-size: 11px; }
    .section-body { padding: 8px 10px; }
    .section-body p { margin-bottom: 4px; line-height: 1.5; font-size: 11px; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th { background: #1e3a5f; color: #fff; padding: 7px 8px; text-align: left; font-size: 11px; }
    th.center { text-align: center; }
    .badge { display: inline-block; background: #e8f4fd; color: #1e3a5f; border: 1px solid #b3d4f0; border-radius: 3px; padding: 2px 8px; font-size: 10px; font-weight: 600; }
    @media print { body { padding: 0; } .page { padding: 8mm; width: 100%; } @page { size: A4; margin: 0; } }
  </style>
</head>
<body>
<div class="page">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #1e3a5f;padding-bottom:10px;margin-bottom:12px;">
    <div>
      ${logoHtml}
      <div style="font-size:10px;color:#555;margin-top:5px;line-height:1.6;">
        ${companyAddress}<br/>
        ${companyPhone ? "Tel: " + companyPhone : ""}${companyEmail ? " | " + companyEmail : ""}<br/>
        ${companyCnpj ? "CNPJ: " + companyCnpj : ""}
      </div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:18px;font-weight:700;color:#1e3a5f;">NOTA FISCAL DE TRANSPORTE</div>
      <div style="font-size:14px;color:#444;margin-top:3px;">Nº ${numero}</div>
      <div style="font-size:10px;color:#888;margin-top:2px;">Emissão: ${formatDate(geradoEm)}</div>
      <div style="margin-top:6px;"><span class="badge">CFOP 5.949</span></div>
    </div>
  </div>

  <div class="section">
    <div class="section-header">NATUREZA DA OPERAÇÃO</div>
    <div class="section-body">
      <div class="grid-3">
        <p><strong>Natureza:</strong> Remessa para uso/consumo</p>
        <p><strong>CFOP:</strong> 5.949 — Outra saída não especificada</p>
        <p><strong>Frete:</strong> Por conta do remetente (CIF)</p>
      </div>
      <p style="margin-top:4px;"><strong>Finalidade:</strong> Transporte de equipamentos audiovisuais para produção / evento</p>
    </div>
  </div>

  <div class="grid-2" style="margin-bottom:10px;">
    <div class="section" style="margin-bottom:0;">
      <div class="section-header">REMETENTE</div>
      <div class="section-body">
        <p><strong>Razão Social:</strong> ${companyName}</p>
        ${companyCnpj ? `<p><strong>CNPJ:</strong> ${companyCnpj}</p>` : ""}
        ${companyAddress ? `<p><strong>Endereço:</strong> ${companyAddress}</p>` : ""}
        ${companyPhone ? `<p><strong>Telefone:</strong> ${companyPhone}</p>` : ""}
      </div>
    </div>
    <div class="section" style="margin-bottom:0;">
      <div class="section-header">DESTINATÁRIO / EVENTO</div>
      <div class="section-body">
        <p><strong>Projeto / Evento:</strong> ${h(projeto) || "Não informado"}</p>
        <p><strong>Responsável(is):</strong> ${responsaveis}</p>
        <p><strong>Data de Emissão:</strong> ${formatDateShort(geradoEm)}</p>
        <p><strong>Gerado por:</strong> ${h(geradoPor)}</p>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-header">PRODUTOS / EQUIPAMENTOS TRANSPORTADOS</div>
    <div style="padding:0;">
      <table>
        <thead>
          <tr>
            <th class="center" style="width:30px;">#</th>
            <th>Descrição do Equipamento</th>
            <th>Marca / Modelo</th>
            <th class="center">Código / Barcode</th>
            <th class="center">Patrimônio</th>
            <th class="center" style="width:50px;">Qtd.</th>
            <th class="center" style="width:40px;">Un.</th>
          </tr>
        </thead>
        <tbody>
          ${itemRows}
          <tr>
            <td colspan="5" style="padding:8px;text-align:right;font-weight:700;background:#f0f4f8;border:1px solid #ccc;">TOTAL DE ITENS:</td>
            <td style="padding:8px;text-align:center;font-weight:700;background:#f0f4f8;border:1px solid #ccc;">${registros.length}</td>
            <td style="padding:8px;background:#f0f4f8;border:1px solid #ccc;"></td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  ${observacoes ? `
  <div class="section">
    <div class="section-header">OBSERVAÇÕES</div>
    <div class="section-body"><p>${h(observacoes)}</p></div>
  </div>` : ""}

  <div class="section">
    <div class="section-header">DECLARAÇÃO</div>
    <div class="section-body">
      <p style="font-size:10px;color:#444;line-height:1.6;">
        Declaro que os equipamentos listados acima são de propriedade de <strong>${companyName}</strong> e estão sendo
        transportados temporariamente para fins de produção audiovisual / evento, conforme descrito neste documento.
        Os equipamentos deverão ser devolvidos ao remetente após o término do evento.
      </p>
    </div>
  </div>

  <div style="display:flex;gap:20px;margin-top:30px;">
    <div style="flex:1;text-align:center;">
      <div style="border-top:1px solid #555;padding-top:6px;margin-top:40px;">
        <div style="font-weight:600;font-size:11px;">${responsaveis}</div>
        <div style="font-size:10px;color:#666;margin-top:2px;">Responsável pela retirada</div>
        <div style="font-size:10px;color:#888;">Data: ___/___/______</div>
      </div>
    </div>
    <div style="flex:1;text-align:center;">
      <div style="border-top:1px solid #555;padding-top:6px;margin-top:40px;">
        <div style="font-weight:600;font-size:11px;">${companyName}</div>
        <div style="font-size:10px;color:#666;margin-top:2px;">Responsável pela expedição</div>
        <div style="font-size:10px;color:#888;">Data: ___/___/______</div>
      </div>
    </div>
    <div style="flex:1;text-align:center;">
      <div style="border-top:1px solid #555;padding-top:6px;margin-top:40px;">
        <div style="font-weight:600;font-size:11px;">Conferente / Almoxarifado</div>
        <div style="font-size:10px;color:#666;margin-top:2px;">Conferência e liberação</div>
        <div style="font-size:10px;color:#888;">Data: ___/___/______</div>
      </div>
    </div>
  </div>

  <div style="margin-top:18px;padding-top:8px;border-top:1px solid #eee;display:flex;justify-content:space-between;font-size:9px;color:#aaa;">
    <span>${companyName} — Sistema de Gestão de Equipamentos Audiovisuais</span>
    <span>Documento gerado em ${formatDate(geradoEm)} por ${h(geradoPor)}</span>
  </div>
</div>
</body>
</html>`;
}

// ─── Função principal ────────────────────────────────────────────────────────

export function gerarDocumentoHTML(data: DocumentData): string {
  if (data.tipo === "NOTA_FISCAL_TRANSPORTE") {
    return gerarNotaFiscalHTML(data);
  }
  return gerarRomaneioHTML(data);
}
