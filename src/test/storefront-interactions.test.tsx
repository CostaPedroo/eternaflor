import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import type { AnchorHTMLAttributes, ComponentType, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicProduct } from "@/lib/catalog.functions";
import { ModalTestRouter } from "./modal-router";

const settingsRead = vi.hoisted(() => vi.fn());

vi.mock("@tanstack/react-router", async (original) => ({
  ...(await original<typeof import("@tanstack/react-router")>()),
  Link: ({
    to,
    hash,
    preload: _preload,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string; hash?: string; preload?: false }) => (
    <a {...props} href={`${to}${hash ? `#${hash}` : ""}`} />
  ),
}));
vi.mock("@/lib/catalog.functions", () => ({
  publicProductsQuery: { queryKey: ["public-products"], queryFn: () => [], staleTime: Infinity },
  publicCategoriesQuery: {
    queryKey: ["public-categories"],
    queryFn: () => [],
    staleTime: Infinity,
  },
}));
vi.mock("@/lib/site-settings", () => ({
  publicSiteSettingsQuery: {
    queryKey: ["site-settings"],
    queryFn: settingsRead,
    staleTime: 60_000,
    refetchOnMount: false,
    refetchInterval: 60_000,
    retry: false,
  },
}));
vi.mock("@/lib/gallery.functions", () => ({
  galleryPreviewQuery: {
    queryKey: ["public-gallery", "preview"],
    queryFn: () => ({ images: [], unavailable: false }),
    staleTime: 60_000,
    refetchOnMount: false,
  },
}));
vi.mock("@/lib/product-images", () => ({
  productImagesQuery: (id: string) => ({
    queryKey: ["photos", id],
    queryFn: () => [
      { id: "front", url: "/front.webp", alt: "De frente" },
      { id: "side", url: "/side.webp", alt: "De lado" },
    ],
  }),
}));

import { Route as HomeRoute } from "@/routes/index";
import { Route as CatalogRoute } from "@/routes/catalogo";
const HomePage = HomeRoute.options.component as ComponentType;
const CatalogPage = CatalogRoute.options.component as ComponentType;
const Home = () => (
  <ModalTestRouter>
    <HomePage />
  </ModalTestRouter>
);
const Catalog = () => (
  <ModalTestRouter>
    <CatalogPage />
  </ModalTestRouter>
);
const product: PublicProduct = {
  id: "rosa",
  name: "Bouquet Rosa",
  slug: "rosa",
  short_description: "Feito à mão",
  description: "Flores para guardar",
  price: 25,
  old_price: null,
  image: "/rosa.webp",
  featured: true,
  customizable: true,
  available: true,
  categories: [],
  sort_order: 0,
  created_at: "2026-10-07",
};
const clients: QueryClient[] = [];
beforeEach(() => {
  settingsRead.mockReset().mockResolvedValue(null);
  vi.spyOn(CatalogRoute, "useLoaderData").mockReturnValue([[], []]);
});
function page(children: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  clients.push(client);
  client.setQueryData(
    ["public-products"],
    [product, { ...product, id: "tulipa", name: "Tulipa", price: 10 }],
  );
  client.setQueryData(["public-categories"], []);
  client.setQueryData(["site-settings"], null);
  vi.spyOn(HomeRoute, "useLoaderData").mockReturnValue({
    products: [product, { ...product, id: "tulipa", name: "Tulipa", price: 10 }],
    settings: null,
    gallery: { images: [], unavailable: false },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
afterEach(() => {
  cleanup();
  clients.splice(0).forEach((client) => client.clear());
  vi.restoreAllMocks();
});

describe("Public pages with motion", () => {
  it("keeps the custom calendar date compatible with the actual WhatsApp form submission", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 22, 12));
    try {
      const openWhatsApp = vi.spyOn(window, "open").mockImplementation(() => null);
      render(page(<Home />));
      const name = screen.getByRole("textbox", { name: "Nome" });
      expect(name).toBeRequired();
      fireEvent.change(name, { target: { value: "Maria" } });
      fireEvent.click(screen.getByRole("button", { name: "Data em que precisa" }));
      const calendar = within(await screen.findByRole("dialog", { name: "Escolher data" }));
      await calendar.findByRole("grid", {}, { timeout: 5000 });
      fireEvent.click(calendar.getByRole("button", { name: /25 de outubro de 2026/i }));
      fireEvent.click(screen.getByRole("button", { name: "Criar bouquet personalizado" }));
      const url = new URL(String(openWhatsApp.mock.calls[0]?.[0]));
      expect(url.searchParams.get("text")).toContain("Data: 2026-10-25");
      expect(url.searchParams.get("text")).toContain("Nome: Maria");
      expect(openWhatsApp).toHaveBeenCalledWith(expect.any(String), "_blank");
      fireEvent.click(screen.getByRole("button", { name: "Data em que precisa" }));
      const reopened = within(await screen.findByRole("dialog", { name: "Escolher data" }));
      fireEvent.click(reopened.getByRole("button", { name: "Limpar" }));
      fireEvent.click(screen.getByRole("button", { name: "Criar bouquet personalizado" }));
      const cleared = new URL(String(openWhatsApp.mock.calls[1]?.[0]));
      expect(cleared.searchParams.get("text")).toContain("Data: —");
    } finally {
      vi.useRealTimers();
    }
  });

  it("synchronizes mobile sheet categories, sorting, price shortcuts and reset with the catalogue", async () => {
    const client = new QueryClient();
    clients.push(client);
    const boxes = { id: "caixas", name: "Caixas", slug: "caixas" };
    const custom = { id: "personalizados", name: "Personalizados", slug: "personalizados" };
    client.setQueryData(["public-categories"], [boxes, custom]);
    client.setQueryData(
      ["public-products"],
      [
        { ...product, id: "multi", categories: [boxes, custom], price: 30 },
        { ...product, id: "small", name: "Flor Rosa", categories: [custom], price: 10 },
        { ...product, id: "tulipa", name: "Tulipa", categories: [], price: 12 },
      ],
    );
    render(
      <QueryClientProvider client={client}>
        <Catalog />
      </QueryClientProvider>,
    );
    const ids = () =>
      [...document.querySelectorAll<HTMLElement>("article[data-product-id]")].map(
        (node) => node.dataset["productId"],
      );
    fireEvent.click(screen.getByRole("button", { name: "Caixas" }));
    const trigger = screen.getByRole("button", { name: "Filtrar" });
    trigger.focus();
    fireEvent.click(trigger);
    const panel = within(await screen.findByRole("dialog", { name: "Filtrar catálogo" }));
    expect(panel.getByRole("combobox", { name: "Categoria" })).toHaveValue("caixas");
    expect(panel.queryByRole("option", { name: "Até 15€" })).not.toBeInTheDocument();
    fireEvent.change(panel.getByRole("combobox", { name: "Categoria" }), {
      target: { value: "personalizados" },
    });
    fireEvent.change(panel.getByRole("combobox", { name: "Ordenar" }), {
      target: { value: "asc" },
    });
    expect(ids()).toEqual(["small", "multi"]);
    fireEvent.click(panel.getByRole("button", { name: "Aplicar filtros" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Personalizados" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("combobox", { name: "Ordenar" })).toHaveValue("asc");
    fireEvent.click(screen.getByRole("button", { name: "Até 15€" }));
    expect(ids()).toEqual(["small", "tulipa"]);
    fireEvent.click(trigger);
    const pricePanel = within(await screen.findByRole("dialog"));
    expect(pricePanel.getByRole("checkbox", { name: "Até 15€" })).toBeChecked();
    fireEvent.click(pricePanel.getByRole("checkbox", { name: "Até 15€" }));
    expect(ids()).toEqual(["small", "tulipa", "multi"]);
    fireEvent.click(pricePanel.getByRole("button", { name: "Fechar filtros" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "rosa" } });
    fireEvent.click(trigger);
    const resetPanel = within(await screen.findByRole("dialog"));
    fireEvent.click(resetPanel.getByRole("button", { name: "Limpar filtros" }));
    expect(resetPanel.getByRole("combobox", { name: "Categoria" })).toHaveValue("all");
    expect(resetPanel.getByRole("combobox", { name: "Ordenar" })).toHaveValue("rec");
    expect(resetPanel.getByRole("checkbox", { name: "Até 15€" })).not.toBeChecked();
    fireEvent.click(resetPanel.getByRole("button", { name: "Aplicar filtros" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("searchbox")).toHaveValue("");
    expect(ids()).toEqual(["multi", "small", "tulipa"]);
    expect(new Set(ids()).size).toBe(ids().length);
    expect(screen.getByText("3 produtos")).toBeInTheDocument();
  });

  it("locks mobile filter scrolling, restores focus, and closes by Escape, backdrop and desktop resize", async () => {
    let desktop = false;
    let resize: (() => void) | undefined;
    const matchMedia = window.matchMedia;
    vi.spyOn(window, "matchMedia").mockImplementation((query) =>
      query === "(min-width: 768px)"
        ? ({
            media: query,
            get matches() {
              return desktop;
            },
            addEventListener: (_: string, callback: () => void) => (resize = callback),
            removeEventListener: vi.fn(),
          } as unknown as MediaQueryList)
        : matchMedia(query),
    );
    render(page(<Catalog />));
    const trigger = screen.getByRole("button", { name: "Filtrar" });
    trigger.focus();
    fireEvent.click(trigger);
    let dialog = await screen.findByRole("dialog");
    await waitFor(() =>
      expect(within(dialog).getByRole("button", { name: "Fechar filtros" })).toHaveFocus(),
    );
    expect(document.body).toHaveAttribute("data-scroll-locked");
    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(document.body).not.toHaveAttribute("data-scroll-locked");
    fireEvent.click(trigger);
    dialog = await screen.findByRole("dialog");
    const overlay = document.querySelector(".storefront-overlay")!;
    fireEvent.pointerDown(overlay, { button: 0, pointerType: "mouse" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    fireEvent.click(trigger);
    await screen.findByRole("dialog");
    act(() => {
      desktop = true;
      resize?.();
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(document.body).not.toHaveAttribute("data-scroll-locked");
  });

  it("keeps multi-category cards unique through category, price, search and sort combinations", () => {
    const client = new QueryClient();
    clients.push(client);
    const boxes = { id: "caixas", name: "Caixas", slug: "caixas" };
    const custom = { id: "personalizados", name: "Personalizados", slug: "personalizados" };
    client.setQueryData(
      ["public-products"],
      [
        {
          ...product,
          id: "multi",
          name: "Caixa de Flores",
          categories: [boxes, custom],
          price: 30,
          sort_order: 0,
        },
        {
          ...product,
          id: "small",
          name: "Flor Rosa",
          categories: [custom],
          price: 10,
          sort_order: 1,
        },
        { ...product, id: "uncat", name: "Tulipa", categories: [], price: 12, sort_order: 2 },
      ],
    );
    client.setQueryData(["public-categories"], [boxes, custom]);
    render(
      <QueryClientProvider client={client}>
        <Catalog />
      </QueryClientProvider>,
    );
    const ids = () =>
      [...document.querySelectorAll<HTMLElement>("article[data-product-id]")].map(
        (node) => node.dataset["productId"],
      );
    expect(ids()).toEqual(["multi", "small", "uncat"]);
    fireEvent.click(screen.getByRole("button", { name: "Caixas" }));
    expect(ids()).toEqual(["multi"]);
    fireEvent.click(screen.getByRole("button", { name: "Personalizados" }));
    expect(ids()).toEqual(["multi", "small"]);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "asc" } });
    expect(ids()).toEqual(["small", "multi"]);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "caixa" } });
    expect(ids()).toEqual(["multi"]);
    fireEvent.click(screen.getByRole("button", { name: "Todos" }));
    expect(ids()).toEqual(["multi"]);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "" } });
    expect(ids()).toEqual(["small", "uncat", "multi"]);
    fireEvent.click(screen.getByRole("button", { name: "Até 15€" }));
    expect(ids()).toEqual(["small", "uncat"]);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "desc" } });
    expect(ids()).toEqual(["uncat", "small"]);
    expect(screen.getByText("2 produtos")).toBeInTheDocument();
    expect(new Set(ids()).size).toBe(ids().length);
  });
  it("shows a multi-category featured product only once on the homepage", () => {
    const client = new QueryClient();
    clients.push(client);
    const featured = {
      ...product,
      categories: [
        { id: "a", name: "Bouquets", slug: "bouquets" },
        { id: "b", name: "Personalizados", slug: "personalizados" },
      ],
    };
    client.setQueryData(["public-products"], [featured]);
    client.setQueryData(["site-settings"], null);
    vi.spyOn(HomeRoute, "useLoaderData").mockReturnValue({
      products: [featured],
      settings: null,
      gallery: { images: [], unavailable: false },
    });
    render(
      <QueryClientProvider client={client}>
        <Home />
      </QueryClientProvider>,
    );
    expect(document.querySelectorAll(`article[data-product-id="${product.id}"]`)).toHaveLength(1);
  });
  it("handles Todos → Bouquets → Até 15€ → Caixas and combined search/sort without stale actions", () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const client = new QueryClient();
    clients.push(client);
    client.setQueryData(
      ["public-products"],
      [
        { ...product, categories: [{ id: "bouquets", name: "Bouquets", slug: "bouquets" }] },
        {
          ...product,
          id: "tulipa",
          name: "Tulipa",
          price: 10,
          categories: [{ id: "bouquets", name: "Bouquets", slug: "bouquets" }],
          sort_order: 1,
        },
        {
          ...product,
          id: "caixa",
          name: "Caixa Jardim",
          price: 30,
          categories: [{ id: "caixas", name: "Caixas", slug: "caixas" }],
          sort_order: 2,
        },
        {
          ...product,
          id: "caixa-rosa",
          name: "Caixa Rosa",
          price: 12,
          categories: [{ id: "caixas", name: "Caixas", slug: "caixas" }],
          sort_order: 3,
        },
      ],
    );
    client.setQueryData(
      ["public-categories"],
      [
        { id: "bouquets", name: "Bouquets" },
        { id: "caixas", name: "Caixas" },
      ],
    );
    render(
      <QueryClientProvider client={client}>
        <Catalog />
      </QueryClientProvider>,
    );
    const ids = () =>
      [...document.querySelectorAll<HTMLElement>("article[data-product-id]")].map(
        (element) => element.dataset["productId"],
      );
    expect(ids()).toEqual(["rosa", "tulipa", "caixa", "caixa-rosa"]);
    fireEvent.click(screen.getByRole("button", { name: "Bouquets" }));
    expect(ids()).toEqual(["rosa", "tulipa"]);
    fireEvent.click(screen.getByRole("button", { name: "Até 15€" }));
    expect(ids()).toEqual(["tulipa", "caixa-rosa"]);
    fireEvent.click(screen.getByRole("button", { name: "Caixas" }));
    expect(ids()).toEqual(["caixa", "caixa-rosa"]);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "asc" } });
    expect(ids()).toEqual(["caixa-rosa", "caixa"]);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "rosa" } });
    expect(ids()).toEqual(["caixa-rosa"]);
    const order = screen.getByRole("link", { name: "Quero este" });
    expect(order.getAttribute("href")).toContain(encodeURIComponent("Caixa Rosa"));
    fireEvent.click(screen.getByRole("button", { name: "Bouquets" }));
    expect(ids()).toEqual(["rosa"]);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "sem resultados" } });
    expect(ids()).toEqual([]);
    expect(screen.queryByRole("link", { name: "Quero este" })).toBeNull();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "" } });
    expect(ids()).toEqual(["tulipa", "rosa"]);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "desc" } });
    expect(ids()).toEqual(["rosa", "tulipa"]);
    expect(errors).not.toHaveBeenCalled();
  });
  it("loads settings on the route, renders the final LCP URL, and hydrates into an empty cache without fetching it again", async () => {
    const settings = {
      id: 1,
      hero_image_url: "https://photos.test/hero.webp",
      custom_bouquet_image_url: null,
    };
    settingsRead.mockResolvedValue(settings);
    const serverClient = new QueryClient();
    const browserClient = new QueryClient();
    clients.push(serverClient, browserClient);
    serverClient.setQueryData(["public-products"], [product]);
    const load = HomeRoute.options.loader as (args: {
      context: { queryClient: QueryClient };
    }) => Promise<{ products: PublicProduct[]; settings: typeof settings | null }>;
    const initial = await load({ context: { queryClient: serverClient } });
    expect(initial.settings).toEqual(settings);
    vi.spyOn(HomeRoute, "useLoaderData").mockReturnValue(initial);
    const container = document.createElement("div");
    container.innerHTML = renderToString(
      <QueryClientProvider client={serverClient}>
        <Home />
      </QueryClientProvider>,
    );
    document.body.append(container);
    const image = container.querySelector<HTMLImageElement>('img[data-hero="image"]')!;
    expect(image).toHaveAttribute("src", settings.hero_image_url);
    expect(image).toHaveAttribute("loading", "eager");
    expect(image).toHaveAttribute("fetchPriority", "high");
    expect(
      container.querySelectorAll(`link[rel="preload"][href="${settings.hero_image_url}"]`),
    ).toHaveLength(1);
    const recoverable = vi.fn();
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    let root: ReturnType<typeof hydrateRoot>;
    await act(async () => {
      root = hydrateRoot(
        container,
        <QueryClientProvider client={browserClient}>
          <Home />
        </QueryClientProvider>,
        { onRecoverableError: recoverable },
      );
    });
    expect(settingsRead).toHaveBeenCalledTimes(1);
    expect(browserClient.getQueryData(["site-settings"])).toEqual(settings);
    expect(recoverable).not.toHaveBeenCalled();
    expect(errors).not.toHaveBeenCalled();
    act(() => root.unmount());
    container.remove();
  });

  it.each(["null", "failure"])(
    "keeps the homepage available when the settings read returns %s",
    async (result) => {
      if (result === "failure") settingsRead.mockRejectedValue(new Error("Offline"));
      const client = new QueryClient();
      clients.push(client);
      client.setQueryData(["public-products"], [product]);
      const load = HomeRoute.options.loader as (args: {
        context: { queryClient: QueryClient };
      }) => Promise<{ products: PublicProduct[]; settings: null }>;
      const initial = await load({ context: { queryClient: client } });
      expect(initial.settings).toBeNull();
      vi.spyOn(HomeRoute, "useLoaderData").mockReturnValue(initial);
      const html = renderToString(
        <QueryClientProvider client={client}>
          <Home />
        </QueryClientProvider>,
      );
      expect(html).toContain('src="/homepage-hero.webp"');
      expect(settingsRead).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    ["homepage", Home],
    ["catalogue", Catalog],
  ] as const)("hydrates the %s without errors", async (_name, Page) => {
    const content = page(<Page />);
    const container = document.createElement("div");
    container.innerHTML = renderToString(content);
    document.body.append(container);
    const recoverable = vi.fn();
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    let root: ReturnType<typeof hydrateRoot>;
    await act(async () => {
      root = hydrateRoot(container, content, { onRecoverableError: recoverable });
    });
    expect(recoverable).not.toHaveBeenCalled();
    expect(errors).not.toHaveBeenCalled();
    expect(container.querySelectorAll("article")).toHaveLength(2);
    act(() => root.unmount());
    container.remove();
  });

  it("keeps the homepage CTA, mobile navigation, custom form and FAQ usable", () => {
    render(page(<Home />));
    const menu = screen.getByRole("button", { name: "Menu" });
    expect(menu).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(menu);
    expect(menu).toHaveAttribute("aria-expanded", "true");
    const mobileNav = document.querySelector(".storefront-menu")!;
    fireEvent.click(within(mobileNav as HTMLElement).getByRole("link", { name: "Personalizados" }));
    expect(menu).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByLabelText("Nome")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Até 15€" }));
    expect(screen.getByRole("button", { name: "Até 15€" })).toHaveClass("bg-primary");
    const faq = screen.getByRole("button", { name: "Quanto tempo demora uma encomenda?" });
    fireEvent.click(faq);
    expect(faq).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(/Normalmente entre 3 e 7 dias/)).toBeVisible();
    fireEvent.click(faq);
    expect(faq).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("link", { name: "Personalizar" })).toHaveAttribute(
      "href",
      "#personalizados",
    );
  });

  it("preserves catalogue filtering and gallery changes with no console errors", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    render(page(<Catalog />));
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "rosa" } });
    expect(document.querySelectorAll("article")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Ver detalhes de Bouquet Rosa" }));
    const detail = within(await screen.findByRole("dialog"));
    const first = await detail.findByAltText("De frente");
    fireEvent.load(first);
    expect(first).toHaveAttribute("data-loaded", "true");
    fireEvent.click(detail.getByRole("button", { name: "Fotografia seguinte" }));
    const second = detail.getByAltText("De lado");
    expect(second).not.toHaveAttribute("data-loaded");
    fireEvent.load(second);
    expect(second).toHaveAttribute("data-loaded", "true");
    fireEvent.click(detail.getByRole("button", { name: "Fechar detalhes do produto" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Até 15€" }));
    expect(document.querySelectorAll("article")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Tulipa" })).toBeInTheDocument();
    expect(errors).not.toHaveBeenCalled();
  });
});
