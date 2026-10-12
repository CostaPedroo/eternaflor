import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AnchorHTMLAttributes } from "react";
import type { Product } from "@/lib/admin";
const mocks = vi.hoisted(() => ({
  save: vi.fn(),
  slug: vi.fn(),
  upload: vi.fn(),
  navigate: vi.fn(),
  error: vi.fn(),
  success: vi.fn(),
  from: vi.fn(),
  main: vi.fn(),
  categories: [] as { id: string; name: string; slug: string; active: boolean }[],
  categoryError: null as Error | null,
}));
vi.mock("@tanstack/react-router", async (original) => ({
  ...(await original<typeof import("@tanstack/react-router")>()),
  useNavigate: () => mocks.navigate,
  Link: ({ to, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) => (
    <a {...props} href={to} />
  ),
}));
vi.mock("sonner", () => ({ toast: { error: mocks.error, success: mocks.success } }));
vi.mock("@/lib/admin", () => ({
  saveProductWithCategories: mocks.save,
  uniqueSlug: mocks.slug,
  uploadProductImage: mocks.upload,
  resolveImageUrls: vi.fn(),
  friendlyError: () => "Algo correu mal. Tenta novamente.",
}));
vi.mock("@/integrations/external/client", () => ({ supabase: { from: mocks.from } }));
import { ProductForm } from "@/components/admin/ProductForm";
const product: Product = {
  id: "one",
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
  main_image: null,
  sort_order: 0,
  created_at: "2026-10-12",
  updated_at: "2026-10-12",
  categories: [
    { id: "a", name: "Bouquets", slug: "bouquets" },
    { id: "c", name: "Personalizados", slug: "personalizados" },
  ],
};
let client: QueryClient;
beforeEach(() => {
  vi.clearAllMocks();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  mocks.categories = [
    { id: "a", name: "Bouquets", slug: "bouquets", active: true },
    { id: "b", name: "Caixas", slug: "caixas", active: true },
    { id: "c", name: "Personalizados", slug: "personalizados", active: true },
  ];
  mocks.categoryError = null;
  mocks.save.mockResolvedValue("saved");
  mocks.slug.mockResolvedValue("caixa");
  mocks.main.mockResolvedValue({ error: null });
  mocks.from.mockImplementation((table: string) => {
    if (table === "categories")
      return {
        select: () => ({
          order: () => Promise.resolve({ data: mocks.categories, error: mocks.categoryError }),
        }),
      };
    if (table === "products")
      return {
        select: () => ({
          order: () => ({
            limit: () => ({
              maybeSingle: () => Promise.resolve({ data: { sort_order: 20 }, error: null }),
            }),
          }),
        }),
        update: () => ({ eq: mocks.main }),
      };
    if (table === "product_images")
      return {
        delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
        insert: () => Promise.resolve({ error: null }),
      };
    throw new Error(`Unexpected table ${table}`);
  });
});
afterEach(() => {
  cleanup();
  client.clear();
  vi.restoreAllMocks();
});
async function page(p?: Product) {
  render(
    <QueryClientProvider client={client}>
      <ProductForm {...(p ? { product: p } : {})} />
    </QueryClientProvider>,
  );
  await screen.findByRole("checkbox", { name: "Bouquets" });
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Guardar produto" })).toBeEnabled(),
  );
}
function fillNew() {
  fireEvent.change(screen.getByLabelText("Nome do produto"), { target: { value: "Caixa" } });
  fireEvent.change(screen.getByLabelText("Preço (€)"), { target: { value: "25" } });
}
describe("Admin product category checkboxes", () => {
  it("creates with two dynamic categories and no legacy category field", async () => {
    await page();
    fillNew();
    fireEvent.click(screen.getByRole("checkbox", { name: "Bouquets" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Caixas" }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar produto" }));
    await waitFor(() =>
      expect(mocks.save).toHaveBeenCalledWith(
        null,
        expect.objectContaining({ name: "Caixa", sort_order: 30 }),
        ["a", "b"],
      ),
    );
    expect(mocks.save.mock.calls[0]![1]).not.toHaveProperty("category_id");
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith({ to: "/admin/produtos" }));
  });
  it("loads all current categories checked and saves the exact edited set", async () => {
    await page(product);
    expect(screen.getByRole("checkbox", { name: "Bouquets" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Personalizados" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Caixas" })).not.toBeChecked();
    fireEvent.click(screen.getByRole("checkbox", { name: "Caixas" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Bouquets" }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar produto" }));
    await waitFor(() =>
      expect(mocks.save).toHaveBeenCalledWith("one", expect.objectContaining({ name: "Caixa" }), [
        "c",
        "b",
      ]),
    );
  });
  it("allows an explicit uncategorized product, as the existing application did", async () => {
    await page();
    fillNew();
    expect(screen.getByText(/Sem seleção/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Guardar produto" }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith(null, expect.any(Object), []));
    expect(mocks.error).not.toHaveBeenCalled();
  });
  it("validates deleted selected categories instead of silently losing them", async () => {
    await page({
      ...product,
      categories: [{ id: "deleted", name: "Eliminada", slug: "eliminada" }],
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar produto" }));
    expect(mocks.error).toHaveBeenCalledWith(expect.stringContaining("já não está disponível"));
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("retries a later photo failure against the saved draft, without creating another product", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.main
      .mockResolvedValueOnce({ error: new Error("Photo failure") })
      .mockResolvedValue({ error: null });
    await page();
    fillNew();
    fireEvent.click(screen.getByRole("checkbox", { name: "Caixas" }));
    const save = screen.getByRole("button", { name: "Guardar produto" });
    fireEvent.click(save);
    await waitFor(() => expect(mocks.error).toHaveBeenCalled());
    await waitFor(() => expect(save).toBeEnabled());
    fireEvent.click(save);
    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(2));
    expect(mocks.save.mock.calls.map((call) => call[0])).toEqual([null, "saved"]);
    expect(mocks.save.mock.calls.map((call) => call[2])).toEqual([["b"], ["b"]]);
  });
  it("disables saving when category lookup fails", async () => {
    mocks.categoryError = new Error("Offline");
    render(
      <QueryClientProvider client={client}>
        <ProductForm />
      </QueryClientProvider>,
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível carregar as categorias.",
    );
    expect(screen.getByRole("button", { name: "Guardar produto" })).toBeDisabled();
    expect(mocks.save).not.toHaveBeenCalled();
  });
});
