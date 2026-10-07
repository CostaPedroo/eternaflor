const MAX_DIMENSION = 2000;
const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

async function decodeImage(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      // Some mobile browsers can decode a photo in <img> but not createImageBitmap.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () =>
        reject(
          new Error("Não foi possível abrir a fotografia. Escolhe uma imagem JPEG, PNG ou WebP."),
        );
      image.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function encode(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}

/** Never fall back to uploading the original phone photo if processing fails. */
export async function prepareSiteImage(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) throw new Error("Escolhe uma fotografia.");
  if (file.size > 40 * 1024 * 1024)
    throw new Error("A fotografia é demasiado grande. Escolhe uma imagem até 40 MB.");

  const image = await decodeImage(file);
  try {
    const width = "naturalWidth" in image ? image.naturalWidth : image.width;
    const height = "naturalHeight" in image ? image.naturalHeight : image.height;
    if (!width || !height) throw new Error("Não foi possível abrir a fotografia.");
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Não foi possível preparar a fotografia neste dispositivo.");
    const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
    for (let attempt = 0; attempt < 4; attempt++) {
      const currentScale = scale * 0.8 ** attempt;
      canvas.width = Math.max(1, Math.round(width * currentScale));
      canvas.height = Math.max(1, Math.round(height * currentScale));
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      let blob = await encode(canvas, "image/webp", 0.86);
      if (blob?.type !== "image/webp") {
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        blob = await encode(canvas, "image/jpeg", 0.86);
      }
      if (blob && blob.size > 0 && blob.size <= MAX_UPLOAD_BYTES) return blob;
    }
    throw new Error("Não foi possível reduzir a fotografia. Escolhe outra imagem.");
  } finally {
    if ("close" in image) image.close();
  }
}
