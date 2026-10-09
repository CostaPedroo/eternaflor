import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { publicGalleryQuery } from "@/lib/gallery.functions";
import { GalleryGrid } from "@/components/site/GalleryGrid";
import { StorefrontMotion } from "@/components/site/StorefrontMotion";
import { SiteHeader, SiteFooter, MobileCtaBar } from "@/components/site/SiteChrome";

export const Route = createFileRoute("/galeria")({
  loader: ({ context }) => context.queryClient.fetchQuery(publicGalleryQuery),
  head: () => ({
    meta: [
      { title: "Galeria — Eterna Flor" },
      {
        name: "description",
        content:
          "Encomendas reais e bouquets personalizados Eterna Flor. Inspira-te em diferentes cores, flores e combinações feitas à mão.",
      },
    ],
  }),
  component: GalleryPage,
});

function GalleryPage() {
  const initial = Route.useLoaderData();
  const { data, isError, isFetching, refetch } = useQuery({
    ...publicGalleryQuery,
    initialData: initial,
  });
  const images = data?.images ?? [];
  return (
    <StorefrontMotion className="min-h-screen bg-background text-foreground selection:bg-blush">
      <SiteHeader />
      <main className="mx-auto max-w-[1440px] px-6 pb-24 pt-14 md:px-16 md:pb-32 md:pt-20">
        <div data-page-entry className="mb-14 max-w-2xl md:mb-20">
          <p className="text-xs font-medium uppercase tracking-[0.4em] text-sage">Galeria</p>
          <h1 className="mt-4 font-serif text-5xl font-light leading-tight md:text-7xl">
            Feito à tua maneira.
          </h1>
          <p className="mt-6 text-base font-light leading-relaxed text-muted-foreground md:text-lg">
            Cada bouquet pode ser adaptado às cores, flores e estilo de quem o recebe.
          </p>
        </div>
        {isError || data?.unavailable ? (
          <div role="status" className="space-y-4 border border-border p-6 font-light">
            <p>Não foi possível carregar as fotografias. Tenta novamente dentro de momentos.</p>
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              className="min-h-11 border border-border px-4 text-sm disabled:opacity-50"
            >
              Tentar novamente
            </button>
          </div>
        ) : images.length ? (
          <GalleryGrid images={images} />
        ) : (
          <p className="border-t border-border py-12 font-light text-muted-foreground">
            Em breve, mais encomendas feitas à tua maneira.
          </p>
        )}
      </main>
      <SiteFooter />
      <MobileCtaBar />
    </StorefrontMotion>
  );
}
