import { supabase } from "@/integrations/external/client";
import type { Database } from "@/integrations/supabase/types";
import { isStoragePath, PRODUCT_IMAGES_BUCKET } from "./config";
import {
  normalizeProductCategories,
  PRODUCT_CATEGORY_SELECT,
  type ProductCategory,
} from "./product-categories";

export type Product = Omit<Database["public"]["Tables"]["products"]["Row"], "category_id"> & {
  categories: ProductCategory[];
};
export type Category = Database["public"]["Tables"]["categories"]["Row"];
export type ProductImage = Database["public"]["Tables"]["product_images"]["Row"];

export async function isCurrentUserAdmin(): Promise<boolean> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return false;
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", u.user.id)
    .eq("role", "admin")
    .maybeSingle();
  return !!data;
}

export const slugify = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "produto";

export async function uniqueSlug(
  table: "products" | "categories",
  name: string,
  excludeId?: string,
) {
  const base = slugify(name);
  const { data } = await supabase.from(table).select("id,slug").like("slug", `${base}%`);
  const taken = new Set((data ?? []).filter((r) => r.id !== excludeId).map((r) => r.slug));
  if (!taken.has(base)) return base;
  let i = 2;
  while (taken.has(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}

/** Resolve stored image values (storage paths or URLs) to displayable URLs. */
// The bucket is public, so storage paths map directly to public URLs.
export async function resolveImageUrls(_values: (string | null | undefined)[]) {
  return (v: string | null | undefined) =>
    !v
      ? null
      : isStoragePath(v)
        ? supabase.storage.from(PRODUCT_IMAGES_BUCKET).getPublicUrl(v).data.publicUrl
        : v;
}

/** Resize to max 1600px and re-encode as WebP for fast loading. Falls back to the original file. */
export async function compressImage(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const max = 1600;
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", 0.82));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

export async function uploadProductImage(productId: string, file: File) {
  const blob = await compressImage(file);
  const ext =
    blob.type === "image/webp" ? "webp" : (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${productId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .upload(path, blob, { contentType: blob.type || file.type, upsert: false });
  if (error) throw error;
  return path;
}

export async function duplicateProduct(p: Product) {
  const name = `${p.name} (Cópia)`;
  const slug = await uniqueSlug("products", name);
  const { data, error } = await supabase.rpc("duplicate_product_with_categories", {
    _source_id: p.id,
    _name: name,
    _slug: slug,
  });
  if (error) throw error;
  if (!data) throw new Error("Não foi possível duplicar o produto.");
  return { id: data };
}

export type ProductSaveInput = Pick<
  Database["public"]["Tables"]["products"]["Row"],
  | "name"
  | "slug"
  | "short_description"
  | "description"
  | "price"
  | "old_price"
  | "available"
  | "active"
  | "featured"
  | "customizable"
> & { sort_order?: number };

export async function saveProductWithCategories(
  id: string | null,
  product: ProductSaveInput,
  categoryIds: string[],
) {
  const { data, error } = await supabase.rpc("save_product_with_categories", {
    _product_id: id,
    _product: product,
    _category_ids: [...new Set(categoryIds)],
  });
  if (error) throw error;
  if (!data) throw new Error("Não foi possível guardar o produto.");
  return data;
}

export async function loadAdminProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from("products")
    .select(`*,${PRODUCT_CATEGORY_SELECT}`)
    .order("sort_order")
    .order("created_at");
  if (error) throw error;
  return (data ?? []).map(normalizeProductCategories);
}

export async function loadAdminProduct(id: string): Promise<Product | null> {
  const { data, error } = await supabase
    .from("products")
    .select(`*,${PRODUCT_CATEGORY_SELECT}`)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? normalizeProductCategories(data) : null;
}

export const friendlyError = () => "Algo correu mal. Tenta novamente.";
