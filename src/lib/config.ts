// Configuração central da loja — alterar aqui e reflete-se em todo o site.
// Número de WhatsApp para teste (formato internacional, sem "+").
export const WHATSAPP_NUMBER = "351916883724";
export const INSTAGRAM = "https://instagram.com/eternaflor.pt";
export const TIKTOK = "https://tiktok.com/@eternaflor.pt";

export const wa = (msg: string) =>
  `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;

export const PRODUCT_IMAGES_BUCKET = "product-images";

export const formatPrice = (n: number | string) => {
  const v = Number(n);
  return `${Number.isInteger(v) ? v : v.toFixed(2).replace(".", ",")}€`;
};

export const productOrderMessage = (p: {
  name: string;
  price: number | string;
  customizable?: boolean;
}) => {
  const lines = [
    "Olá! Vi este produto no site da Eterna Flor e gostava de encomendar 😊",
    "",
    `Produto: ${p.name}`,
    `Preço: ${formatPrice(p.price)}`,
  ];
  return lines.join("\n");
};

export function customizationOrderMessage(request: {
  name: string;
  category?: string;
  product?: string;
  budget: string;
  colors: string;
  flowers: string;
  occasion: string;
  date: string;
  details: string;
}) {
  const lines = [
    "Olá! Gostava de pedir uma personalização na Eterna Flor.",
    "",
    `Nome: ${request.name.trim()}`,
  ];
  if (request.category) lines.push(`Categoria: ${request.category}`);
  lines.push(
    `Produto: ${request.product || "Criar de raiz / Sem produto específico do catálogo"}`,
    `Orçamento: ${request.budget}`,
  );
  const date = request.date.replace(/^(\d{4})-(\d{2})-(\d{2})$/, "$3/$2/$1");
  for (const [label, value] of [
    ["Cores preferidas", request.colors],
    ["Flores preferidas", request.flowers],
    ["Ocasião", request.occasion],
    ["Data", date],
    ["Detalhes adicionais", request.details],
  ]) {
    if (value?.trim()) lines.push(`${label}: ${value.trim()}`);
  }
  return lines.join("\n");
}

/** Image values stored in the DB are either absolute/relative URLs or storage paths in the product bucket. */
export const isStoragePath = (v: string | null | undefined): v is string =>
  !!v && !v.startsWith("/") && !/^https?:\/\//.test(v) && !v.startsWith("blob:");
