// Configuração central da loja — alterar aqui e reflete-se em todo o site.
// TODO: definir o número de WhatsApp real (formato internacional, sem "+")
export const WHATSAPP_NUMBER = "351000000000";
export const INSTAGRAM = "https://instagram.com/eternaflor.pt";
export const TIKTOK = "https://tiktok.com/@eternaflor.pt";

export const wa = (msg: string) =>
  `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;

export const PRODUCT_IMAGES_BUCKET = "product-images";

export const formatPrice = (n: number | string) => {
  const v = Number(n);
  return `${Number.isInteger(v) ? v : v.toFixed(2).replace(".", ",")}€`;
};

export const productOrderMessage = (p: { name: string; price: number | string; customizable?: boolean }) => {
  const lines = [
    `Olá! Vi o ${p.name} no site da Eterna Flor e gostava de encomendar 😊`,
    "",
    `Produto: ${p.name}`,
    `Preço: ${formatPrice(p.price)}`,
  ];
  if (p.customizable) {
    lines.push("", "Gostava também de saber que opções de personalização estão disponíveis.");
  }
  return lines.join("\n");
};

/** Image values stored in the DB are either absolute/relative URLs or storage paths in the product bucket. */
export const isStoragePath = (v: string | null | undefined): v is string =>
  !!v && !v.startsWith("/") && !/^https?:\/\//.test(v) && !v.startsWith("blob:");
