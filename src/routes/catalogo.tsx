import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { publicProductsQuery, publicCategoriesQuery } from "@/lib/catalog.functions";
import { ProductCard } from "@/components/site/ProductCard";
import { StorefrontMotion } from "@/components/site/StorefrontMotion";
import { AnimatedGrid, type AnimatedGridHandle } from "@/components/site/AnimatedGrid";
import { motion } from "@/lib/storefront-motion";
import { SiteHeader, SiteFooter, MobileCtaBar } from "@/components/site/SiteChrome";

const TITLE = "Catálogo | Eterna Flor";
const DESC =
  "Descobre os bouquets, flores e presentes artesanais da Eterna Flor. Flores feitas à mão, personalizáveis e que não murcham.";

export const Route = createFileRoute("/catalogo")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(publicProductsQuery),
      context.queryClient.ensureQueryData(publicCategoriesQuery),
    ]),
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { property: "og:locale", content: "pt_PT" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://eternaflor.lovable.app/catalogo" }],
  }),
  component: Catalogo,
});

const UNDER_15 = "__ate15";
const sorts = [
  ["rec", "Recomendados"],
  ["asc", "Preço: mais baixo"],
  ["desc", "Preço: mais alto"],
  ["new", "Mais recentes"],
] as const;
type SortKey = (typeof sorts)[number][0];

const norm = (s: string | null | undefined) =>
  (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

function Catalogo() {
  const { data: products } = useSuspenseQuery(publicProductsQuery);
  const { data: categories } = useSuspenseQuery(publicCategoriesQuery);
  const [filter, setFilter] = useState<string>("all");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("rec");
  const grid = useRef<AnimatedGridHandle>(null);

  const visible = useMemo(() => {
    const term = norm(q.trim());
    const list = products.filter((p) => {
      if (filter === UNDER_15 && p.price > 15) return false;
      if (filter !== "all" && filter !== UNDER_15 && p.category_id !== filter) return false;
      if (term && ![p.name, p.short_description, p.description].some((v) => norm(v).includes(term)))
        return false;
      return true;
    });
    const byRec = (a: (typeof list)[number], b: (typeof list)[number]) =>
      a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at);
    return [...list].sort((a, b) =>
      sort === "asc"
        ? a.price - b.price || byRec(a, b)
        : sort === "desc"
          ? b.price - a.price || byRec(a, b)
          : sort === "new"
            ? b.created_at.localeCompare(a.created_at)
            : byRec(a, b),
    );
  }, [products, filter, q, sort]);

  const chips = [
    { id: "all", name: "Todos" },
    ...categories.map((c) => ({ id: c.id, name: c.name })),
    { id: UNDER_15, name: "Até 15€" },
  ];

  return (
    <StorefrontMotion className="min-h-screen bg-background text-foreground selection:bg-blush">
      <SiteHeader />
      <main
        data-page-entry
        className="mx-auto max-w-[1440px] px-6 pt-12 pb-24 md:px-16 md:pt-20 md:pb-32"
      >
        <h1 className="text-4xl font-light leading-tight md:text-6xl">
          Encontra a tua Eterna Flor
        </h1>
        <p className="mt-4 max-w-xl font-light text-muted-foreground md:text-lg">
          Escolhe entre bouquets, flores e presentes feitos à mão.
        </p>

        <div className="sticky top-[81px] z-30 -mx-6 mt-10 border-b border-border bg-background/95 px-6 py-4 backdrop-blur md:static md:mx-0 md:bg-transparent md:px-0 md:backdrop-blur-none">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <label className="relative block md:w-80">
              <Search className="pointer-events-none absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={q}
                onChange={(e) => {
                  grid.current?.capture();
                  setQ(e.target.value);
                }}
                placeholder="Pesquisar flores ou bouquets…"
                aria-label="Pesquisar"
                className="w-full border-b border-border bg-transparent py-3 pl-7 text-base font-light outline-none transition-colors focus:border-sage placeholder:text-muted-foreground/60"
              />
            </label>
            <label className="flex items-center gap-3 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Ordenar
              <select
                value={sort}
                onChange={(e) => {
                  grid.current?.capture();
                  setSort(e.target.value as SortKey);
                }}
                className="h-11 border border-border bg-background px-3 text-xs normal-case tracking-normal text-foreground outline-none focus:border-sage"
              >
                {sorts.map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="-mx-6 mt-4 flex gap-2 overflow-x-auto px-6 pb-1 md:mx-0 md:flex-wrap md:px-0">
            {chips.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  if (filter === c.id) return;
                  grid.current?.capture();
                  setFilter(c.id);
                }}
                aria-pressed={filter === c.id}
                className={`h-11 shrink-0 border px-5 text-[10px] uppercase tracking-[0.18em] transition-colors ${filter === c.id ? "border-primary bg-primary text-primary-foreground" : "border-primary/30 hover:border-primary"}`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>

        <p className="mt-8 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          {visible.length} {visible.length === 1 ? "produto" : "produtos"}
        </p>
        <AnimatedGrid
          ref={grid}
          className="mt-8 grid grid-cols-1 gap-x-4 gap-y-12 min-[360px]:grid-cols-2 md:gap-x-10 md:gap-y-16 lg:grid-cols-3 xl:grid-cols-4"
        >
          {visible.map((p, i) => (
            <ProductCard key={p.id} p={p} revealDelay={(i % 4) * motion.stagger.item} />
          ))}
        </AnimatedGrid>
        {visible.length === 0 && (
          <p className="py-16 text-center font-light text-muted-foreground">
            Nenhum produto encontrado. Experimenta outra pesquisa ou categoria.
          </p>
        )}
      </main>
      <SiteFooter />
      <MobileCtaBar onCatalog />
    </StorefrontMotion>
  );
}
