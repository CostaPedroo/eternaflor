import { createServerFn } from "@tanstack/react-start";
import { queryOptions } from "@tanstack/react-query";

export type PublicProduct = {
  id: string;
  name: string;
  slug: string;
  short_description: string | null;
  price: number;
  old_price: number | null;
  image: string | null;
  featured: boolean;
  customizable: boolean;
  available: boolean;
};

export const getPublicProducts = createServerFn({ method: "GET" }).handler(async (): Promise<PublicProduct[]> => {
  const { createClient } = await import("@supabase/supabase-js");
  const { isStoragePath, PRODUCT_IMAGES_BUCKET } = await import("./config");
  const { EXT_SUPABASE_URL, EXT_SUPABASE_PUBLISHABLE_KEY } = await import("@/integrations/external/client");
  try {
    const sb = createClient(EXT_SUPABASE_URL, EXT_SUPABASE_PUBLISHABLE_KEY, {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await sb
      .from("products")
      .select("id,name,slug,short_description,price,old_price,main_image,featured,customizable,available")
      .eq("active", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error || !data) {
      console.error("getPublicProducts", error);
      return [];
    }
    const pub = (path: string) => sb.storage.from(PRODUCT_IMAGES_BUCKET).getPublicUrl(path).data.publicUrl;
    return data.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      short_description: p.short_description,
      price: Number(p.price),
      old_price: p.old_price == null ? null : Number(p.old_price),
      image: isStoragePath(p.main_image) ? pub(p.main_image) : p.main_image,
      featured: p.featured,
      customizable: p.customizable,
      available: p.available,
    }));
  } catch (e) {
    console.error("getPublicProducts", e);
    return [];
  }
});

export const publicProductsQuery = queryOptions({
  queryKey: ["public-products"],
  queryFn: () => getPublicProducts(),
  staleTime: 60_000,
});
