import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PublicProduct } from "@/lib/catalog.functions";
import type { HistoryState } from "@tanstack/history";
import { GalleryGrid } from "@/components/site/GalleryGrid";
import { Route as CatalogRoute } from "@/routes/catalogo";

const product: PublicProduct = {
  id: "rose",
  name: "Bouquet Rosa",
  slug: "rose",
  price: 25,
  old_price: null,
  image: "/rose.webp",
  description: "Flores",
  short_description: "Flores",
  featured: true,
  customizable: true,
  available: true,
  categories: [],
  sort_order: 0,
  created_at: "2026-10-23",
};
const images = [
  { id: "one", url: "/one.webp", width: 1000, height: 1400 },
  { id: "two", url: "/two.webp", width: 1400, height: 1000 },
];
vi.mock("@/lib/catalog.functions", () => ({
  publicProductsQuery: { queryKey: ["public-products"], queryFn: () => [], staleTime: Infinity },
  publicCategoriesQuery: {
    queryKey: ["public-categories"],
    queryFn: () => [],
    staleTime: Infinity,
  },
}));
vi.mock("@/lib/product-images", () => ({
  productImagesQuery: (id: string) => ({ queryKey: ["photos", id], queryFn: () => [] }),
}));

const clients: QueryClient[] = [];
afterEach(() => {
  cleanup();
  clients.splice(0).forEach((client) => client.clear());
  vi.restoreAllMocks();
});

async function setup(path: string, initialEntries = ["/", path], persistedState?: HistoryState) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  clients.push(client);
  client.setQueryData(["public-products"], [product]);
  client.setQueryData(["public-categories"], []);
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
    component: () => <p>Home destination</p>,
  });
  const catalog = createRoute({
    getParentRoute: () => root,
    path: "/catalogo",
    loader: () => [[product], []],
    component: CatalogRoute.options.component!,
  });
  const gallery = createRoute({
    getParentRoute: () => root,
    path: "/galeria",
    component: () => <GalleryGrid images={images} />,
  });
  const history = createMemoryHistory({ initialEntries });
  if (persistedState) history.replace(path, persistedState);
  const router = createRouter({
    routeTree: root.addChildren([home, catalog, gallery]),
    history,
    scrollRestoration: true,
  });
  await router.load();
  const view = render(<RouterProvider router={router} />);
  return { router, history, view };
}
const cases = [
  {
    path: "/catalogo",
    param: "produto",
    id: "rose",
    trigger: "Ver detalhes de Bouquet Rosa",
    close: "Fechar detalhes do produto",
  },
  {
    path: "/galeria",
    param: "imagem",
    id: "one",
    trigger: "Ver encomenda personalizada 1",
    close: "Fechar galeria",
  },
] as const;
async function closed() {
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
}

