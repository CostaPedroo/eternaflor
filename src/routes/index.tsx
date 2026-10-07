import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { wa, INSTAGRAM, TIKTOK, formatPrice } from "@/lib/config";
import { publicProductsQuery } from "@/lib/catalog.functions";
import { siteSettingsQuery } from "@/lib/site-settings";
import { useState, type FormEvent } from "react";
import { MessageCircle, Instagram } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ProductCard } from "@/components/site/ProductCard";
import { FallbackImage } from "@/components/site/FallbackImage";
import { SiteHeader, SiteFooter, MobileCtaBar } from "@/components/site/SiteChrome";
import hero from "@/assets/bouquet-lirios-rose.webp.asset.json";
import hands from "@/assets/hands.jpg";

const TITLE = "Eterna Flor | Bouquets e Flores Artesanais que Não Murcham";
const DESC =
  "Bouquets e flores artesanais feitos à mão em Portugal. Flores que não murcham, personalizáveis e perfeitas para oferecer.";

export const Route = createFileRoute("/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(publicProductsQuery),
  head: ({ loaderData }) => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { name: "keywords", content: "flores que não murcham, bouquet eterno, flores artesanais, flores feitas à mão, bouquet personalizado, presente personalizado, flores eternas, presentes personalizados Portugal" },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { property: "og:locale", content: "pt_PT" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://eternaflor.lovable.app/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: "Os favoritos — Eterna Flor",
          itemListElement: (loaderData ?? []).filter((p) => p.featured).slice(0, 4).map((p, i) => ({
            "@type": "ListItem",
            position: i + 1,
            item: {
              "@type": "Product",
              name: p.name,
              description: p.short_description ?? undefined,
              ...(p.image && p.image.startsWith("http") ? { image: p.image } : {}),
              brand: { "@type": "Brand", name: "Eterna Flor" },
              offers: {
                "@type": "Offer",
                price: p.price.toFixed(2),
                priceCurrency: "EUR",
                availability: p.available ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
                url: "https://eternaflor.lovable.app/catalogo",
              },
            },
          })),
        }),
      },
    ],
  }),
  component: Index,
});

const values = [
  ["Feitas à mão", "Cada flor é criada individualmente."],
  ["Não murcham", "Uma recordação feita para durar."],
  ["Personalizáveis", "Escolhe cores, flores e estilo."],
];

const faqs = [
  ["Quanto tempo demora uma encomenda?", "Normalmente entre 3 e 7 dias. Confirmamos o prazo ao encomendar."],
  ["Fazem envios para todo o país?", "Sim, enviamos para todo Portugal por CTT. Em Gondomar e Ermesinde entregamos em mão."],
  ["Como é feito o pagamento?", "Indicamos as opções de pagamento ao confirmar a encomenda pelo WhatsApp."],
  ["Posso escolher as cores e as flores?", "Claro — usa o formulário de bouquet personalizado e enviamos-te uma proposta pelo WhatsApp."],
  ["Como devo conservar as flores?", "Mantém longe da humidade e do sol direto. Para limpar o pó, usa um secador em ar frio."],
];

const btnPrimary =
  "inline-flex items-center justify-center bg-primary px-12 py-4 text-xs uppercase tracking-[0.2em] text-primary-foreground transition-colors hover:bg-foreground";
const btnOutline =
  "inline-flex items-center justify-center border border-primary px-12 py-4 text-xs uppercase tracking-[0.2em] text-primary transition-all hover:bg-primary hover:text-primary-foreground";
const eyebrow = "text-xs font-medium uppercase tracking-[0.4em] text-sage";

