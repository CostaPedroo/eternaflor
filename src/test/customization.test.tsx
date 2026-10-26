import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
  RouterContextProvider,
} from "@tanstack/react-router";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicProduct } from "@/lib/catalog.functions";
import { customizationBudget, initialCustomization } from "@/lib/customization";
import { customizationOrderMessage, productOrderMessage, wa } from "@/lib/config";
import { CustomizationForm } from "@/components/site/CustomizationForm";
import { ProductCard } from "@/components/site/ProductCard";

vi.mock("@/lib/product-images", () => ({
  productImagesQuery: (id: string) => ({ queryKey: ["photos", id], queryFn: () => [] }),
}));
const categories = [
  { id: "bouquets", name: "Bouquets", slug: "bouquets" },
  { id: "presentes", name: "Presentes", slug: "presentes" },
  { id: "vasos", name: "Vasos", slug: "vasos" },
];
const product: PublicProduct = {
  id: "rose",
  name: "Bouquet Rosa",
  slug: "rose",
  price: 25,
  old_price: 40,
  image: "/rose.webp",
  description: "Flores",
  short_description: "Flores",
  featured: true,
  customizable: false,
  available: true,
  categories: categories.slice(0, 2),
  sort_order: 0,
  created_at: "2026-10-26",
};
const products = [
  product,
  { ...product, id: "vaso", name: "Vaso de Orquídeas", price: 55, categories: [categories[2]!] },
];
const clients: QueryClient[] = [];
beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  });
});
afterEach(() => {
  cleanup();
  clients.splice(0).forEach((client) => client.clear());
  vi.restoreAllMocks();
  vi.useRealTimers();
});
const selected = () => ({
  category: screen.getByRole("combobox", { name: "Categoria" }),
  product: screen.getByRole("combobox", { name: "Produto a personalizar" }),
});
async function setup(url = "/", cardProduct = product) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  clients.push(client);
  const root = createRootRoute({
    component: () => (
      <QueryClientProvider client={client}>
        <Outlet />
      </QueryClientProvider>
    ),
  });
  const home = createRoute({
    getParentRoute: () => root,
    path: "/",
    component: () => (
      <section id="personalizados">
        <CustomizationForm products={products} categories={categories} />
      </section>
    ),
  });
  const catalogue = createRoute({
    getParentRoute: () => root,
    path: "/catalogo",
    component: () => <ProductCard p={cardProduct} categoryId="presentes" />,
  });
  const history = createMemoryHistory({ initialEntries: [url] });
  const router = createRouter({
    routeTree: root.addChildren([home, catalogue]),
    history,
    scrollRestoration: true,
  });
  await router.load();
  const view = render(<RouterProvider router={router} />);
  return { history, router, view };
}

