import { Content } from "@radix-ui/react-dialog";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useRef, useState } from "react";
import {
  DialogClose,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PublicProduct } from "@/lib/catalog.functions";
import { formatPrice, productOrderMessage, wa } from "@/lib/config";
import { productImagesQuery, type PublicProductImage } from "@/lib/product-images";
import { CrossfadeImage } from "@/components/site/CrossfadeImage";
import { motionStyle } from "@/lib/storefront-motion";

/** Mounted only when the user opens a card, so catalogue cards do not fetch galleries. */
export function ProductDetail({ p }: { p: PublicProduct }) {
  const { data, isPending, isError, refetch } = useQuery(productImagesQuery(p.id));
  const images = data?.length ? data : [{ id: "main", url: p.image ?? "", alt: null }];
  const onSale = p.old_price != null && p.old_price > p.price;

  return (
    <DialogPortal>
      <DialogOverlay style={motionStyle} className="storefront-overlay bg-foreground/40" />
      <Content
        style={motionStyle}
        className="storefront-dialog fixed left-1/2 top-1/2 z-50 max-h-[calc(100dvh-1.5rem)] w-[calc(100%-1.5rem)] max-w-4xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto border border-border bg-background p-4 pt-16 text-foreground sm:p-8 sm:pt-16"
      >
        <DialogClose
          aria-label="Fechar detalhes do produto"
          className="absolute right-3 top-3 grid h-11 w-11 place-items-center border border-border transition-colors hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        >
          <X className="h-5 w-5" />
        </DialogClose>
        <div className="grid min-w-0 gap-8 md:grid-cols-2 md:gap-10">
          <div className="min-w-0">
            <ProductGallery
              key={images.map((image) => image.id).join(",")}
              images={images}
              product={p}
            />
            {isPending && (
              <p role="status" className="mt-3 text-xs text-muted-foreground">
                A carregar fotografias…
              </p>
            )}
            {isError && (
              <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                <p role="status">Não foi possível carregar todas as fotografias.</p>
                <button
                  type="button"
                  onClick={() => refetch()}
                  className="min-h-11 underline underline-offset-4"
                >
                  Tentar novamente
                </button>
              </div>
            )}
          </div>
          <div className="min-w-0 md:py-3">
            <DialogTitle className="break-words font-serif text-3xl font-light leading-tight sm:text-4xl">
              {p.name}
            </DialogTitle>
            <p className="mt-5 flex flex-wrap items-baseline gap-3 text-xl font-light">
              {onSale && (
                <s className="text-base text-muted-foreground">{formatPrice(p.old_price!)}</s>
              )}
              <span>{formatPrice(p.price)}</span>
            </p>
            <DialogDescription className="mt-6 whitespace-pre-line break-words text-base font-light leading-relaxed text-muted-foreground">
              {p.description ||
                p.short_description ||
                "Flores artesanais feitas à mão pela Eterna Flor."}
            </DialogDescription>
            {p.available ? (
              <a
                href={wa(productOrderMessage(p))}
                target="_blank"
                rel="noreferrer"
                className="mt-8 inline-flex min-h-12 w-full items-center justify-center border border-primary px-4 py-4 text-[10px] uppercase tracking-[0.25em] transition-all hover:bg-primary hover:text-primary-foreground"
              >
                Quero este
              </a>
            ) : (
              <span
                aria-disabled
                className="mt-8 inline-flex min-h-12 w-full cursor-not-allowed items-center justify-center border border-border px-4 py-4 text-[10px] uppercase tracking-[0.25em] text-muted-foreground"
              >
                Indisponível
              </span>
            )}
          </div>
        </div>
      </Content>
    </DialogPortal>
  );
}

