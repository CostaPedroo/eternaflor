import { Content } from "@radix-ui/react-dialog";
import { useEffect, useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { completeEntrance, motionStyle } from "@/lib/storefront-motion";

type Props = {
  categories: { id: string; name: string }[];
  filter: string;
  priceFilter: string;
  sort: string;
  sorts: ReadonlyArray<readonly [string, string]>;
  count: number;
  onFilter: (value: string) => void;
  onSort: (value: string) => void;
  onReset: () => void;
};

/** Shares the catalogue's live state; Radix supplies focus trapping and scroll locking. */
export function CatalogFilterSheet({
  categories,
  filter,
  priceFilter,
  sort,
  sorts,
  count,
  onFilter,
  onSort,
  onReset,
}: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 768px)");
    const closeOnDesktop = () => {
      if (desktop.matches) setOpen(false);
    };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);

  const selectClass =
    "mt-2 h-11 w-full min-w-0 border border-border bg-background px-3 text-base font-light text-foreground outline-none focus:border-sage";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 border border-primary/30 px-3 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary md:hidden"
        >
          <SlidersHorizontal aria-hidden="true" className="h-4 w-4" />
          Filtrar
          {(filter !== "all" || sort !== "rec") && (
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-primary" />
          )}
        </button>
      </DialogTrigger>
      <DialogPortal>
        <DialogOverlay
          style={motionStyle}
          className="storefront-overlay bg-foreground/40 md:hidden"
          onAnimationEnd={(event) => {
            if (event.target === event.currentTarget) completeEntrance(event.currentTarget);
          }}
        />
        <Content
          style={motionStyle}
          className="storefront-dialog fixed inset-x-0 bottom-0 z-50 flex max-h-[calc(100dvh-1.5rem)] flex-col rounded-t-xl border border-border bg-background text-foreground shadow-soft md:hidden"
          onAnimationEnd={(event) => {
            if (event.target === event.currentTarget) completeEntrance(event.currentTarget);
          }}
        >
          <div className="flex shrink-0 items-start justify-between gap-4 px-6 pt-5">
            <div>
              <DialogTitle className="font-serif text-3xl font-light">Filtrar catálogo</DialogTitle>
              <DialogDescription className="mt-2 text-sm font-light text-muted-foreground">
                {count} {count === 1 ? "produto encontrado" : "produtos encontrados"}
              </DialogDescription>
            </div>
            <DialogClose
              aria-label="Fechar filtros"
              className="grid h-11 w-11 shrink-0 place-items-center border border-border focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            >
              <X aria-hidden="true" className="h-5 w-5" />
            </DialogClose>
          </div>
          <div className="min-h-0 space-y-6 overflow-y-auto px-6 py-6">
            <label className="block text-xs uppercase tracking-[0.15em] text-muted-foreground">
              Categoria
              <select
                value={filter === priceFilter ? "all" : filter}
                onChange={(event) => onFilter(event.target.value)}
                className={`${selectClass} normal-case tracking-normal`}
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs uppercase tracking-[0.15em] text-muted-foreground">
              Ordenar
              <select
                value={sort}
                onChange={(event) => onSort(event.target.value)}
                className={`${selectClass} normal-case tracking-normal`}
              >
                {sorts.map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={filter === priceFilter}
                onChange={(event) => onFilter(event.target.checked ? priceFilter : "all")}
                className="h-4 w-4 shrink-0 accent-primary"
              />
              Até 15€
            </label>
          </div>
          <div className="grid shrink-0 grid-cols-2 gap-3 border-t border-border px-6 pt-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
            <button
              type="button"
              onClick={onReset}
              className="min-h-11 border border-primary px-3 text-[10px] uppercase tracking-[0.12em] focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            >
              Limpar filtros
            </button>
            <DialogClose className="min-h-11 bg-primary px-3 text-[10px] uppercase tracking-[0.12em] text-primary-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
              Aplicar filtros
            </DialogClose>
          </div>
        </Content>
      </DialogPortal>
    </Dialog>
  );
}
