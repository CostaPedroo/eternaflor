import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { galleryPreviewQuery, type GalleryResult } from "@/lib/gallery.functions";
import { GalleryGrid } from "@/components/site/GalleryGrid";

export function GalleryPreview({ initial }: { initial: GalleryResult | undefined }) {
  const { data } = useQuery({
    ...galleryPreviewQuery,
    initialData: initial ?? { images: [], unavailable: false },
  });
  if (!data?.images.length) return null;
  return (
    <section className="border-t border-border" aria-labelledby="gallery-preview-heading">
      <div className="mx-auto max-w-[1440px] px-6 py-24 md:px-16 md:py-32">
        <div data-reveal="heading" className="mb-12 md:mb-16">
          <p className="text-xs font-medium uppercase tracking-[0.4em] text-sage">
            Encomendas reais
          </p>
          <h2 id="gallery-preview-heading" className="mt-4 text-5xl font-light md:text-6xl">
            Feito à tua maneira.
          </h2>
        </div>
        <GalleryGrid images={data.images} preview />
        <div data-reveal className="mt-12 text-center">
          <Link
            to="/galeria"
            preload={false}
            className="inline-flex min-h-12 items-center justify-center border border-primary px-10 py-4 text-xs uppercase tracking-[0.2em] transition-colors hover:bg-primary hover:text-primary-foreground"
          >
            Ver galeria
          </Link>
        </div>
      </div>
    </section>
  );
}
