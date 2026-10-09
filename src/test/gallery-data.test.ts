import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  order: vi.fn(),
  limit: vi.fn(),
  range: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  single: vi.fn(),
  createClient: vi.fn(),
  storage: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
  publicUrl: vi.fn(),
  rpc: vi.fn(),
  prepare: vi.fn(),
  result: { data: [] as unknown[], error: null as unknown },
  responses: [] as { data: unknown[]; error: unknown }[],
}));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({ handler: (handler: unknown) => handler }),
}));
vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.createClient }));
vi.mock("@/integrations/external/client", () => ({
  EXT_SUPABASE_URL: "https://storage.test",
  EXT_SUPABASE_PUBLISHABLE_KEY: "publishable",
  supabase: { from: mocks.from, rpc: mocks.rpc, storage: { from: mocks.storage } },
}));
vi.mock("@/lib/site-image", () => ({ prepareSiteImage: mocks.prepare }));
import { getGalleryPreview, getPublicGallery } from "@/lib/gallery.functions";
import {
  adminGalleryQuery,
  deleteGalleryImage,
  prepareGalleryImage,
  reorderGalleryImages,
  setGalleryVisibility,
  uploadGalleryImage,
  type GalleryRow,
} from "@/lib/gallery-admin";

const prefix = "https://storage.test/storage/v1/object/public/product-images/";
const path = "gallery/00000000-0000-4000-8000-000000000001.webp";
const row: GalleryRow = {
  id: "one",
  image_url: prefix + path,
  sort_order: 0,
  is_active: true,
  width: 1000,
  height: 1400,
  created_at: "2026-10-08",
};
const processed = {
  image: new Blob(["prepared"], { type: "image/webp" }),
  width: 1000,
  height: 1400,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.result = { data: [row], error: null };
  mocks.responses = [];
  const query = {
    select: mocks.select,
    eq: mocks.eq,
    order: mocks.order,
    limit: mocks.limit,
    range: mocks.range,
    insert: mocks.insert,
    update: mocks.update,
    delete: mocks.delete,
    single: mocks.single,
    then: (resolve: (value: typeof mocks.result) => unknown) =>
      Promise.resolve(mocks.responses.shift() ?? mocks.result).then(resolve),
  };
  [
    mocks.from,
    mocks.select,
    mocks.eq,
    mocks.order,
    mocks.limit,
    mocks.range,
    mocks.insert,
    mocks.update,
    mocks.delete,
  ].forEach((method) => method.mockReturnValue(query));
  mocks.single.mockResolvedValue({ data: row, error: null });
  mocks.createClient.mockReturnValue({ from: mocks.from, storage: { from: mocks.storage } });
  mocks.storage.mockReturnValue({
    upload: mocks.upload,
    remove: mocks.remove,
    getPublicUrl: mocks.publicUrl,
  });
  mocks.upload.mockResolvedValue({ error: null });
  mocks.remove.mockResolvedValue({ error: null });
  mocks.publicUrl.mockImplementation((path: string) => ({ data: { publicUrl: prefix + path } }));
  mocks.rpc.mockResolvedValue({ error: null });
});

describe("Gallery public data boundaries", () => {
  it("bounds the homepage query to six active photos, ordered consistently and using a session-free client", async () => {
    const result = await getGalleryPreview();
    expect(mocks.createClient).toHaveBeenCalledWith(
      "https://storage.test",
      "publishable",
      expect.objectContaining({
        auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
      }),
    );
    expect(mocks.from).toHaveBeenCalledWith("gallery_images");
    expect(mocks.eq).toHaveBeenCalledWith("is_active", true);
    expect(mocks.limit).toHaveBeenCalledWith(6);
    expect(mocks.order.mock.calls.map((call) => call[0])).toEqual([
      "sort_order",
      "created_at",
      "id",
    ]);
    expect(result).toEqual({
      images: [{ id: row.id, url: row.image_url, width: 1000, height: 1400 }],
      unavailable: false,
    });
  });
  it("fetches the complete active gallery only for its own query and resolves storage paths", async () => {
    mocks.result.data = [{ ...row, image_url: path }];
    expect((await getPublicGallery()).images[0]?.url).toBe(row.image_url);
    expect(mocks.limit).not.toHaveBeenCalled();
    expect(mocks.eq).toHaveBeenCalledWith("is_active", true);
  });
  it("returns a safe unavailable result for a missing migration/backend failure", async () => {
    mocks.result = { data: [], error: { code: "PGRST205" } };
    expect(await getPublicGallery()).toEqual({ images: [], unavailable: true });
  });
  it("reads subsequent batches so larger galleries are not truncated by the backend row cap", async () => {
    mocks.responses = [
      {
        data: Array.from({ length: 500 }, (_, index) => ({ ...row, id: `photo-${index}` })),
        error: null,
      },
      { data: [{ ...row, id: "last" }], error: null },
    ];
    const result = await getPublicGallery();
    expect(result.images).toHaveLength(501);
    expect(result.images[500]?.id).toBe("last");
    expect(mocks.range.mock.calls).toEqual([
      [0, 499],
      [500, 999],
    ]);
    expect(mocks.limit).not.toHaveBeenCalled();
  });
});

