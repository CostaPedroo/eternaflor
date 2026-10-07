import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import type { AnchorHTMLAttributes, ComponentType, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicProduct } from "@/lib/catalog.functions";

const settingsRead = vi.hoisted(() => vi.fn());

vi.mock("@tanstack/react-router", async (original) => ({
  ...(await original<typeof import("@tanstack/react-router")>()),
  Link: ({
    to,
    hash,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string; hash?: string }) => (
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
const Home = HomeRoute.options.component as ComponentType;
const Catalog = CatalogRoute.options.component as ComponentType;
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
  category_id: null,
  sort_order: 0,
  created_at: "2026-10-07",
};
const clients: QueryClient[] = [];
beforeEach(() => {
  settingsRead.mockReset().mockResolvedValue(null);
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
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
afterEach(() => {
  cleanup();
  clients.splice(0).forEach((client) => client.clear());
  vi.restoreAllMocks();
});

describe("Public pages with motion", () => {
  it("handles Todos → Bouquets → Até 15€ → Caixas and combined search/sort without stale actions", () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const client = new QueryClient();
    clients.push(client);
    client.setQueryData(
      ["public-products"],
      [
        { ...product, category_id: "bouquets" },
        {
          ...product,
          id: "tulipa",
          name: "Tulipa",
          price: 10,
          category_id: "bouquets",
          sort_order: 1,
        },
        {
          ...product,
          id: "caixa",
          name: "Caixa Jardim",
          price: 30,
          category_id: "caixas",
          sort_order: 2,
        },
        {
          ...product,
          id: "caixa-rosa",
          name: "Caixa Rosa",
          price: 12,
          category_id: "caixas",
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
    expect(screen.getByRole("link", { name: "Criar bouquet personalizado" })).toHaveAttribute(
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
