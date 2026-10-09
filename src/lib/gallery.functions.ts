import { createServerFn } from "@tanstack/react-start";
import { queryOptions } from "@tanstack/react-query";
import type { Database } from "@/integrations/supabase/types";

export type GalleryImage = { id: string; url: string; width: number; height: number };
export type GalleryResult = { images: GalleryImage[]; unavailable: boolean };
export const GALLERY_PREVIEW_LIMIT = 6;

async function readPublicGallery(limit?: number): Promise<GalleryResult> {
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const { EXT_SUPABASE_URL, EXT_SUPABASE_PUBLISHABLE_KEY } =
      await import("@/integrations/external/client");
    const { PRODUCT_IMAGES_BUCKET, isStoragePath } = await import("@/lib/config");
    // Public reads never inherit an admin browser session or reveal hidden images.
    const client = createClient<Database>(EXT_SUPABASE_URL, EXT_SUPABASE_PUBLISHABLE_KEY, {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    });
    const request = client
      .from("gallery_images")
      .select("id,image_url,width,height")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true })
      .order("id", { ascending: true });
    const data: Pick<
      Database["public"]["Tables"]["gallery_images"]["Row"],
      "id" | "image_url" | "width" | "height"
    >[] = [];
    if (limit !== undefined) {
      const result = await request.limit(limit);
      if (result.error) return { images: [], unavailable: true };
      data.push(...(result.data ?? []));
    } else {
      // Supabase caps each response. Read complete galleries in stable batches.
      const pageSize = 500;
      for (let offset = 0; ; offset += pageSize) {
        const result = await request.range(offset, offset + pageSize - 1);
        if (result.error) return { images: [], unavailable: true };
        data.push(...(result.data ?? []));
        if ((result.data?.length ?? 0) < pageSize) break;
      }
    }
    return {
      images: data
        .filter((image) => image.image_url)
        .map((image) => ({
          id: image.id,
          url: isStoragePath(image.image_url)
            ? client.storage.from(PRODUCT_IMAGES_BUCKET).getPublicUrl(image.image_url).data
                .publicUrl
            : image.image_url,
          width: image.width,
          height: image.height,
        })),
      unavailable: false,
    };
  } catch {
    return { images: [], unavailable: true };
  }
}

export const getPublicGallery = createServerFn({ method: "GET" }).handler(() =>
  readPublicGallery(),
);
export const getGalleryPreview = createServerFn({ method: "GET" }).handler(() =>
  readPublicGallery(GALLERY_PREVIEW_LIMIT),
);

export const publicGalleryQuery = queryOptions({
  queryKey: ["public-gallery", "all"],
  queryFn: () => getPublicGallery(),
  staleTime: 60_000,
  refetchOnMount: false,
});
export const galleryPreviewQuery = queryOptions({
  queryKey: ["public-gallery", "preview"],
  queryFn: () => getGalleryPreview(),
  staleTime: 60_000,
  refetchOnMount: false,
});
