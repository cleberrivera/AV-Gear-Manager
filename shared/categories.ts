/** Lista centralizada de categorias de equipamentos AV */
export const EQUIPMENT_CATEGORIES = [
  "Câmera",
  "Lente Wide",
  "Lente Zoom",
  "Limpeza",
  "Bateria",
  "Carregador",
  "Armazenamento",
  "Tripé",
  "Iluminação",
  "Iluminação Tripé",
  "Áudio Interface",
  "Live Stream Switcher",
  "Cabo USB-C",
  "Carregador Parede",
  "Extensão Energia",
  "Cabo HDMI",
  "Microfone Podcast",
  "Braço de Mic",
  "Cabo XLR",
  "Organização",
  "Microfone Wireless",
  "Fone Estúdio",
  "Outros",
] as const;

export type EquipmentCategory = (typeof EQUIPMENT_CATEGORIES)[number];