describe("Gallery admin storage and operations", () => {
  it("reads hidden as well as active photos in the gated admin query", async () => {
    await adminGalleryQuery.queryFn!({} as never);
    expect(mocks.from).toHaveBeenCalledWith("gallery_images");
    expect(mocks.eq).not.toHaveBeenCalled();
  });
  it("uploads only the processed WebP to gallery and persists natural dimensions and order", async () => {
    await uploadGalleryImage(processed, 7);
    expect(mocks.storage).toHaveBeenCalledWith("product-images");
    const uploadPath = mocks.upload.mock.calls[0]![0];
    expect(uploadPath).toMatch(/^gallery\/[0-9a-f-]{36}\.webp$/);
    expect(mocks.upload).toHaveBeenCalledWith(uploadPath, processed.image, {
      contentType: "image/webp",
      upsert: false,
    });
    expect(mocks.insert).toHaveBeenCalledWith({
      image_url: prefix + uploadPath,
      sort_order: 7,
      width: 1000,
      height: 1400,
    });
  });
  it("rejects originals/non-WebP rather than mislabelling or uploading them", async () => {
    await expect(
      uploadGalleryImage(
        { ...processed, image: new Blob(["original"], { type: "image/jpeg" }) },
        0,
      ),
    ).rejects.toThrow(/preparar/);
    expect(mocks.upload).not.toHaveBeenCalled();
    mocks.prepare.mockResolvedValue(new Blob(["jpeg fallback"], { type: "image/jpeg" }));
    await expect(
      prepareGalleryImage(new File(["photo"], "photo.jpg", { type: "image/jpeg" })),
    ).rejects.toThrow(/WebP/);
  });
  it("cleans up only the newly uploaded file if the insert fails", async () => {
    mocks.single.mockResolvedValue({ data: null, error: { code: "42501" } });
    await expect(uploadGalleryImage(processed, 0)).rejects.toThrow(/guardar/);
    expect(mocks.remove).toHaveBeenCalledWith([mocks.upload.mock.calls[0]![0]]);
  });
  it("uses the atomic reorder RPC and reports persistence failure", async () => {
    await reorderGalleryImages(["two", "one"]);
    expect(mocks.rpc).toHaveBeenCalledWith("reorder_gallery_images", { _ids: ["two", "one"] });
    expect(mocks.update).not.toHaveBeenCalled();
    mocks.rpc.mockResolvedValue({ error: { message: "changed" } });
    await expect(reorderGalleryImages(["two", "one"])).rejects.toThrow(/ordem/);
  });
  it("changes only gallery visibility and requires a confirmed updated row", async () => {
    await setGalleryVisibility("one", false);
    expect(mocks.update).toHaveBeenCalledWith({ is_active: false });
    expect(mocks.eq).toHaveBeenCalledWith("id", "one");
    mocks.single.mockResolvedValue({ data: null, error: { code: "42501" } });
    await expect(setGalleryVisibility("one", false)).rejects.toThrow(/visibilidade/);
  });
  it("deletes the DB row first and its own gallery file, and reports cleanup failures", async () => {
    expect(await deleteGalleryImage(row)).toEqual({ storageCleanupFailed: false });
    expect(mocks.delete).toHaveBeenCalled();
    expect(mocks.remove).toHaveBeenCalledWith([path]);
    mocks.remove.mockResolvedValue({ error: { code: "42501" } });
    expect(await deleteGalleryImage(row)).toEqual({ storageCleanupFailed: true });
  });
  it.each([
    prefix + "product-id/photo.webp",
    "https://other.test/" + path,
    prefix + "gallery/../product-id/photo.webp",
  ])("never deletes unrelated storage: %s", async (url) => {
    await deleteGalleryImage({ ...row, image_url: url });
    expect(mocks.remove).not.toHaveBeenCalled();
  });
  it("retains storage if deleting the row fails", async () => {
    mocks.single.mockResolvedValue({ data: null, error: { code: "42501" } });
    await expect(deleteGalleryImage(row)).rejects.toThrow(/eliminar/);
    expect(mocks.remove).not.toHaveBeenCalled();
  });
});
