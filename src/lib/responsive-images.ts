import { PRODUCT_IMAGES_BUCKET } from "@/lib/config";

/** Only resize public photos owned by the configured external project. */
function mobileImageSources(src: string, widths: number[], quality: number): string | null {
  try {
    const configured = import.meta.env["VITE_EXT_SUPABASE_URL"];
    if (!configured) return null;
    const image = new URL(src);
    const prefix = `/storage/v1/object/public/${PRODUCT_IMAGES_BUCKET}/`;
    if (
      image.origin !== new URL(configured).origin ||
      !image.pathname.startsWith(prefix) ||
      image.search ||
      !/\.(webp|png|jpe?g)$/i.test(image.pathname)
    )
      return null;
    return widths
      .map((width) => {
        const variant = new URL(image);
        variant.pathname = variant.pathname.replace("/object/public/", "/render/image/public/");
        variant.searchParams.set("width", String(width));
        variant.searchParams.set("quality", String(quality));
        variant.searchParams.set("resize", "contain");
        return `${variant.href} ${width}w`;
      })
      .join(", ");
  } catch {
    // Legacy/local image URLs keep their existing behavior.
    return null;
  }
}

export const mobileProductImageSources = (src: string) =>
  mobileImageSources(src, [320, 480, 640, 960], 85);

export const mobileHeroImageSources = (src: string) =>
  mobileImageSources(src, [480, 768, 1080], 75);

export const MOBILE_HERO_SIZES = "calc(100vw - 3rem)";

/** React skips automatic img preloads inside picture: make the responsive request explicit. */
export function heroImagePreloads(src: string) {
  const imageSrcSet = mobileHeroImageSources(src);
  if (!imageSrcSet) return [];
  return [
    {
      rel: "preload",
      as: "image",
      imageSrcSet,
      imageSizes: MOBILE_HERO_SIZES,
      media: "(max-width: 767px)",
      fetchPriority: "high" as const,
    },
    {
      rel: "preload",
      as: "image",
      href: src,
      media: "(min-width: 768px)",
      fetchPriority: "high" as const,
    },
  ];
}
