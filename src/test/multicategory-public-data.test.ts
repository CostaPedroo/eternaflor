import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  order: vi.fn(),
  rows: [] as unknown[],
}));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({ handler: (handler: unknown) => handler }),
}));
vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.create }));
vi.mock("@/integrations/external/client", () => ({
  EXT_SUPABASE_URL: "https://storage.test",
  EXT_SUPABASE_PUBLISHABLE_KEY: "publishable",
}));
import { getPublicProducts } from "@/lib/catalog.functions";
beforeEach(() => {
  vi.clearAllMocks();
  const query = {
    select: mocks.select,
    eq: mocks.eq,
    order: mocks.order,
    then: (resolve: (value: unknown) => unknown) =>
      Promise.resolve({ data: mocks.rows, error: null }).then(resolve),
  };
  [mocks.from, mocks.select, mocks.eq, mocks.order].forEach((method) =>
    method.mockReturnValue(query),
  );
  mocks.create.mockReturnValue({
    from: mocks.from,
    storage: {
      from: () => ({
        getPublicUrl: (path: string) => ({ data: { publicUrl: `https://storage.test/${path}` } }),
      }),
    },
  });
});
describe("Public products remain one row per product", () => {
  it("fetches memberships in one anonymous nested query and preserves featured/unavailable/uncategorized data", async () => {
    const category = { id: "a", name: "Bouquets", slug: "bouquets" };
    const custom = { id: "b", name: "Personalizados", slug: "personalizados" };
    const row = {
      id: "one",
      name: "Caixa",
      slug: "caixa",
      short_description: null,
      description: null,
      price: 25,
      old_price: 30,
      main_image: "one/main.webp",
      featured: true,
      customizable: true,
      available: false,
      sort_order: 0,
      created_at: "2026-10-12",
      product_categories: [{ categories: category }, { categories: custom }],
    };
    mocks.rows = [row, { ...row, id: "uncat", featured: false, product_categories: [] }];
    const result = await getPublicProducts();
    expect(result).toHaveLength(2);
    expect(result[0]?.categories).toEqual([category, custom]);
    expect(result[0]?.available).toBe(false);
    expect(result[0]?.old_price).toBe(30);
    expect(result[1]?.categories).toEqual([]);
    expect(result.filter((product) => product.featured)).toHaveLength(1);
    expect(result[0]?.image).toBe("https://storage.test/one/main.webp");
    expect(mocks.from).toHaveBeenCalledTimes(1);
    expect(mocks.eq).toHaveBeenCalledWith("active", true);
    expect(mocks.select.mock.calls[0]![0]).toContain(
      "product_categories(categories(id,name,slug))",
    );
    expect(mocks.select.mock.calls[0]![0]).not.toContain("category_id");
    expect(mocks.create).toHaveBeenCalledWith(
      "https://storage.test",
      "publishable",
      expect.objectContaining({
        auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
      }),
    );
  });
});
