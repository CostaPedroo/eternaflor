import { queryOptions } from "@tanstack/react-query";
import { supabase, EXT_SUPABASE_URL } from "@/integrations/external/client";
import type { Database } from "@/integrations/supabase/types";
import { PRODUCT_IMAGES_BUCKET } from "@/lib/config";
import { prepareSiteImage } from "@/lib/site-image";

export type GalleryRow = Database["public"]["Tables"]["gallery_images"]["Row"];
export type PreparedGalleryImage = { image: Blob; width: number; height: number };

export const adminGalleryQuery = queryOptions({
  queryKey: ["admin", "gallery"],
  queryFn: async () => {
    const request = supabase
      .from("gallery_images")
      .select("*")
      .order("sort_order")
      .order("created_at")
      .order("id");
    const photos: GalleryRow[] = [];
    const pageSize = 500;
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await request.range(offset, offset + pageSize - 1);
      if (error)
        throw new Error(
          "Não foi possível carregar a galeria. Verifica se a configuração da galeria foi aplicada à base de dados.",
        );
      photos.push(...(data ?? []));
      if ((data?.length ?? 0) < pageSize) return photos;
    }
  },
});

export async function prepareGalleryImage(file: File): Promise<PreparedGalleryImage> {
  const image = await prepareSiteImage(file);
  // Never store a JPEG fallback with a .webp suffix, or upload an original photo.
  if (image.type !== "image/webp")
    throw new Error(
      "Este dispositivo não consegue criar WebP. Tenta preparar a fotografia noutro navegador.",
    );
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(image);
      const dimensions = { width: bitmap.width, height: bitmap.height };
      bitmap.close();
      return { image, ...dimensions };
    } catch {
      /* Reuse the mobile browser's native image decoder. */
    }
  }
  const url = URL.createObjectURL(image);
  try {
    const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const photo = new Image();
      photo.onload = () =>
        photo.naturalWidth && photo.naturalHeight
          ? resolve({ width: photo.naturalWidth, height: photo.naturalHeight })
          : reject(new Error("Não foi possível medir a fotografia."));
      photo.onerror = () => reject(new Error("Não foi possível abrir a fotografia preparada."));
      photo.src = url;
    });
    return { image, ...dimensions };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function uploadGalleryImage(
  photo: PreparedGalleryImage,
  sortOrder: number,
): Promise<GalleryRow> {
  if (
    photo.image.type !== "image/webp" ||
    !photo.image.size ||
    photo.image.size > 2 * 1024 * 1024 ||
    !Number.isInteger(photo.width) ||
    !Number.isInteger(photo.height) ||
    photo.width <= 0 ||
    photo.height <= 0
  ) {
    throw new Error("Não foi possível preparar a fotografia para envio.");
  }
  const path = `gallery/${crypto.randomUUID()}.webp`;
  const bucket = supabase.storage.from(PRODUCT_IMAGES_BUCKET);
  const { error: uploadError } = await bucket.upload(path, photo.image, {
    contentType: "image/webp",
    upsert: false,
  });
  if (uploadError) throw new Error("Não foi possível enviar a fotografia. Tenta novamente.");
  const { publicUrl } = bucket.getPublicUrl(path).data;
  const { data, error } = await supabase
    .from("gallery_images")
    .insert({
      image_url: publicUrl,
      sort_order: sortOrder,
      width: photo.width,
      height: photo.height,
    })
    .select("*")
    .single();
  if (error || !data) {
    await bucket.remove([path]).catch(() => undefined);
    throw new Error("Não foi possível guardar a fotografia na galeria. Tenta novamente.");
  }
  return data;
}

export async function setGalleryVisibility(id: string, active: boolean) {
  const { data, error } = await supabase
    .from("gallery_images")
    .update({ is_active: active })
    .eq("id", id)
    .select("id")
    .single();
  if (error || !data) throw new Error("Não foi possível atualizar a visibilidade da fotografia.");
}

export async function reorderGalleryImages(ids: string[]) {
  const { error } = await supabase.rpc("reorder_gallery_images", { _ids: ids });
  if (error)
    throw new Error("Não foi possível guardar a ordem. Atualiza a galeria e tenta novamente.");
}

export async function deleteGalleryImage(photo: GalleryRow) {
  const { data, error } = await supabase
    .from("gallery_images")
    .delete()
    .eq("id", photo.id)
    .select("id")
    .single();
  if (error || !data) throw new Error("Não foi possível eliminar a fotografia.");
  // Only clean up our own gallery uploads, never a product or another site's photo.
  const prefix = `${EXT_SUPABASE_URL}/storage/v1/object/public/${PRODUCT_IMAGES_BUCKET}/`;
  if (photo.image_url.startsWith(prefix)) {
    let path: string;
    try {
      path = decodeURIComponent(photo.image_url.slice(prefix.length));
    } catch {
      return { storageCleanupFailed: false };
    }
    if (
      /^gallery\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/i.test(path)
    ) {
      try {
        const { error: storageError } = await supabase.storage
          .from(PRODUCT_IMAGES_BUCKET)
          .remove([path]);
        return { storageCleanupFailed: !!storageError };
      } catch {
        return { storageCleanupFailed: true };
      }
    }
  }
  return { storageCleanupFailed: false };
}
