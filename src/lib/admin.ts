import { supabase } from "@/integrations/external/client";
import type { Database } from "@/integrations/supabase/types";
import { isStoragePath, PRODUCT_IMAGES_BUCKET } from "./config";

export type Product = Database["public"]["Tables"]["products"]["Row"];
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

export async function uniqueSlug(table: "products" | "categories", name: string, excludeId?: string) {
  const base = slugify(name);
  const { data } = await supabase.from(table).select("id,slug").like("slug", `${base}%`);
  const taken = new Set((data ?? []).filter((r) => r.id !== excludeId).map((r) => r.slug));
  if (!taken.has(base)) return base;
  let i = 2;
  while (taken.has(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}

/** Resolve stored image values (storage paths or URLs) to displayable URLs. */
export async function resolveImageUrls(values: (string | null | undefined)[]) {
  const paths = values.filter(isStoragePath);
  const map = new Map<string, string>();
  if (paths.length) {
    const { data } = await supabase.storage.from(PRODUCT_IMAGES_BUCKET).createSignedUrls(paths, 60 * 60);
    data?.forEach((d) => d.path && d.signedUrl && map.set(d.path, d.signedUrl));
  }
  return (v: string | null | undefined) => (!v ? null : isStoragePath(v) ? map.get(v) ?? null : v);
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
  const ext = blob.type === "image/webp" ? "webp" : (file.name.split(".").pop() || "jpg").toLowerCase();
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
  const { id: _id, created_at: _c, updated_at: _u, slug: _s, ...rest } = p;
  const { data, error } = await supabase
    .from("products")
    .insert({ ...rest, name, slug, active: false })
    .select()
    .single();
  if (error) throw error;
  const { data: imgs } = await supabase.from("product_images").select("*").eq("product_id", p.id);
  if (imgs?.length) {
    await supabase.from("product_images").insert(
      imgs.map((i) => ({ product_id: data.id, image_url: i.image_url, alt_text: i.alt_text, sort_order: i.sort_order })),
    );
  }
  return data;
}

export const friendlyError = () => "Algo correu mal. Tenta novamente.";
