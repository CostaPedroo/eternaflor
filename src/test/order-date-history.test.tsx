import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import type { HistoryState } from "@tanstack/history";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Route as HomeRoute } from "@/routes/index";

vi.mock("@/lib/catalog.functions", () => ({
  publicProductsQuery: { queryKey: ["public-products"], queryFn: () => [], staleTime: Infinity },
}));
vi.mock("@/lib/site-settings", () => ({
  publicSiteSettingsQuery: {
    queryKey: ["site-settings"],
    queryFn: () => null,
    staleTime: Infinity,
  },
}));
vi.mock("@/lib/gallery.functions", () => ({
  galleryPreviewQuery: {
    queryKey: ["public-gallery", "preview"],
    queryFn: () => ({ images: [], unavailable: false }),
    staleTime: Infinity,
  },
}));
vi.mock("@/lib/product-images", () => ({
  productImagesQuery: (id: string) => ({ queryKey: ["photos", id], queryFn: () => [] }),
}));

let mobile = true;
const mediaListeners = new Set<() => void>();
const clients: QueryClient[] = [];
beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  });
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 23, 12));
  mobile = true;
  mediaListeners.clear();
  vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
    get matches() {
      return query === "(max-width: 767px)" && mobile;
    },
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: (_type: string, callback: unknown) => {
      if (query === "(max-width: 767px)") mediaListeners.add(callback as () => void);
    },
    removeEventListener: (_type: string, callback: unknown) => {
      mediaListeners.delete(callback as () => void);
    },
    dispatchEvent: () => false,
  }));
});
afterEach(() => {
  cleanup();
  clients.splice(0).forEach((client) => client.clear());
  vi.useRealTimers();
  vi.restoreAllMocks();
});

async function setup(
  url = "/#personalizados",
  entries = ["/previous", url],
  persistedState?: HistoryState,
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  clients.push(client);
  const initial = { products: [], settings: null, gallery: { images: [], unavailable: false } };
  client.setQueryData(["public-products"], initial.products);
  client.setQueryData(["site-settings"], initial.settings);
  client.setQueryData(["public-gallery", "preview"], initial.gallery);
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
    loader: () => initial,
    component: HomeRoute.options.component!,
  });
  const previous = createRoute({
    getParentRoute: () => root,
    path: "/previous",
    component: () => <p>Previous page</p>,
  });
  const history = createMemoryHistory({ initialEntries: entries });
  if (persistedState) history.replace(url, persistedState);
  const router = createRouter({
    routeTree: root.addChildren([home, previous]),
    history,
    scrollRestoration: true,
  });
  await router.load();
  const view = render(<RouterProvider router={router} />);
  return { history, view };
}
const trigger = () => screen.getByRole("button", { name: "Data em que precisa" });
const dateValue = () => (document.querySelector('input[name="data"]') as HTMLInputElement).value;
async function open() {
  act(() => trigger().focus());
  fireEvent.click(trigger());
  const panel = within(await screen.findByRole("dialog", { name: "Escolher data" }));
  await panel.findByRole("grid", {}, { timeout: 5000 });
  return panel;
}
async function closed() {
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  await waitFor(() => expect(document.body).not.toHaveAttribute("data-scroll-locked"));
}

