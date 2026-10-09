import * as Dialog from "@radix-ui/react-dialog";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { GalleryImage } from "@/lib/gallery.functions";
import { completeEntrance, motion, motionStyle } from "@/lib/storefront-motion";
import { ImageReveal } from "@/components/site/ImageReveal";
import { CrossfadeImage } from "@/components/site/CrossfadeImage";

/** Natural-ratio editorial images, with a single on-demand accessible lightbox. */
export function GalleryGrid({
  images,
  preview = false,
}: {
  images: GalleryImage[];
  preview?: boolean;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLButtonElement | null>(null);
  const grid = useRef<HTMLDivElement>(null);
  const index = images.findIndex((image) => image.id === activeId);
  const current = index >= 0 ? images[index] : undefined;
  useEffect(() => {
    if (activeId !== null && !images.some((image) => image.id === activeId)) {
      setOpen(false);
      setActiveId(null);
    }
  }, [images, activeId]);
  const move = (direction: number) => {
    if (images.length > 1)
      setActiveId(images[(index + direction + images.length) % images.length]!.id);
  };
  return (
    <Dialog.Root open={open && !!current} onOpenChange={setOpen}>
      <div
        ref={grid}
        tabIndex={-1}
        className={`gallery-grid ${preview ? "gallery-grid-preview" : ""}`}
      >
        {images.map((image, position) => (
          <ImageReveal
            key={image.id}
            className="gallery-item bg-muted"
            data-reveal-delay={(position % 4) * motion.stagger.item}
            style={{ aspectRatio: `${image.width} / ${image.height}` }}
          >
            <button
              type="button"
              className="image-hover-frame relative block h-full w-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-sage"
              aria-label={`Ver encomenda personalizada ${position + 1}`}
              onClick={(event) => {
                opener.current = event.currentTarget;
                setActiveId(image.id);
                setOpen(true);
              }}
            >
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 grid place-items-center font-serif text-xl italic text-muted-foreground/60"
              >
                Eterna Flor
              </span>
              <img
                src={image.url}
                width={image.width}
                height={image.height}
                alt="Encomenda personalizada Eterna Flor"
                loading="lazy"
                decoding="async"
                draggable={false}
                className="editorial-image relative h-full w-full object-contain"
                onError={(event) => {
                  event.currentTarget.style.visibility = "hidden";
                }}
              />
            </button>
          </ImageReveal>
        ))}
      </div>
      {current && (
        <Lightbox
          image={current}
          index={index}
          count={images.length}
          move={move}
          restoreFocus={() => {
            const target = opener.current?.isConnected ? opener.current : grid.current;
            target?.focus({ preventScroll: true });
          }}
        />
      )}
    </Dialog.Root>
  );
}

function Lightbox({
  image,
  index,
  count,
  move,
  restoreFocus,
}: {
  image: GalleryImage;
  index: number;
  count: number;
  move: (direction: number) => void;
  restoreFocus: () => void;
}) {
  const overlay = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const reduce = () => {
      if (!preference.matches) return;
      if (overlay.current) completeEntrance(overlay.current);
      if (content.current) completeEntrance(content.current);
    };
    reduce();
    preference.addEventListener("change", reduce);
    return () => preference.removeEventListener("change", reduce);
  }, []);
  const arrowClass =
    "absolute top-1/2 z-10 grid h-11 w-11 -translate-y-1/2 place-items-center border border-primary-foreground/30 bg-foreground/60 text-primary-foreground transition-colors hover:bg-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-foreground";
  return (
    <Dialog.Portal>
      <Dialog.Overlay
        ref={overlay}
        className="storefront-overlay gallery-lightbox-overlay fixed inset-0 z-[70] bg-foreground/90"
        style={motionStyle}
        onAnimationEnd={(event) => {
          if (event.target === event.currentTarget) completeEntrance(event.currentTarget);
        }}
      />
      <Dialog.Content
        ref={content}
        style={motionStyle}
        className="storefront-dialog gallery-lightbox fixed left-1/2 top-1/2 z-[80] grid -translate-x-1/2 -translate-y-1/2 text-primary-foreground outline-none"
        onAnimationEnd={(event) => {
          if (event.target === event.currentTarget) completeEntrance(event.currentTarget);
        }}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          close.current?.focus();
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          restoreFocus();
        }}
        onKeyDown={(event) => {
          if (count > 1 && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
            event.preventDefault();
            move(event.key === "ArrowLeft" ? -1 : 1);
          }
        }}
      >
        <Dialog.Title className="sr-only">Galeria de encomendas personalizadas</Dialog.Title>
        <Dialog.Description className="sr-only">
          Usa as setas para mudar de fotografia. Escape fecha a galeria.
        </Dialog.Description>
        <div className="flex min-w-0 items-center justify-between gap-4 pb-3">
          <span
            aria-live="polite"
            aria-atomic="true"
            className="text-xs font-light tracking-widest"
          >
            {index + 1} / {count}
          </span>
          <Dialog.Close asChild>
            <button
              ref={close}
              type="button"
              aria-label="Fechar galeria"
              className="grid h-11 w-11 place-items-center border border-primary-foreground/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-foreground"
            >
              <X className="h-5 w-5" />
            </button>
          </Dialog.Close>
        </div>
        <div
          className="relative min-h-0 min-w-0 overflow-hidden"
          style={{ touchAction: "pan-y pinch-zoom" }}
          onTouchStart={(event) => {
            const point = event.touches[0];
            touch.current =
              point && event.touches.length === 1 ? { x: point.clientX, y: point.clientY } : null;
          }}
          onTouchCancel={() => {
            touch.current = null;
          }}
          onTouchEnd={(event) => {
            const point = event.changedTouches[0],
              start = touch.current;
            touch.current = null;
            if (!point || !start || count < 2) return;
            const dx = point.clientX - start.x,
              dy = point.clientY - start.y;
            if (Math.abs(dx) >= 40 && Math.abs(dx) > Math.abs(dy) * 1.5) move(dx < 0 ? 1 : -1);
          }}
        >
          {failedSrc === image.url ? (
            <p role="status" className="grid h-full place-items-center text-sm font-light">
              Fotografia indisponível.
            </p>
          ) : (
            <CrossfadeImage
              src={image.url}
              alt={`Encomenda personalizada Eterna Flor — fotografia ${index + 1}`}
              onError={() => setFailedSrc(image.url)}
            />
          )}
          {count > 1 && (
            <>
              <button
                type="button"
                aria-label="Fotografia anterior"
                className={`${arrowClass} left-0 sm:left-3`}
                onClick={() => move(-1)}
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                aria-label="Fotografia seguinte"
                className={`${arrowClass} right-0 sm:right-3`}
                onClick={() => move(1)}
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          )}
        </div>
      </Dialog.Content>
    </Dialog.Portal>
  );
}