describe("Router-backed product and gallery modals", () => {
  for (const modal of cases) {
    it(`${modal.path}: Back closes, Forward reopens, and Back without a modal navigates normally`, async () => {
      const { history, router } = await setup(`${modal.path}?keep=yes#section`);
      const trigger = screen.getByRole("button", { name: modal.trigger });
      trigger.focus();
      fireEvent.click(trigger);
      await screen.findByRole("dialog");
      expect(history.length).toBe(3);
      expect(new URL(history.location.href, "http://localhost").searchParams.get(modal.param)).toBe(
        modal.id,
      );
      expect(history.location.search).toContain("keep=yes");
      expect(history.location.hash).toBe("#section");
      const card = document.querySelector("article[data-product-id]");
      await act(async () => history.back());
      await closed();
      expect(history.location.href).toBe(`${modal.path}?keep=yes#section`);
      if (card) expect(document.querySelector("article[data-product-id]")).toBe(card);
      await waitFor(() => expect(document.body).not.toHaveAttribute("data-scroll-locked"));
      await act(async () => history.forward());
      await screen.findByRole("dialog");
      await act(async () => history.back());
      await closed();
      await act(async () => history.back());
      await screen.findByText("Home destination");
      expect(router.state.location.pathname).toBe("/");
    });

    it.each(["X", "Escape", "backdrop"])(
      `${modal.path}: %s consumes the modal entry over repeated cycles`,
      async (method) => {
        const { history, view } = await setup(modal.path);
        for (let cycle = 0; cycle < 3; cycle++) {
          const trigger = screen.getByRole("button", { name: modal.trigger });
          trigger.focus();
          fireEvent.click(trigger);
          const dialog = await screen.findByRole("dialog");
          expect(history.length).toBe(3);
          if (method === "X")
            fireEvent.click(within(dialog).getByRole("button", { name: modal.close }));
          else if (method === "Escape") fireEvent.keyDown(dialog, { key: "Escape" });
          else
            fireEvent.pointerDown(view.baseElement.querySelector(".storefront-overlay")!, {
              button: 0,
              pointerType: "mouse",
            });
          await closed();
          expect(history.location.href).toBe(modal.path);
          expect(history.location.state.__TSR_index).toBe(1);
        }
      },
    );

    it(`${modal.path}: a direct URL closes in place rather than navigating to the preceding page`, async () => {
      const { history } = await setup(`${modal.path}?${modal.param}=${modal.id}&keep=yes`);
      const dialog = await screen.findByRole("dialog");
      fireEvent.click(within(dialog).getByRole("button", { name: modal.close }));
      await closed();
      expect(history.location.href).toBe(`${modal.path}?keep=yes`);
      expect(history.location.state.__TSR_index).toBe(1);
      await act(async () => history.back());
      await screen.findByText("Home destination");
    });

    it(`${modal.path}: refresh reuses the known parent entry without adding another`, async () => {
      const original = await setup(modal.path);
      fireEvent.click(screen.getByRole("button", { name: modal.trigger }));
      await screen.findByRole("dialog");
      const { href, state } = original.history.location;
      original.view.unmount();
      const refreshed = await setup(href, ["/", modal.path, href], state);
      const dialog = await screen.findByRole("dialog");
      fireEvent.click(within(dialog).getByRole("button", { name: modal.close }));
      await closed();
      expect(refreshed.history.location.href).toBe(modal.path);
      expect(refreshed.history.location.state.__TSR_index).toBe(1);
      expect(refreshed.history.length).toBe(3);
    });

    it(`${modal.path}: Back also closes a directly linked modal`, async () => {
      const { history } = await setup(`${modal.path}?${modal.param}=${modal.id}`);
      await screen.findByRole("dialog");
      expect(history.length).toBe(3);
      await act(async () => history.back());
      await closed();
      expect(history.location.href).toBe(modal.path);
      await act(async () => history.back());
      await screen.findByText("Home destination");
    });
  }

  it("replaces gallery image changes so one Back closes the entire lightbox", async () => {
    const { history } = await setup("/galeria");
    fireEvent.click(screen.getByRole("button", { name: "Ver encomenda personalizada 1" }));
    const dialog = within(await screen.findByRole("dialog"));
    for (let i = 0; i < 5; i++)
      fireEvent.click(dialog.getByRole("button", { name: "Fotografia seguinte" }));
    expect(history.length).toBe(3);
    expect(history.location.search).toContain("imagem=two");
    await act(async () => history.back());
    await closed();
    expect(history.location.pathname).toBe("/galeria");
    await act(async () => history.forward());
    expect(within(await screen.findByRole("dialog")).getByText("2 / 2")).toBeInTheDocument();
  });

  it("preserves catalogue search/sort state and nodes across modal navigation", async () => {
    const { history } = await setup("/catalogo");
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "rosa" } });
    const sort = screen.getByLabelText("Ordenar");
    fireEvent.change(sort, { target: { value: "desc" } });
    const card = document.querySelector("article[data-product-id]");
    fireEvent.click(screen.getByRole("button", { name: "Ver detalhes de Bouquet Rosa" }));
    await screen.findByRole("dialog");
    await act(async () => history.back());
    await closed();
    expect(screen.getByRole("searchbox")).toHaveValue("rosa");
    expect(sort).toHaveValue("desc");
    expect(document.querySelector("article[data-product-id]")).toBe(card);
  });
});