describe("Mobile order calendar history", () => {
  it("Back preserves the selected date and actual form values; Forward reopens and normal Back still navigates", async () => {
    const { history } = await setup();
    const name = screen.getByRole("textbox", { name: "Nome" });
    fireEvent.change(name, { target: { value: "Maria" } });
    const details = screen.getByRole("textbox", { name: "Detalhes adicionais" });
    fireEvent.change(details, { target: { value: "Flores rosa" } });
    const extraFields = [
      [screen.getByRole("textbox", { name: "Ocasião" }), "Aniversário"],
      [screen.getByRole("textbox", { name: "Cores preferidas" }), "Rosa e creme"],
      [screen.getByRole("textbox", { name: "Flores preferidas" }), "Tulipas"],
    ] as const;
    extraFields.forEach(([input, value]) => fireEvent.change(input, { target: { value } }));
    const budget = screen.getByRole("button", { name: "25€–40€" });
    fireEvent.click(budget);
    const form = name.closest("form");
    let panel = await open();
    fireEvent.click(panel.getByRole("button", { name: /25 de outubro de 2026/i }));
    fireEvent.click(panel.getByRole("button", { name: "Confirmar data" }));
    await closed();
    expect(dateValue()).toBe("2026-10-25");
    panel = await open();
    fireEvent.click(panel.getByRole("button", { name: /26 de outubro de 2026/i }));
    await act(async () => history.back());
    await closed();
    expect(history.location.href).toBe("/#personalizados");
    expect(dateValue()).toBe("2026-10-25");
    expect(name).toHaveValue("Maria");
    expect(details).toHaveValue("Flores rosa");
    extraFields.forEach(([input, value]) => expect(input).toHaveValue(value));
    expect(budget).toHaveClass("bg-primary");
    expect(name.closest("form")).toBe(form);
    await waitFor(() => expect(trigger()).toHaveFocus());
    await act(async () => history.forward());
    panel = within(await screen.findByRole("dialog", { name: "Escolher data" }));
    await panel.findByRole("grid");
    expect(
      panel.getByRole("button", { name: /25 de outubro de 2026/i }).closest("td"),
    ).toHaveAttribute("data-selected");
    fireEvent.click(panel.getByRole("button", { name: "Fechar calendário" }));
    await closed();
    expect(history.length).toBe(3);
    await act(async () => history.back());
    await screen.findByText("Previous page");
  }, 15000);

  it.each(["X", "Escape", "backdrop", "confirm", "clear"])(
    "%s closes over repeated cycles without accumulating entries",
    async (method) => {
      const { history, view } = await setup();
      for (let cycle = 0; cycle < 3; cycle++) {
        const panel = await open();
        expect(history.length).toBe(3);
        expect(history.location.search).toBe("?calendario=data");
        fireEvent.click(
          panel.getByRole("button", { name: new RegExp(`${25 + cycle} de outubro de 2026`, "i") }),
        );
        if (method === "X")
          fireEvent.click(panel.getByRole("button", { name: "Fechar calendário" }));
        else if (method === "Escape")
          fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
        else if (method === "backdrop")
          fireEvent.pointerDown(view.baseElement.querySelector(".storefront-overlay")!, {
            button: 0,
            pointerType: "mouse",
          });
        else
          fireEvent.click(
            panel.getByRole("button", { name: method === "confirm" ? "Confirmar data" : "Limpar" }),
          );
        await closed();
        expect(history.location.href).toBe("/#personalizados");
        expect(history.location.state.__TSR_index).toBe(1);
        expect(dateValue()).toBe(method === "confirm" ? `2026-10-${25 + cycle}` : "");
      }
    },
  );

  it("month/year changes never create history entries", async () => {
    const { history } = await setup();
    const panel = await open();
    const href = history.location.href;
    for (let i = 0; i < 4; i++)
      fireEvent.click(panel.getByRole("button", { name: "Ir para o próximo mês" }));
    expect(panel.getByText("Fevereiro 2027")).toBeInTheDocument();
    expect(history.location.href).toBe(href);
    expect(history.length).toBe(3);
    await act(async () => history.back());
    await closed();
  });

  it("direct access and refresh reuse a safe underlying page entry", async () => {
    const url = "/?calendario=data#personalizados";
    const original = await setup(url);
    await screen.findByRole("dialog", { name: "Escolher data" });
    expect(original.history.length).toBe(3);
    const state = original.history.location.state;
    original.view.unmount();
    const refreshed = await setup(url, ["/previous", "/#personalizados", url], state);
    const panel = within(await screen.findByRole("dialog", { name: "Escolher data" }));
    await panel.findByRole("grid", {}, { timeout: 5000 });
    expect(refreshed.history.length).toBe(3);
    fireEvent.click(panel.getByRole("button", { name: "Fechar calendário" }));
    await closed();
    expect(refreshed.history.location.href).toBe("/#personalizados");
    await act(async () => refreshed.history.forward());
    await screen.findByRole("dialog", { name: "Escolher data" });
    await act(async () => refreshed.history.back());
    await closed();
    await act(async () => refreshed.history.back());
    await screen.findByText("Previous page");
  });

  it("desktop/tablet popovers do not change the URL or history", async () => {
    mobile = false;
    const { history } = await setup();
    const panel = await open();
    expect(history.length).toBe(2);
    expect(history.location.href).toBe("/#personalizados");
    expect(panel.queryByRole("button", { name: "Confirmar data" })).not.toBeInTheDocument();
    fireEvent.click(panel.getByRole("button", { name: /25 de outubro de 2026/i }));
    await closed();
    expect(dateValue()).toBe("2026-10-25");
    expect(history.length).toBe(2);
  });

  it("crossing the breakpoint dismisses the sheet without reopening it on mobile", async () => {
    const { history } = await setup();
    await open();
    await act(async () => {
      mobile = false;
      mediaListeners.forEach((callback) => callback());
    });
    await closed();
    await act(async () => {
      mobile = true;
      mediaListeners.forEach((callback) => callback());
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(history.location.href).toBe("/#personalizados");
  });
});
