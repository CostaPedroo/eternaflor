import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { wa, INSTAGRAM, TIKTOK, formatPrice } from "@/lib/config";
import {
  publicProductsQuery,
  publicCategoriesQuery,
  type PublicProduct,
  type PublicCategory,
} from "@/lib/catalog.functions";
import { publicSiteSettingsQuery } from "@/lib/site-settings";
import { galleryPreviewQuery } from "@/lib/gallery.functions";
import { GalleryPreview } from "@/components/site/GalleryPreview";
import { Instagram, Flower2, Palette, HeartHandshake, SprayCan } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ProductCard } from "@/components/site/ProductCard";
import { FallbackImage } from "@/components/site/FallbackImage";
import { HeroImage } from "@/components/site/HeroImage";
import { StorefrontMotion } from "@/components/site/StorefrontMotion";
import { ImageReveal } from "@/components/site/ImageReveal";
import { CustomizationForm } from "@/components/site/CustomizationForm";
import { motion } from "@/lib/storefront-motion";
import { heroImagePreloads } from "@/lib/responsive-images";
import { SiteHeader, SiteFooter, FloatingWhatsApp } from "@/components/site/SiteChrome";
import hands from "@/assets/hands.jpg";

const TITLE = "Eterna Flor | Bouquets e Flores Artesanais que Não Murcham";
const DESC =
  "Bouquets e flores artesanais feitos à mão em Portugal. Flores que não murcham, personalizáveis e perfeitas para oferecer.";

