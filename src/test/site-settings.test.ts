import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const result = vi.fn();
  const maybeSingle = vi.fn();
  const eq = vi.fn();
  const select = vi.fn();
  const update = vi.fn();
  return {
    result,
    maybeSingle,
    eq,
    select,
    update,
    from: vi.fn(),
    storageFrom: vi.fn(),
    upload: vi.fn(),
    remove: vi.fn(),
    getPublicUrl: vi.fn(),
  };
});
vi.mock("@/integrations/external/client", () => ({
  supabase: {
    from: mocks.from,
    storage: { from: mocks.storageFrom },
  },
}));

import { saveSiteImage, siteSettingsQuery } from "@/lib/site-settings";

beforeEach(() => {
  vi.clearAllMocks();
  const query = {
    select: mocks.select,
    update: mocks.update,
    eq: mocks.eq,
    single: mocks.result,
    maybeSingle: mocks.maybeSingle,
  };
  mocks.from.mockReturnValue(query);
  mocks.select.mockReturnValue(query);
  mocks.update.mockReturnValue(query);
  mocks.eq.mockReturnValue(query);
  mocks.result.mockResolvedValue({ data: { id: 1 }, error: null });
  mocks.storageFrom.mockReturnValue({
    upload: mocks.upload,
    remove: mocks.remove,
    getPublicUrl: mocks.getPublicUrl,
  });
  mocks.upload.mockResolvedValue({ error: null });
  mocks.remove.mockResolvedValue({ error: null });
  mocks.getPublicUrl.mockReturnValue({ data: { publicUrl: "https://storage.test/photo.webp" } });
});

describe("Homepage settings storage", () => {
  it.each([
    ["hero_image_url", "site/hero/"],
    ["custom_bouquet_image_url", "site/custom-bouquet/"],
  ] as const)("saves %s in its own folder and changes only that column", async (field, folder) => {
    const image = new Blob(["photo"], { type: "image/webp" });
    await expect(saveSiteImage(field, image)).resolves.toBe("https://storage.test/photo.webp");
    expect(mocks.storageFrom).toHaveBeenCalledWith("product-images");
    expect(mocks.upload).toHaveBeenCalledWith(
      expect.stringMatching(new RegExp(`^${folder}.+\\.webp$`)),
      image,
      { contentType: "image/webp", upsert: false },
    );
    expect(mocks.update).toHaveBeenCalledWith({ [field]: "https://storage.test/photo.webp" });
    expect(mocks.eq).toHaveBeenCalledWith("id", 1);
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it("does not update the settings when uploading is rejected", async () => {
    mocks.upload.mockResolvedValue({ error: { message: "Not authorized" } });
    await expect(
      saveSiteImage("hero_image_url", new Blob(["photo"], { type: "image/webp" })),
    ).rejects.toThrow("Não foi possível enviar");
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("cleans up only the new file when the setting update is rejected", async () => {
    mocks.result.mockResolvedValue({ data: null, error: { message: "Not authorized" } });
    await expect(
      saveSiteImage("hero_image_url", new Blob(["photo"], { type: "image/webp" })),
    ).rejects.toThrow("Não foi possível guardar");
    expect(mocks.remove).toHaveBeenCalledWith([mocks.upload.mock.calls[0]![0]]);
  });

  it("does not report success when no settings row was updated", async () => {
    mocks.result.mockResolvedValue({ data: null, error: null });
    await expect(
      saveSiteImage("hero_image_url", new Blob(["photo"], { type: "image/webp" })),
    ).rejects.toThrow("Não foi possível guardar");
  });

  it("loads the current image columns dynamically and surfaces read failures", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: { message: "Offline" } });
    await expect(siteSettingsQuery.queryFn!({} as never)).rejects.toEqual({ message: "Offline" });
    expect(mocks.from).toHaveBeenCalledWith("site_settings");
    expect(mocks.select).toHaveBeenCalledWith("id,hero_image_url,custom_bouquet_image_url");
  });
});
