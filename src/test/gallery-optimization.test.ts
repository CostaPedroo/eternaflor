import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("@/integrations/external/client", () => ({
  supabase: {},
  EXT_SUPABASE_URL: "https://storage.test",
}));
import { prepareGalleryImage } from "@/lib/gallery-admin";
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Gallery uses the existing phone-photo optimization pipeline", () => {
  it.each(["image/jpeg", "image/png"])(
    "resizes %s to WebP and records processed dimensions, not original dimensions",
    async (type) => {
      const canvas = document.createElement("canvas");
      const originalClose = vi.fn(),
        preparedClose = vi.fn();
      vi.stubGlobal(
        "createImageBitmap",
        vi
          .fn()
          .mockResolvedValueOnce({ width: 6000, height: 4000, close: originalClose })
          .mockResolvedValueOnce({ width: 2000, height: 1333, close: preparedClose }),
      );
      vi.spyOn(document, "createElement").mockReturnValue(canvas);
      vi.spyOn(canvas, "getContext").mockReturnValue({
        drawImage: vi.fn(),
      } as unknown as CanvasRenderingContext2D);
      const blob = new Blob(["small optimized photo"], { type: "image/webp" });
      vi.spyOn(canvas, "toBlob").mockImplementation((callback) => callback(blob));
      const result = await prepareGalleryImage(
        new File(["huge phone original"], "phone", { type }),
      );
      expect(result).toEqual({ image: blob, width: 2000, height: 1333 });
      expect(canvas.width).toBe(2000);
      expect(canvas.height).toBe(1333);
      expect(canvas.toBlob).toHaveBeenCalledWith(expect.any(Function), "image/webp", 0.86);
      expect(originalClose).toHaveBeenCalled();
      expect(preparedClose).toHaveBeenCalled();
    },
  );
});
