import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/external/client";
import { isStoragePath, PRODUCT_IMAGES_BUCKET } from "@/lib/config";

export type PublicProductImage = { id: string; url: string; alt: string | null };

export async function getProductImages(productId: string): Promise<PublicProductImage[]> {
  const { data, error } = await supabase
    .from("product_images")
    .select("id,image_url,alt_text")
    .eq("product_id", productId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? [])
    .filter((image) => image.image_url)
    .map((image) => ({
      id: image.id,
      url: isStoragePath(image.image_url)
        ? supabase.storage.from(PRODUCT_IMAGES_BUCKET).getPublicUrl(image.image_url).data.publicUrl
        : image.image_url,
      alt: image.alt_text,
    }));
}

export const productImagesQuery = (productId: string) =>
  queryOptions({
    queryKey: ["public-product-images", productId],
    queryFn: () => getProductImages(productId),
    staleTime: 60_000,
  });