function ProductGallery({
  images,
  product,
}: {
  images: PublicProductImage[];
  product: PublicProduct;
}) {
  const [index, setIndex] = useState(0);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const current = images[index]!;
  const multiple = images.length > 1;
  const move = (direction: number) =>
    setIndex((previous) => (previous + direction + images.length) % images.length);
  const arrowClass =
    "absolute top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center border border-border bg-background/90 transition-colors hover:bg-background focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary";

  return (
    <div role="group" aria-label={`Fotografias de ${product.name}`}>
      <div
        className="relative aspect-[4/5] overflow-hidden bg-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        style={{ touchAction: "pan-y pinch-zoom" }}
        tabIndex={multiple ? 0 : undefined}
        aria-label={multiple ? "Galeria: usa as setas para mudar de fotografia" : undefined}
        onKeyDown={(event) => {
          if (multiple && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
            event.preventDefault();
            move(event.key === "ArrowRight" ? 1 : -1);
          }
        }}
        onTouchStart={(event) => {
          const point = event.touches[0];
          touch.current =
            point && event.touches.length === 1 ? { x: point.clientX, y: point.clientY } : null;
        }}
        onTouchCancel={() => {
          touch.current = null;
        }}
        onTouchEnd={(event) => {
          const point = event.changedTouches[0];
          const start = touch.current;
          touch.current = null;
          if (!multiple || !start || !point) return;
          const dx = point.clientX - start.x;
          const dy = point.clientY - start.y;
          if (Math.abs(dx) >= 40 && Math.abs(dx) > Math.abs(dy) * 1.5) move(dx < 0 ? 1 : -1);
        }}
      >
        <GalleryPhoto
          src={current.url}
          fallbackSrc={product.image}
          alt={current.alt || `${product.name} — fotografia ${index + 1}`}
        />
        {multiple && (
          <>
            <button
              type="button"
              aria-label="Fotografia anterior"
              onClick={() => move(-1)}
              className={`${arrowClass} left-2`}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              aria-label="Fotografia seguinte"
              onClick={() => move(1)}
              className={`${arrowClass} right-2`}
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}
      </div>
      {multiple && (
        <>
          <p
            aria-live="polite"
            aria-atomic="true"
            className="mt-3 text-center text-[10px] uppercase tracking-[0.2em] text-muted-foreground"
          >
            Fotografia {index + 1} de {images.length}
          </p>
          <div className="mt-3 flex gap-2 overflow-x-auto p-1 pb-2">
            {images.map((image, position) => (
              <button
                key={image.id}
                type="button"
                aria-label={`Ver fotografia ${position + 1} de ${product.name}`}
                aria-pressed={position === index}
                onClick={() => setIndex(position)}
                className={`relative h-16 w-14 shrink-0 overflow-hidden border bg-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${position === index ? "border-primary ring-1 ring-primary" : "border-border opacity-70 hover:opacity-100"}`}
              >
                <GalleryPhoto key={image.url} src={image.url} fallbackSrc={null} alt="" thumbnail />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function GalleryPhoto({
  src,
  fallbackSrc,
  alt,
  thumbnail = false,
}: {
  src: string;
  fallbackSrc: string | null;
  alt: string;
  thumbnail?: boolean;
}) {
  const [failed, setFailed] = useState<string[]>([]);
  const url = [src, fallbackSrc].find((value) => value && !failed.includes(value));
  return (
    <>
      <div aria-hidden className="absolute inset-0 grid place-items-center">
        <span
          className={`font-serif font-light italic text-muted-foreground/60 ${thumbnail ? "text-xs" : "text-3xl"}`}
        >
          Eterna Flor
        </span>
      </div>
      {url && !thumbnail && (
        <CrossfadeImage
          src={url}
          alt={alt}
          onError={() => setFailed((previous) => [...previous, url])}
        />
      )}
      {url && thumbnail && (
        <img
          key={url}
          src={url}
          alt={alt}
          decoding="async"
          draggable={false}
          onLoad={(event) => {
            if (!thumbnail) event.currentTarget.dataset["loaded"] = "true";
          }}
          onError={() => setFailed((previous) => [...previous, url])}
          className={`relative h-full w-full ${thumbnail ? "object-cover" : "gallery-photo object-contain"}`}
        />
      )}
    </>
  );
}