export const Route = createFileRoute("/")({
  loader: async ({ context }) => {
    const [products, settings, gallery, categories] = await Promise.all([
      context.queryClient.ensureQueryData(publicProductsQuery),
      context.queryClient.fetchQuery(publicSiteSettingsQuery).catch(() => null),
      context.queryClient
        .fetchQuery(galleryPreviewQuery)
        .catch(() => ({ images: [], unavailable: true })),
      context.queryClient.ensureQueryData(publicCategoriesQuery),
    ]);
    return { products, settings, gallery, categories };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      {
        name: "keywords",
        content:
          "flores que não murcham, bouquet eterno, flores artesanais, flores feitas à mão, bouquet personalizado, presente personalizado, flores eternas, presentes personalizados Portugal",
      },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { property: "og:locale", content: "pt_PT" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "canonical", href: "https://eterna-flor.netlify.app/" },
      ...heroImagePreloads(loaderData?.settings?.hero_image_url || "/homepage-hero.webp"),
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: "Os favoritos — Eterna Flor",
          itemListElement: (loaderData?.products ?? [])
            .filter((p) => p.featured)
            .slice(0, 4)
            .map((p, i) => ({
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
                  availability: p.available
                    ? "https://schema.org/InStock"
                    : "https://schema.org/OutOfStock",
                  url: "https://eterna-flor.netlify.app/catalogo",
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
  { title: "Não murcham", description: "Duram para sempre.", icon: Flower2 },
  { title: "A teu gosto", description: "Personaliza cores e detalhes.", icon: Palette },
  { title: "Feitas à mão", description: "Criadas com carinho.", icon: HeartHandshake },
  { title: "Com o teu perfume", description: "Finaliza com o teu aroma.", icon: SprayCan },
];

const faqs = [
  [
    "Quanto tempo demora uma encomenda?",
    "Normalmente entre 3 e 7 dias. Confirmamos o prazo ao encomendar.",
  ],
  [
    "Fazem envios para todo o país?",
    "Sim, enviamos para todo Portugal por CTT. Em Gondomar e Ermesinde entregamos em mão.",
  ],
  [
    "Como é feito o pagamento?",
    "Indicamos as opções de pagamento ao confirmar a encomenda pelo WhatsApp.",
  ],
  [
    "Posso escolher as cores e as flores?",
    "Claro — usa o formulário de personalização ou escolhe um dos produtos do nosso catálogo e enviamos-te uma proposta pelo WhatsApp.",
  ],
  [
    "Como devo conservar as flores?",
    "Mantém longe da humidade e do sol direto. Para limpar o pó, usa um secador em ar frio.",
  ],
];

const btnPrimary =
  "inline-flex items-center justify-center bg-primary px-12 py-4 text-xs uppercase tracking-[0.2em] text-primary-foreground transition-colors hover:bg-foreground";
const btnOutline =
  "inline-flex items-center justify-center border border-primary px-12 py-4 text-xs uppercase tracking-[0.2em] text-primary transition-all hover:bg-primary hover:text-primary-foreground";
const eyebrow = "text-xs font-medium uppercase tracking-[0.4em] text-sage";

function Index() {
  const initial = Route.useLoaderData();
  const { data: all } = useSuspenseQuery({ ...publicProductsQuery, initialData: initial.products });
  const { data: categories } = useSuspenseQuery({
    ...publicCategoriesQuery,
    initialData: initial.categories ?? [],
  });
  const { data: settings, isError: settingsError } = useQuery({
    ...publicSiteSettingsQuery,
    initialData: initial.settings,
  });
  const products = all.filter((p) => p.featured).slice(0, 4);
  const minPrice = all.length ? Math.min(...all.map((p) => p.price)) : null;

  return (
    <StorefrontMotion className="min-h-screen bg-background text-foreground selection:bg-blush">
      <SiteHeader />

      {/* Hero */}
      <section
        id="inicio"
        className="mx-auto grid max-w-[1440px] grid-cols-1 items-center gap-10 px-6 pt-8 pb-20 md:px-16 md:pt-20 md:pb-32 lg:grid-cols-12 lg:gap-12"
      >
        <div className="relative lg:order-2 lg:col-span-7">
          <ImageReveal
            trigger="mount"
            className="image-hover-frame aspect-[4/5] overflow-hidden bg-muted sm:aspect-[5/4] lg:aspect-[4/5]"
          >
            <HeroImage
              src={settingsError ? null : settings?.hero_image_url}
              fallbackSrc="/homepage-hero.webp"
              alt="Bouquet Eterna Flor feito à mão com flores que não murcham"
            />
          </ImageReveal>
          <div
            data-hero="label"
            className="absolute bottom-0 left-0 border border-blush bg-background px-5 py-4 xl:bottom-8 xl:-translate-x-1/4 xl:p-8"
          >
            <span className="text-[10px] uppercase tracking-[0.2em] text-sage xl:text-xs">
              Nova Coleção
            </span>
            <p className="mt-1 font-serif text-xl xl:mt-2 xl:text-2xl">
              {minPrice != null ? `A partir de ${formatPrice(minPrice)}` : "Feito à mão"}
            </p>
          </div>
        </div>
        <div className="lg:order-1 lg:col-span-5">
          <p data-hero="eyebrow" data-reveal-direction="left" className={eyebrow}>
            Flores artesanais · Portugal
          </p>
          <h1 data-hero="title" className="mt-5 text-5xl font-light leading-[0.95] md:text-[92px]">
            Flores que <br />
            <em className="italic">não murcham.</em>
          </h1>
          <p
            data-hero="intro"
            className="mt-6 max-w-sm text-base font-light leading-relaxed md:mt-8 md:text-lg"
          >
            Flores feitas à mão para oferecer hoje a quem mais amas e guardar memórias eternamente.
          </p>
          <div data-hero="cta" className="mt-8 flex flex-col gap-3 md:mt-12 sm:flex-row sm:gap-6">
            <Link to="/catalogo" className={btnPrimary}>
              Ver catálogo
            </Link>
            <a href="#personalizados" className={btnOutline}>
              Personalizar
            </a>
          </div>
          <p className="mt-8 text-[10px] uppercase tracking-[0.2em] text-muted-foreground md:mt-10">
            Feito à mão em Portugal · Envio por CTT
          </p>
        </div>
      </section>

      {/* Value proposition */}
      <section aria-label="Vantagens Eterna Flor" className="border-t border-border">
        <div className="mx-auto max-w-[1440px] px-5 py-2 md:px-12 md:py-5 lg:py-7">
          <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
            {values.map(({ title, description, icon: Icon }, i) => (
              <li
                key={title}
                className="flex min-w-0 items-center border-b border-border py-5 last:border-b-0 md:border-b-0 md:px-5 md:odd:border-r lg:border-r lg:px-4 lg:py-3 lg:last:border-r-0"
              >
                <div
                  data-reveal
                  data-reveal-direction={
                    i === 0 ? "left" : i === values.length - 1 ? "right" : "bottom"
                  }
                  data-reveal-delay={i * motion.stagger.item}
                  className="flex min-w-0 items-center gap-4 min-[360px]:gap-5 md:gap-4 lg:gap-3 xl:gap-4"
                >
                  <span
                    aria-hidden="true"
                    className={`grid h-16 w-16 shrink-0 place-items-center rounded-full text-primary min-[360px]:h-[72px] min-[360px]:w-[72px] lg:h-12 lg:w-12 xl:h-14 xl:w-14 ${i % 2 === 0 ? "bg-blush/50" : "bg-sage-soft"}`}
                  >
                    <Icon
                      strokeWidth={1.25}
                      className="h-9 w-9 lg:h-7 lg:w-7 xl:h-8 xl:w-8"
                      focusable="false"
                    />
                  </span>
                  <div className="min-w-0">
                    <h2 className="font-serif text-[26px] font-medium leading-tight lg:text-[22px] xl:text-2xl">
                      {title}
                    </h2>
                    <p className="mt-1 text-base font-light leading-relaxed text-muted-foreground lg:text-sm xl:text-base">
                      {description}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Favoritos */}
      <section id="favoritos" className="scroll-mt-20 border-t border-border">
        <div className="mx-auto max-w-[1440px] px-6 py-24 md:px-16 md:py-32">
          <div data-reveal="heading" className="mb-16 md:mb-20">
            <p className={eyebrow}>Explora a nossa coleção.</p>
            <h2 className="mt-4 text-5xl font-light md:text-6xl">Escolhe o teu favorito</h2>
          </div>
          <div className="catalogue-product-grid grid grid-cols-2 items-stretch gap-x-4 gap-y-12 md:gap-x-10 md:gap-y-16 lg:grid-cols-4">
            {products.map((p, i) => (
              <ProductCard key={p.id} p={p} revealDelay={i * motion.stagger.item} />
            ))}
          </div>
          <div data-reveal className="mt-16 text-center md:mt-24">
            <Link to="/catalogo" className={btnPrimary}>
              Ver todos os produtos
            </Link>
          </div>
        </div>
      </section>

      <CustomSection
        imageUrl={settingsError ? null : settings?.custom_bouquet_image_url}
        products={all}
        categories={categories}
      />

      <GalleryPreview initial={initial.gallery} />

      {/* Social */}
      <section className="border-t border-border">
        <div
          data-reveal
          data-reveal-direction="fade-scale"
          className="mx-auto flex max-w-[1440px] flex-col items-center gap-4 px-6 py-14 text-center md:flex-row md:justify-center md:gap-12 md:px-16"
        >
          <p className={eyebrow}>Segue-nos</p>
          <a
            href={INSTAGRAM}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 font-serif text-xl italic hover:text-sage"
          >
            <Instagram className="h-4 w-4" /> Instagram @eternaflor.pt
          </a>
          <a
            href={TIKTOK}
            target="_blank"
            rel="noreferrer"
            className="font-serif text-xl italic hover:text-sage"
          >
            TikTok @eternaflor.pt
          </a>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-20 border-t border-border">
        <div className="mx-auto max-w-3xl px-6 py-24 md:py-32">
          <div data-reveal="heading">
            <p className={eyebrow}>FAQ</p>
            <h2 className="mt-4 text-5xl font-light md:text-6xl">Perguntas frequentes</h2>
          </div>
          <Accordion type="single" collapsible className="mt-12">
            {faqs.map(([q, a], i) => (
              <AccordionItem
                key={i}
                value={`f${i}`}
                data-reveal
                data-reveal-delay={(i % 4) * motion.stagger.item}
              >
                <AccordionTrigger className="py-6 text-left font-serif text-xl font-light">
                  {q}
                </AccordionTrigger>
                <AccordionContent
                  data-storefront-accordion
                  className="font-light leading-relaxed text-muted-foreground"
                >
                  {a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
          <a
            data-reveal
            href={wa("Olá! Tenho uma dúvida sobre as vossas flores.")}
            target="_blank"
            rel="noreferrer"
            className={`${btnPrimary} mt-12`}
          >
            Falar no WhatsApp
          </a>
        </div>
      </section>

      <SiteFooter />
      <FloatingWhatsApp />
    </StorefrontMotion>
  );
}

function CustomSection({
  imageUrl,
  products,
  categories,
}: {
  imageUrl: string | null | undefined;
  products: PublicProduct[];
  categories: PublicCategory[];
}) {
  return (
    <section id="personalizados" className="scroll-mt-20 border-t border-border">
      <div className="mx-auto grid max-w-[1440px] grid-cols-1 gap-16 px-6 py-24 md:gap-8 md:px-16 md:py-32 min-[1200px]:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] min-[1200px]:gap-12">
        <div className="flex min-w-0 flex-col gap-12 md:gap-8 min-[1200px]:justify-between min-[1200px]:gap-10">
          <div>
            <p className={eyebrow}>Personalizados</p>
            <h2
              data-reveal="heading"
              data-reveal-direction="right"
              className="mt-6 text-5xl font-light leading-[1.05] md:text-6xl"
            >
              Personaliza à tua maneira, especialmente para aquela pessoa
            </h2>
            <p
              data-reveal
              data-reveal-direction="right"
              data-reveal-delay={motion.stagger.item}
              className="mt-8 max-w-lg text-lg font-light leading-relaxed text-muted-foreground"
            >
              Escolhe um produto do catálogo ou conta-nos a tua ideia. Personalizamos cores,
              flores e detalhes ao teu gosto.
            </p>
          </div>
          <ImageReveal className="image-hover-frame hidden aspect-[3/2] min-h-0 w-full shrink-0 overflow-hidden bg-muted md:block min-[1200px]:aspect-square">
            <FallbackImage
              src={imageUrl}
              fallbackSrc={hands}
              alt="Flor de chenille a ser feita à mão"
              loading="lazy"
              width={1024}
              height={1024}
              className="editorial-image h-full w-full object-cover"
            />
          </ImageReveal>
        </div>

        <CustomizationForm products={products} categories={categories} />
      </div>
    </section>
  );
}
