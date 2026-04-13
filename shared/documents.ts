export type DocumentType =
  | "ROMANEIO_SAIDA"
  | "ROMANEIO_RETORNO"
  | "ROMANEIO_RENOVACAO"
  | "NOTA_FISCAL_TRANSPORTE";

export type DocumentStatus = "checkout" | "checkin" | "renovacao" | null;

export interface DocumentOption {
  tipo: DocumentType;
  label: string;
  description: string;
}

/**
 * Calcula quais documentos podem ser gerados com base no status da última ação.
 */
export function calcularDocumentosDisponiveis(
  status: DocumentStatus,
  temMovimentacao: boolean
): DocumentOption[] {
  const docs: DocumentOption[] = [];

  if (status === "checkout" || temMovimentacao) {
    docs.push({
      tipo: "ROMANEIO_SAIDA",
      label: "Romaneio de Saída",
      description: "Documento de retirada de equipamentos para uso em produção.",
    });
  }

  if (status === "checkin" || temMovimentacao) {
    docs.push({
      tipo: "ROMANEIO_RETORNO",
      label: "Romaneio de Retorno",
      description: "Documento de devolução de equipamentos ao almoxarifado.",
    });
  }

  if (temMovimentacao) {
    docs.push({
      tipo: "ROMANEIO_RENOVACAO",
      label: "Romaneio de Renovação",
      description: "Documento de extensão do período de uso dos equipamentos.",
    });
  }

  if (status === "checkout" || temMovimentacao) {
    docs.push({
      tipo: "NOTA_FISCAL_TRANSPORTE",
      label: "Nota Fiscal de Transporte",
      description: "Documento fiscal de transporte de equipamentos.",
    });
  }

  return docs;
}