describe("Flexible product customization", () => {
  it.each([
    [0, "Até 15€"],
    [15, "Até 15€"],
    [15.01, "15€–25€"],
    [25, "15€–25€"],
    [25.01, "25€–40€"],
    [40, "25€–40€"],
    [40.01, "40€–60€"],
    [60, "40€–60€"],
    [60.01, "60€+"],
  ])("maps current price %s to exactly one budget (%s)", (price, budget) =>
    expect(customizationBudget(Number(price))).toBe(budget),
  );

  it("uses a valid preferred membership or a deterministic active category", () => {
    expect(
      initialCustomization(products, [...categories].reverse(), "rose", "presentes").categoryId,
    ).toBe("presentes");
    expect(
      initialCustomization(products, [...categories].reverse(), "rose", "vasos").categoryId,
    ).toBe("bouquets");
    expect(initialCustomization(products, [], "rose").categoryId).toBe("");
    expect(initialCustomization(products, categories, "missing").productId).toBe("");
  });

  it("preselects from IDs, ignores names in the URL and preserves manual budgets on calendar history changes", async () => {
    const { history } = await setup(
      "/?personalizar=rose&categoria=presentes&nome=Inventado#personalizados",
    );
    expect(selected().category).toHaveValue("presentes");
    expect(selected().product).toHaveValue("rose");
    expect(screen.getByRole("button", { name: "15€–25€" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "60€+" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Nome" }), { target: { value: "Ana" } });
    await act(async () =>
      history.push("/?personalizar=rose&categoria=presentes&calendario=data#personalizados"),
    );
    await act(async () => history.back());
    expect(selected().product).toHaveValue("rose");
    expect(screen.getByRole("button", { name: "60€+" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("textbox", { name: "Nome" })).toHaveValue("Ana");
  });

  it("updates multi-category options, clears invalid combinations and persists changes/removal in the URL without pushes", async () => {
    const { history } = await setup("/?personalizar=rose&categoria=bouquets#personalizados");
    const name = screen.getByRole("textbox", { name: "Nome" });
    fireEvent.change(name, { target: { value: "Maria" } });
    fireEvent.change(selected().category, { target: { value: "presentes" } });
    expect(selected().product).toHaveValue("rose");
    fireEvent.change(selected().category, { target: { value: "vasos" } });
    expect(selected().product).toHaveValue("");
    expect(within(selected().product).queryByRole("option", { name: "Bouquet Rosa" })).toBeNull();
    fireEvent.change(selected().product, { target: { value: "vaso" } });
    expect(screen.getByRole("button", { name: "40€–60€" })).toHaveAttribute("aria-pressed", "true");
    expect(history.location.search).toContain("personalizar=vaso");
    fireEvent.change(selected().product, { target: { value: "" } });
    expect(history.location.search).not.toContain("personalizar=");
    expect(history.length).toBe(1);
    expect(name).toHaveValue("Maria");
  });

  it("supports an optional product, missing/deleted IDs and properly encoded WhatsApp messages without empty fields", async () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    await setup("/?personalizar=deleted&produto_nome=Inventado#personalizados");
    expect(screen.getByRole("status")).toHaveTextContent("já não está disponível");
    expect(selected().product).toHaveValue("");
    const name = screen.getByRole("textbox", { name: "Nome" });
    expect(name).toBeRequired();
    expect(selected().product).not.toBeRequired();
    fireEvent.change(name, { target: { value: "Ana & João" } });
    fireEvent.click(screen.getByRole("button", { name: "Pedir personalização" }));
    const message = new URL(String(open.mock.calls[0]?.[0])).searchParams.get("text");
    expect(message).toContain("Nome: Ana & João");
    expect(message).toContain("Sem produto específico do catálogo");
    for (const label of [
      "Data:",
      "Ocasião:",
      "Cores preferidas:",
      "Flores preferidas:",
      "Detalhes adicionais:",
      "Inventado",
    ])
      expect(message).not.toContain(label);
    expect(open).toHaveBeenCalledWith(expect.any(String), "_blank");
  });

  it("uses current product/category data and formats the calendar's ISO civil date as DD/MM/YYYY", () => {
    const message = customizationOrderMessage({
      name: "Ana",
      category: "Presentes",
      product: "Bouquet Rosa",
      budget: "15€–25€",
      colors: "Rosa & branco",
      flowers: "Rosas",
      occasion: "Aniversário",
      date: "2026-11-15",
      details: "Mais flores + um laço",
    });
    expect(new URL(wa(message)).searchParams.get("text")).toBe(message);
    expect(message).toContain("Data: 15/11/2026");
    expect(message).toContain("Categoria: Presentes");
    expect(message).toContain("Produto: Bouquet Rosa");
    expect(message).toContain("Detalhes adicionais: Mais flores + um laço");
  });

  it("offers personalization even with customizable=false while preserving the exact direct-order URL", async () => {
    await setup("/catalogo");
    expect(screen.getByRole("link", { name: "Quero este" })).toHaveAttribute(
      "href",
      wa(productOrderMessage(product)),
    );
    fireEvent.click(screen.getByRole("link", { name: "Personalizar" }));
    await screen.findByRole("combobox", { name: "Produto a personalizar" });
    expect(selected().product).toHaveValue("rose");
    expect(selected().category).toHaveValue("presentes");
  });

  it("consumes an open product modal when navigating to the form so Back never reopens it", async () => {
    const { history } = await setup("/catalogo");
    fireEvent.click(screen.getByRole("button", { name: "Ver detalhes de Bouquet Rosa" }));
    const dialog = within(await screen.findByRole("dialog"));
    fireEvent.click(dialog.getByRole("link", { name: "Personalizar" }));
    await screen.findByRole("combobox", { name: "Produto a personalizar" });
    expect(history.length).toBe(2);
    expect(history.location.state.eternaFlorModal).toBeUndefined();
    expect(screen.queryByRole("dialog")).toBeNull();
    await act(async () => history.back());
    await screen.findByRole("button", { name: "Ver detalhes de Bouquet Rosa" });
    expect(history.location.href).toBe("/catalogo");
    expect(screen.queryByRole("dialog")).toBeNull();
    await act(async () => history.forward());
    await screen.findByRole("combobox", { name: "Produto a personalizar" });
    expect(selected().product).toHaveValue("rose");
  });

  it("keeps unavailable active products open for customization without enabling their direct CTA", async () => {
    await setup("/catalogo", { ...product, available: false });
    expect(screen.queryByRole("link", { name: "Quero este" })).toBeNull();
    expect(screen.getByRole("link", { name: "Personalizar" })).toBeInTheDocument();
  });

  it("hydrates the SSR-selected category, product and budget without replacing the form", async () => {
    const makeRouter = () =>
      createRouter({
        routeTree: createRootRoute(),
        history: createMemoryHistory({
          initialEntries: ["/?personalizar=rose&categoria=presentes"],
        }),
      });
    const content = (router: ReturnType<typeof makeRouter>) => (
      <RouterContextProvider router={router}>
        <CustomizationForm products={products} categories={categories} />
      </RouterContextProvider>
    );
    const container = document.createElement("div");
    container.innerHTML = renderToString(content(makeRouter()));
    document.body.append(container);
    const form = container.querySelector("form");
    const error = vi.fn();
    const consoleError = vi.spyOn(console, "error");
    let root: ReturnType<typeof hydrateRoot>;
    await act(async () => {
      root = hydrateRoot(container, content(makeRouter()), { onRecoverableError: error });
    });
    expect(container.querySelector("form")).toBe(form);
    expect(selected().category).toHaveValue("presentes");
    expect(selected().product).toHaveValue("rose");
    expect(error).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
    act(() => root.unmount());
    container.remove();
  });
});