function Index() {
  const { data: all } = useSuspenseQuery(publicProductsQuery);
  const { data: settings, isError: settingsError } = useQuery(siteSettingsQuery);
  const products = all.filter((p) => p.featured).slice(0, 4);
  const minPrice = all.length ? Math.min(...all.map((p) => p.price)) : null;

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-blush">
      <SiteHeader />

      {/* Hero */}
      <section id="inicio" className="mx-auto grid max-w-[1440px] grid-cols-1 items-center gap-10 px-6 pt-8 pb-20 md:px-16 md:pt-20 md:pb-32 lg:grid-cols-12 lg:gap-12">
        <div className="relative lg:order-2 lg:col-span-7">
          <div className="aspect-[4/5] overflow-hidden bg-muted sm:aspect-[5/4] lg:aspect-[4/5]">
            <FallbackImage src={settingsError ? null : settings?.hero_image_url} fallbackSrc={hero.url} alt="Bouquet Eterna Flor feito à mão com flores que não murcham" className="h-full w-full object-cover" />
          </div>
          <div className="absolute bottom-0 left-0 border border-blush bg-background px-5 py-4 xl:bottom-8 xl:-translate-x-1/4 xl:p-8">
            <span className="text-[10px] uppercase tracking-[0.2em] text-sage xl:text-xs">Coleção permanente</span>
            <p className="mt-1 font-serif text-xl xl:mt-2 xl:text-2xl">{minPrice != null ? `A partir de ${formatPrice(minPrice)}` : "Feito à mão"}</p>
          </div>
        </div>
        <div className="lg:order-1 lg:col-span-5">
          <p className={eyebrow}>Flores artesanais · Portugal</p>
          <h1 className="mt-5 text-5xl font-light leading-[0.95] md:text-[92px]">
            Flores que <br /><em className="italic">não murcham.</em>
          </h1>
          <p className="mt-6 max-w-sm text-base font-light leading-relaxed md:mt-8 md:text-lg">
            Bouquets feitos à mão para oferecer hoje e guardar durante anos.
          </p>
          <div className="mt-8 flex flex-col gap-3 md:mt-12 sm:flex-row sm:gap-6">
            <Link to="/catalogo" className={btnPrimary}>Ver catálogo</Link>
            <a href="#personalizados" className={btnOutline}>Criar bouquet personalizado</a>
          </div>
          <p className="mt-8 text-[10px] uppercase tracking-[0.2em] text-muted-foreground md:mt-10">
            Feito à mão em Portugal · Envio por CTT
          </p>
        </div>
      </section>

      {/* Value proposition */}
      <section className="border-t border-border">
        <div className="mx-auto grid max-w-[1440px] gap-10 px-6 py-16 md:grid-cols-3 md:gap-16 md:px-16 md:py-24">
          {values.map(([t, d]) => (
            <div key={t}>
              <h2 className="font-serif text-3xl font-light italic">{t}</h2>
              <p className="mt-3 font-light text-muted-foreground">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Favoritos */}
      <section id="favoritos" className="scroll-mt-20 border-t border-border">
        <div className="mx-auto max-w-[1440px] px-6 py-24 md:px-16 md:py-32">
          <div className="mb-16 md:mb-20">
            <p className={eyebrow}>Mais pedidos</p>
            <h2 className="mt-4 text-5xl font-light md:text-6xl">Os favoritos</h2>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-12 md:gap-x-10 md:gap-y-16 lg:grid-cols-4">
            {products.map((p) => <ProductCard key={p.id} p={p} />)}
          </div>
          <div className="mt-16 text-center md:mt-24">
            <Link to="/catalogo" className={btnPrimary}>Ver todos os produtos</Link>
          </div>
        </div>
      </section>

      <CustomSection imageUrl={settingsError ? null : settings?.custom_bouquet_image_url} />

      {/* Social */}
      <section className="border-t border-border">
        <div className="mx-auto flex max-w-[1440px] flex-col items-center gap-4 px-6 py-14 text-center md:flex-row md:justify-center md:gap-12 md:px-16">
          <p className={eyebrow}>Segue-nos</p>
          <a href={INSTAGRAM} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 font-serif text-xl italic hover:text-sage">
            <Instagram className="h-4 w-4" /> Instagram @eternaflor.pt
          </a>
          <a href={TIKTOK} target="_blank" rel="noreferrer" className="font-serif text-xl italic hover:text-sage">
            TikTok @eternaflor.pt
          </a>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-20 border-t border-border">
        <div className="mx-auto max-w-3xl px-6 py-24 md:py-32">
          <p className={eyebrow}>FAQ</p>
          <h2 className="mt-4 text-5xl font-light md:text-6xl">Perguntas frequentes</h2>
          <Accordion type="single" collapsible className="mt-12">
            {faqs.map(([q, a], i) => (
              <AccordionItem key={i} value={`f${i}`}>
                <AccordionTrigger className="py-6 text-left font-serif text-xl font-light">{q}</AccordionTrigger>
                <AccordionContent className="font-light leading-relaxed text-muted-foreground">{a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
          <a href={wa("Olá! Tenho uma dúvida sobre as vossas flores.")} target="_blank" rel="noreferrer" className={`${btnPrimary} mt-12`}>Falar no WhatsApp</a>
        </div>
      </section>

      <SiteFooter />
      <MobileCtaBar />
    </div>
  );
}

const budgets = ["Até 15€", "15€–25€", "25€–40€", "40€–60€", "60€+"];
const fieldLabel = "block text-[10px] uppercase tracking-[0.2em] text-muted-foreground";
const field = "w-full border-b border-border bg-transparent pb-2 pt-1 text-lg font-light outline-none transition-colors focus:border-sage placeholder:text-muted-foreground/50";

function CustomSection({ imageUrl }: { imageUrl: string | null | undefined }) {
  const [budget, setBudget] = useState(budgets[1]);

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const g = (k: string) => String(f.get(k) || "").trim() || "—";
    const msg = [
      "Olá! Gostava de pedir um bouquet personalizado 🌸",
      "",
      `Nome: ${g("nome")}`,
      `Ocasião: ${g("ocasiao")}`,
      `Data: ${g("data")}`,
      `Orçamento: ${budget}`,
      `Cores: ${g("cores")}`,
      `Flores: ${g("flores")}`,
      `Detalhes: ${g("detalhes")}`,
    ].join("\n");
    window.open(wa(msg), "_blank");
  };

  return (
    <section id="personalizados" className="scroll-mt-20 border-t border-border">
      <div className="mx-auto grid max-w-[1440px] grid-cols-1 gap-16 px-6 py-24 md:px-16 md:py-32 lg:grid-cols-2 lg:gap-24">
        <div>
          <p className={eyebrow}>Personalizados</p>
          <h2 className="mt-6 text-5xl font-light leading-[1.05] md:text-6xl">Um bouquet feito só para essa pessoa.</h2>
          <p className="mt-8 max-w-lg text-lg font-light leading-relaxed text-muted-foreground">
            Escolhe as cores, as flores e o orçamento. Nós tratamos do resto.
          </p>
          <div className="mt-16 hidden aspect-video overflow-hidden bg-muted md:block">
            <FallbackImage src={imageUrl} fallbackSrc={hands} alt="Flor de chenille a ser feita à mão" loading="lazy" width={1024} height={1024} className="h-full w-full object-cover" />
          </div>
        </div>

        <form onSubmit={submit} className="space-y-8 border border-blush bg-card p-6 md:space-y-10 md:p-16">
          <h3 className="font-serif text-3xl font-light italic md:text-4xl">Formulário de pedido</h3>
          <label className="block">
            <span className={fieldLabel}>Nome</span>
            <input name="nome" required className={field} />
          </label>
          <div className="grid gap-10 sm:grid-cols-2">
            <label className="block">
              <span className={fieldLabel}>Ocasião</span>
              <input name="ocasiao" placeholder="Aniversário, Dia da Mãe…" className={field} />
            </label>
            <label className="block">
              <span className={fieldLabel}>Data em que precisa</span>
              <input name="data" type="date" className={field} />
            </label>
          </div>
          <div>
            <span className={fieldLabel}>Orçamento</span>
            <div className="mt-4 flex flex-wrap gap-3">
              {budgets.map((b) => (
                <button
                  type="button"
                  key={b}
                  onClick={() => setBudget(b)}
                  className={`border px-6 py-2 text-[10px] uppercase tracking-[0.15em] transition-colors ${budget === b ? "border-primary bg-primary text-primary-foreground" : "border-primary/30 hover:border-primary"}`}
                >
                  {b}
                </button>
              ))}
            </div>
          </div>
          <label className="block">
            <span className={fieldLabel}>Cores preferidas</span>
            <input name="cores" placeholder="Rosa-velho, creme, verde…" className={field} />
          </label>
          <label className="block">
            <span className={fieldLabel}>Flores preferidas</span>
            <input name="flores" placeholder="Rosas, tulipas, margaridas…" className={field} />
          </label>
          <label className="block">
            <span className={fieldLabel}>Detalhes adicionais</span>
            <textarea name="detalhes" rows={2} className={`${field} resize-none`} />
          </label>
          <button type="submit" className="inline-flex w-full items-center justify-center gap-3 bg-whatsapp py-5 text-xs uppercase tracking-[0.3em] text-primary-foreground transition-opacity hover:opacity-90">
            <MessageCircle className="h-4 w-4" /> Criar bouquet personalizado
          </button>
        </form>
      </div>
    </section>
  );
}
