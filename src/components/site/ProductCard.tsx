import { wa, formatPrice, productOrderMessage } from "@/lib/config";
import type { PublicProduct } from "@/lib/catalog.functions";

export function ProductCard({ p }: { p: PublicProduct }) {
  const onSale = p.old_price != null && p.old_price > p.price;
  const price = (
    <span className="inline-flex items-baseline gap-2">
      {onSale && <s className="text-sm text-muted-foreground">{formatPrice(p.old_price!)}</s>}
      <span>{formatPrice(p.price)}</span>
    </span>
  );
  return (
    <article className="group">
      <div className="relative aspect-[4/5] overflow-hidden bg-card">
        <div aria-hidden className="absolute inset-0 grid place-items-center">
          <span className="font-serif text-2xl font-light italic text-muted-foreground/60 md:text-3xl">Eterna Flor</span>
        </div>
        {p.image && (
          <img
            src={p.image}
            alt={`${p.name} — flores feitas à mão`}
            loading="lazy"
            decoding="async"
            onError={(e) => { e.currentTarget.style.display = "none"; }}
            className={`relative h-full w-full object-cover transition-transform duration-700 group-hover:scale-105 ${p.available ? "" : "opacity-60"}`}
          />
        )}
        <span className="absolute bottom-0 left-0 bg-background px-3 py-1.5 text-sm font-light md:hidden">{price}</span>
        {!p.available && (
          <span className="absolute left-0 top-0 bg-background px-3 py-1.5 text-[10px] uppercase tracking-[0.2em]">Temporariamente indisponível</span>
        )}
      </div>
      <div className="mt-4 flex items-baseline justify-between gap-3 md:mt-8">
        <h3 className="text-xl font-light md:text-3xl">{p.name}</h3>
        <span className="hidden shrink-0 text-lg font-light md:inline">{price}</span>
      </div>
      {p.short_description && (
        <p className="mt-3 hidden text-sm font-light leading-relaxed text-muted-foreground md:block">{p.short_description}</p>
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
        <span aria-disabled className="mt-4 inline-flex w-full cursor-not-allowed items-center justify-center border border-border py-3.5 text-[10px] uppercase tracking-[0.25em] text-muted-foreground md:mt-8 md:py-4">
          Indisponível
        </span>
      )}
    </article>
  );
}
