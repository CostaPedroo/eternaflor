import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  belongsToCategory,
  categorySelectionError,
  normalizeProductCategories,
} from "@/lib/product-categories";
const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
  like: vi.fn(),
  select: vi.fn(),
  order: vi.fn(),
  eq: vi.fn(),
  single: vi.fn(),
}));
vi.mock("@/integrations/external/client", () => ({
  supabase: { rpc: mocks.rpc, from: mocks.from },
}));
import {
  duplicateProduct,
  loadAdminProduct,
  saveProductWithCategories,
  type Product,
} from "@/lib/admin";
const bouquet = { id: "bouquets", name: "Bouquets", slug: "bouquets" };
const custom = { id: "personalizados", name: "Personalizados", slug: "personalizados" };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.rpc.mockResolvedValue({ data: "saved", error: null });
  const chain = {
    select: mocks.select,
    like: mocks.like,
    eq: mocks.eq,
    order: mocks.order,
    maybeSingle: mocks.single,
  };
  [mocks.from, mocks.select, mocks.eq, mocks.order].forEach((fn) => fn.mockReturnValue(chain));
  mocks.like.mockResolvedValue({ data: [], error: null });
});
describe("Central product category data", () => {
  it("preserves backfilled single categories without treating the legacy mirror as a second source", () => {
    const single = normalizeProductCategories({
      id: "one",
      category_id: bouquet.id,
      product_categories: [{ categories: bouquet }],
    });
    expect(single).toEqual({ id: "one", categories: [bouquet] });
    expect(belongsToCategory(single, bouquet.id)).toBe(true);
    expect(
      normalizeProductCategories({ id: "empty", category_id: bouquet.id, product_categories: [] }),
    ).toEqual({ id: "empty", categories: [] });
  });
  it("normalizes duplicate/null joins and retains one product with clean category summaries", () => {
    const product = normalizeProductCategories({
      id: "one",
      featured: true,
      product_categories: [
        { categories: custom },
        { categories: bouquet },
        { categories: custom },
        { categories: null },
      ],
    });
    expect(product).toEqual({ id: "one", featured: true, categories: [bouquet, custom] });
    expect(belongsToCategory(product, bouquet.id)).toBe(true);
    expect(belongsToCategory(product, custom.id)).toBe(true);
    expect(belongsToCategory(product, "__ate15")).toBe(false);
  });
  it("loads all edit memberships in one nested request", async () => {
    mocks.single.mockResolvedValue({
      data: {
        id: "one",
        category_id: bouquet.id,
        product_categories: [{ categories: bouquet }, { categories: custom }],
      },
      error: null,
    });
    expect((await loadAdminProduct("one"))?.categories).toEqual([bouquet, custom]);
    expect(mocks.from).toHaveBeenCalledTimes(1);
    expect(mocks.select).toHaveBeenCalledWith("*,product_categories(categories(id,name,slug))");
  });
  it("passes the exact selected set to the save RPC, deduplicates IDs and reports failures", async () => {
    const fields = {
      name: "Caixa",
      slug: "caixa",
      price: 25,
      old_price: null,
      description: null,
      short_description: null,
      active: true,
      available: true,
      featured: false,
      customizable: true,
    };
    expect(await saveProductWithCategories(null, fields, [bouquet.id, custom.id, bouquet.id])).toBe(
      "saved",
    );
    expect(mocks.rpc).toHaveBeenCalledWith("save_product_with_categories", {
      _product_id: null,
      _product: fields,
      _category_ids: [bouquet.id, custom.id],
    });
    mocks.rpc.mockResolvedValue({ data: null, error: new Error("Rollback") });
    await expect(saveProductWithCategories("one", fields, [custom.id])).rejects.toThrow("Rollback");
  });
  it("duplicates by source ID through the atomic category/photo-copy RPC", async () => {
    const source = { id: "one", name: "Caixa", categories: [bouquet, custom] } as Product;
    expect(await duplicateProduct(source)).toEqual({ id: "saved" });
    expect(mocks.rpc).toHaveBeenCalledWith("duplicate_product_with_categories", {
      _source_id: "one",
      _name: "Caixa (Cópia)",
      _slug: "caixa-copia",
    });
    expect(mocks.from).toHaveBeenCalledTimes(1); // Unique slug only; no separate copy requests.
  });
  it("validates stale IDs while preserving the explicit existing uncategorized option", () => {
    expect(categorySelectionError([], [bouquet, custom])).toBeNull();
    expect(categorySelectionError([bouquet.id, custom.id], [bouquet, custom])).toBeNull();
    expect(categorySelectionError(["deleted"], [bouquet, custom])).toMatch(
      /já não está disponível/,
    );
  });
});
