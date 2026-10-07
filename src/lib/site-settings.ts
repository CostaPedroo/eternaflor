import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/external/client";
import { PRODUCT_IMAGES_BUCKET } from "@/lib/config";

export type SiteImageField = "hero_image_url" | "custom_bouquet_image_url";

// The existing singleton row in the owner's external Supabase project.
const SITE_SETTINGS_ID = 1;
const imageFolders: Record<SiteImageField, string> = {
  hero_image_url: "site/hero",
  custom_bouquet_image_url: "site/custom-bouquet",
};

export const siteSettingsQuery = queryOptions({
  queryKey: ["site-settings"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("site_settings")
      .select("id,hero_image_url,custom_bouquet_image_url")
      .eq("id", SITE_SETTINGS_ID)
      .maybeSingle();
    if (error) throw error;
    return data;
  },
  staleTime: 0,
  refetchOnMount: "always",
  refetchInterval: 60_000,
});

/** Upload a processed photo and update only its setting, using the admin session and existing RLS. */
export async function saveSiteImage(field: SiteImageField, image: Blob) {
  if (!["image/webp", "image/jpeg"].includes(image.type) || image.size > 2 * 1024 * 1024) {
    throw new Error("Não foi possível preparar a fotografia. Escolhe outra imagem.");
  }
  const extension = image.type === "image/webp" ? "webp" : "jpg";
  const path = `${imageFolders[field]}/${crypto.randomUUID()}.${extension}`;
  const bucket = supabase.storage.from(PRODUCT_IMAGES_BUCKET);
  const { error: uploadError } = await bucket.upload(path, image, {
    contentType: image.type,
    upsert: false,
  });
  if (uploadError) throw new Error("Não foi possível enviar a fotografia. Tenta novamente.");

  const { publicUrl } = bucket.getPublicUrl(path).data;
  const patch: Partial<Record<SiteImageField, string>> = { [field]: publicUrl };
  const { data, error } = await supabase
    .from("site_settings")
    .update(patch)
    .eq("id", SITE_SETTINGS_ID)
    .select("id")
    .single();
  if (error || !data) {
    // Only remove this new upload on failure; never remove an existing homepage image.
    await bucket.remove([path]).catch(() => undefined);
    throw new Error("Não foi possível guardar a fotografia. Tenta novamente.");
  }
  return publicUrl;
}
