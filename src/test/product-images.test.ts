import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  order: vi.fn(),
  storage: vi.fn(),
  publicUrl: vi.fn(),
}));
vi.mock("@/integrations/external/client", () => ({
  supabase: { from: mocks.from, storage: { from: mocks.storage } },
}));
import { getProductImages } from "@/lib/product-images";

beforeEach(() => {
  vi.clearAllMocks();
  const query = { select: mocks.select, eq: mocks.eq, order: mocks.order };
  mocks.from.mockReturnValue(query);
  mocks.select.mockReturnValue(query);
  mocks.eq.mockReturnValue(query);
  mocks.order.mockReturnValue(query);
  mocks.storage.mockReturnValue({ getPublicUrl: mocks.publicUrl });
  mocks.publicUrl.mockImplementation((path: string) => ({
    data: { publicUrl: `https://storage.test/${path}` },
  }));
});

describe("Public product image reads", () => {
  it("loads only the selected product's images in admin-defined order and resolves public paths", async () => {
    mocks.order.mockReturnValueOnce({ order: mocks.order }).mockResolvedValueOnce({
      data: [
        { id: "one", image_url: "product-1/one.webp", alt_text: "Primeira" },
        { id: "two", image_url: "https://legacy.test/two.jpg", alt_text: null },
      ],
      error: null,
    });
    expect(await getProductImages("product-1")).toEqual([
      { id: "one", url: "https://storage.test/product-1/one.webp", alt: "Primeira" },
      { id: "two", url: "https://legacy.test/two.jpg", alt: null },
    ]);
    expect(mocks.from).toHaveBeenCalledWith("product_images");
    expect(mocks.eq).toHaveBeenCalledWith("product_id", "product-1");
    expect(mocks.order.mock.calls).toEqual([
      ["sort_order", { ascending: true }],
      ["created_at", { ascending: true }],
    ]);
    expect(mocks.storage).toHaveBeenCalledWith("product-images");
    expect(mocks.publicUrl).toHaveBeenCalledTimes(1);
  });

  it("returns no photos for an empty gallery", async () => {
    mocks.order
      .mockReturnValueOnce({ order: mocks.order })
      .mockResolvedValueOnce({ data: [], error: null });
    expect(await getProductImages("product-1")).toEqual([]);
  });

  it("surfaces a failed read so the detail view can fall back and retry", async () => {
    mocks.order
      .mockReturnValueOnce({ order: mocks.order })
      .mockResolvedValueOnce({ data: null, error: { message: "Offline" } });
    await expect(getProductImages("product-1")).rejects.toEqual({ message: "Offline" });
  });
});
