import { wa, formatPrice, productOrderMessage } from "@/lib/config";
import type { PublicProduct } from "@/lib/catalog.functions";
import { useState } from "react";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { ProductDetail } from "@/components/site/ProductDetail";

export function ProductCard({ p, revealDelay = 0 }: { p: PublicProduct; revealDelay?: number }) {
  const [open, setOpen] = useState(false);
  const onSale = p.old_price != null && p.old_price > p.price;
  const price = (
    <span className="inline-flex items-baseline gap-2">
      {onSale && <s className="text-sm text-muted-foreground">{formatPrice(p.old_price!)}</s>}
      <span>{formatPrice(p.price)}</span>
    </span>
  );
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <article
        data-product-id={p.id}
        data-reveal
        data-reveal-delay={revealDelay}
        className="product-card group"
      >
        <DialogTrigger asChild>
          <button
            type="button"
            aria-label={`Ver detalhes de ${p.name}`}
            className="image-hover-frame relative block aspect-[4/5] w-full overflow-hidden bg-card text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          >
            <div aria-hidden className="absolute inset-0 grid place-items-center">
              <span className="font-serif text-2xl font-light italic text-muted-foreground/60 md:text-3xl">
                Eterna Flor
              </span>
            </div>
            {p.image && (
              <img
                src={p.image}
                alt={`${p.name} — flores feitas à mão`}
                loading="lazy"
                decoding="async"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
                className={`editorial-image relative h-full w-full object-cover ${p.available ? "" : "opacity-60"}`}
              />
            )}
            <span className="absolute bottom-0 left-0 bg-background px-3 py-1.5 text-sm font-light md:hidden">
              {price}
            </span>
            {!p.available && (
              <span className="absolute left-0 top-0 bg-background px-3 py-1.5 text-[10px] uppercase tracking-[0.2em]">
                Temporariamente indisponível
              </span>
            )}
          </button>
        </DialogTrigger>
        <div className="mt-4 flex items-baseline justify-between gap-3 md:mt-8">
          <h3 className="text-xl font-light md:text-3xl">
            <DialogTrigger asChild>
              <button
                type="button"
                className="text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
              >
                {p.name}
              </button>
            </DialogTrigger>
          </h3>
          <span className="hidden shrink-0 text-lg font-light md:inline">{price}</span>
        </div>
        {p.short_description && (
          <p className="mt-3 hidden text-sm font-light leading-relaxed text-muted-foreground md:block">
            {p.short_description}
          </p>
        )}
        {p.available ? (
          <a
            href={wa(productOrderMessage(p))}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex w-full items-center justify-center border border-primary py-3.5 text-[10px] uppercase tracking-[0.25em] transition-all hover:bg-primary hover:text-primary-foreground md:mt-8 md:py-4"
          >
            Quero este
          </a>
        ) : (
          <span
            aria-disabled
            className="mt-4 inline-flex w-full cursor-not-allowed items-center justify-center border border-border py-3.5 text-[10px] uppercase tracking-[0.25em] text-muted-foreground md:mt-8 md:py-4"
          >
            Indisponível
          </span>
        )}
      </article>
      {open && <ProductDetail p={p} />}
    </Dialog>
  );
}
