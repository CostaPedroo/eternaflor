import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { publicProductsQuery, publicCategoriesQuery } from "@/lib/catalog.functions";
import { ProductCard } from "@/components/site/ProductCard";
import { StorefrontMotion } from "@/components/site/StorefrontMotion";
import { AnimatedGrid, type AnimatedGridHandle } from "@/components/site/AnimatedGrid";
import { motion } from "@/lib/storefront-motion";
import { SiteHeader, SiteFooter, FloatingWhatsApp } from "@/components/site/SiteChrome";
import { belongsToCategory } from "@/lib/product-categories";
import { CatalogFilterSheet } from "@/components/site/CatalogFilterSheet";

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
    links: [{ rel: "canonical", href: "https://eterna-flor.netlify.app/catalogo" }],
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
  const [initialProducts, initialCategories] = Route.useLoaderData();
  const { data: products } = useSuspenseQuery({
    ...publicProductsQuery,
    initialData: initialProducts,
  });
  const { data: categories } = useSuspenseQuery({
    ...publicCategoriesQuery,
    initialData: initialCategories,
  });
  const [filter, setFilter] = useState<string>("all");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("rec");
  const grid = useRef<AnimatedGridHandle>(null);

  const visible = useMemo(() => {
    const term = norm(q.trim());
    const list = products.filter((p) => {
      if (filter === UNDER_15 && p.price > 15) return false;
      if (filter !== "all" && filter !== UNDER_15 && !belongsToCategory(p, filter)) return false;
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

  const changeFilter = (value: string) => {
    if (filter === value) return;
    grid.current?.capture();
    setFilter(value);
  };
  const changeSort = (value: SortKey) => {
    grid.current?.capture();
    setSort(value);
  };

  return (
    <StorefrontMotion className="min-h-screen bg-background text-foreground selection:bg-blush">
      <SiteHeader />
      <main
        data-page-entry
        className="mx-auto grid max-w-[1440px] grid-cols-[minmax(0,1fr)_auto] px-6 pt-6 pb-[calc(7rem+env(safe-area-inset-bottom))] md:block md:px-16 md:pt-20 md:pb-32"
      >
        <h1 className="col-start-1 row-start-1 text-2xl font-light leading-tight md:text-6xl">
          <span className="md:hidden">Catálogo</span>
          <span className="hidden md:inline">Encontra a tua Eterna Flor</span>
        </h1>
        <p className="mt-4 hidden max-w-xl font-light text-muted-foreground md:block md:text-lg">
          Escolhe entre bouquets, flores e presentes feitos à mão.
        </p>

        {/* Mobile header: 44px controls + 40px padding + 1px border. Only this row sticks. */}
        <div className="sticky top-[85px] z-30 col-span-2 -mx-6 mt-4 flex h-14 items-center gap-3 border-b border-border bg-background/95 px-6 backdrop-blur md:static md:mx-0 md:mt-10 md:h-auto md:justify-between md:gap-4 md:border-0 md:bg-transparent md:px-0 md:pt-4 md:backdrop-blur-none">
          <label className="relative block min-w-0 flex-1 md:w-80 md:flex-none">
            <Search className="pointer-events-none absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={q}
              onChange={(e) => {
                grid.current?.capture();
                setQ(e.target.value);
              }}
              placeholder="Pesquisar produtos…"
              aria-label="Pesquisar"
              className="h-11 w-full min-w-0 bg-transparent py-3 pl-7 text-base font-light outline-none transition-colors focus:border-sage placeholder:text-muted-foreground/60 md:h-auto md:border-b md:border-border"
            />
          </label>
          <CatalogFilterSheet
            categories={chips.slice(0, -1)}
            filter={filter}
            priceFilter={UNDER_15}
            sort={sort}
            sorts={sorts}
            count={visible.length}
            onFilter={changeFilter}
            onSort={(value) => changeSort(value as SortKey)}
            onReset={() => {
              grid.current?.capture();
              setFilter("all");
              setQ("");
              setSort("rec");
            }}
          />
          <label className="hidden items-center gap-3 text-[10px] uppercase tracking-[0.2em] text-muted-foreground md:flex">
            Ordenar
            <select
              value={sort}
              onChange={(e) => changeSort(e.target.value as SortKey)}
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
        <div className="col-span-2 -mx-6 mt-3 flex min-w-0 gap-2 overflow-x-auto px-6 pb-3 md:mx-0 md:mt-4 md:flex-wrap md:border-b md:border-border md:px-0 md:pb-5">
          {chips.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => changeFilter(c.id)}
              aria-pressed={filter === c.id}
              className={`h-9 shrink-0 border px-3 text-[10px] uppercase tracking-[0.18em] transition-colors md:h-11 md:px-5 ${filter === c.id ? "border-primary bg-primary text-primary-foreground" : "border-primary/30 hover:border-primary"}`}
            >
              {c.name}
            </button>
          ))}
        </div>

        <p className="col-start-2 row-start-1 self-center text-[10px] uppercase tracking-[0.2em] text-muted-foreground md:mt-8">
          {visible.length} {visible.length === 1 ? "produto" : "produtos"}
        </p>
        <AnimatedGrid
          ref={grid}
          className="catalogue-product-grid col-span-2 mt-4 grid grid-cols-2 items-stretch gap-x-4 gap-y-12 md:mt-8 md:gap-x-10 md:gap-y-16 lg:grid-cols-3 xl:grid-cols-4"
        >
          {visible.map((p, i) => (
            <ProductCard
              key={p.id}
              p={p}
              revealDelay={(i % 4) * motion.stagger.item}
              categoryId={
                categories.some((category) => category.id === filter) ? filter : undefined
              }
            />
          ))}
        </AnimatedGrid>
        {visible.length === 0 && (
          <p className="col-span-2 py-16 text-center font-light text-muted-foreground">
            Nenhum produto encontrado. Experimenta outra pesquisa ou categoria.
          </p>
        )}
      </main>
      <SiteFooter />
      <FloatingWhatsApp />
    </StorefrontMotion>
  );
}
