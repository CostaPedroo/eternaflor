import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProductCard } from "@/components/site/ProductCard";
import type { PublicProduct } from "@/lib/catalog.functions";
import { productOrderMessage, wa } from "@/lib/config";

const mocks = vi.hoisted(() => ({ images: vi.fn() }));
vi.mock("@/lib/product-images", () => ({
  productImagesQuery: (id: string) => ({
    queryKey: ["public-product-images", id],
    queryFn: () => mocks.images(id),
  }),
}));

const product: PublicProduct = {
  id: "product-1",
  name: "Bouquet Rosa",
  slug: "bouquet-rosa",
  short_description: "Flores artesanais",
  description: "Um bouquet feito à mão.\nEscolhe as tuas cores.",
  price: 25,
  old_price: 30,
  image: "https://photos.test/main.webp",
  featured: true,
  customizable: true,
  available: true,
  category_id: null,
  sort_order: 0,
  created_at: "2026-10-07",
};
const photos = [
  { id: "photo-1", url: "https://photos.test/one.webp", alt: "Bouquet de frente" },
  { id: "photo-2", url: "https://photos.test/two.webp", alt: "Bouquet de lado" },
];
let queryClient: QueryClient;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.images.mockResolvedValue(photos);
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
afterEach(() => {
  cleanup();
  queryClient.clear();
});

function renderCard(p = product) {
  render(
    <QueryClientProvider client={queryClient}>
      <ProductCard p={p} />
    </QueryClientProvider>,
  );
}
async function openCard() {
  fireEvent.click(screen.getByRole("button", { name: `Ver detalhes de ${product.name}` }));
  const dialog = await screen.findByRole("dialog");
  await waitFor(() =>
    expect(within(dialog).queryByText("A carregar fotografias…")).not.toBeInTheDocument(),
  );
  return within(dialog);
}

describe("Storefront product gallery", () => {
  it("preserves the selected photo and DOM through image-list refresh/reordering", async () => {
    renderCard();
    const detail = await openCard();
    fireEvent.click(detail.getByRole("button", { name: "Fotografia seguinte" }));
    const selected = detail.getByAltText("Bouquet de lado");
    await act(async () => {
      queryClient.setQueryData(["public-product-images", product.id], [photos[1], photos[0]]);
    });
    expect(detail.getByAltText("Bouquet de lado")).toBe(selected);
    await waitFor(() =>
      expect(
        detail.getByRole("button", { name: "Ver fotografia 1 de Bouquet Rosa" }),
      ).toHaveAttribute("aria-pressed", "true"),
    );
    await act(async () => {
      queryClient.setQueryData(["public-product-images", product.id], [photos[0]]);
    });
    expect(await detail.findByAltText("Bouquet de frente")).toBeInTheDocument();
  });
  it("keeps cards to one main image and fetches no gallery until opened", () => {
    renderCard();
    expect(screen.getAllByRole("img")).toHaveLength(1);
    expect(screen.getByRole("img")).toHaveAttribute("src", product.image);
    expect(mocks.images).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Quero este" })).toHaveAttribute(
      "href",
      wa(productOrderMessage(product)),
    );
  });

  it("displays both photos, arrows, active thumbnails, product details and the unchanged CTA", async () => {
    renderCard();
    const detail = await openCard();
    expect(mocks.images).toHaveBeenCalledWith(product.id);
    expect(detail.getByAltText("Bouquet de frente")).toHaveAttribute("src", photos[0]!.url);
    expect(
      detail.getByRole("button", { name: "Ver fotografia 1 de Bouquet Rosa" }),
    ).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(detail.getByRole("button", { name: "Fotografia seguinte" }));
    expect(detail.getByAltText("Bouquet de lado")).toHaveAttribute("src", photos[1]!.url);
    expect(
      detail.getByRole("button", { name: "Ver fotografia 2 de Bouquet Rosa" }),
    ).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(detail.getByRole("button", { name: "Fotografia seguinte" }));
    expect(detail.getByAltText("Bouquet de frente")).toBeInTheDocument();
    fireEvent.click(detail.getByRole("button", { name: "Fotografia anterior" }));
    expect(detail.getByAltText("Bouquet de lado")).toBeInTheDocument();
    fireEvent.click(detail.getByRole("button", { name: "Ver fotografia 1 de Bouquet Rosa" }));
    expect(detail.getByAltText("Bouquet de frente")).toBeInTheDocument();
    expect(detail.getByRole("heading", { name: product.name })).toBeInTheDocument();
    expect(detail.getByText("25€")).toBeInTheDocument();
    expect(detail.getByText("30€").tagName).toBe("S");
    expect(detail.getByText(/Um bouquet feito à mão/)).toBeInTheDocument();
    const cta = detail.getByRole("link", { name: "Quero este" });
    expect(cta).toHaveAttribute("href", wa(productOrderMessage(product)));
    expect(cta).toHaveAttribute("target", "_blank");
    expect(cta).toHaveAttribute("rel", "noreferrer");
  });

  it("opens from the name and shows one photo without arrows or thumbnails", async () => {
    mocks.images.mockResolvedValue(photos.slice(0, 1));
    renderCard();
    fireEvent.click(screen.getByRole("button", { name: product.name }));
    const dialog = within(await screen.findByRole("dialog"));
    expect(await dialog.findByAltText("Bouquet de frente")).toHaveAttribute("src", photos[0]!.url);
    expect(dialog.queryByRole("button", { name: "Fotografia seguinte" })).not.toBeInTheDocument();
    expect(dialog.queryByRole("button", { name: /Ver fotografia/ })).not.toBeInTheDocument();
  });

  it("supports horizontal swipes and keyboard arrows while preserving vertical scrolling", async () => {
    renderCard();
    const detail = await openCard();
    const gallery = detail.getByLabelText("Galeria: usa as setas para mudar de fotografia");
    fireEvent.touchStart(gallery, {
      touches: [{ clientX: 240, clientY: 100 }],
      changedTouches: [{ clientX: 240, clientY: 100 }],
    });
    fireEvent.touchEnd(gallery, { changedTouches: [{ clientX: 80, clientY: 110 }] });
    expect(detail.getByAltText("Bouquet de lado")).toBeInTheDocument();
    fireEvent.touchStart(gallery, {
      touches: [{ clientX: 80, clientY: 100 }],
      changedTouches: [{ clientX: 80, clientY: 100 }],
    });
    fireEvent.touchEnd(gallery, { changedTouches: [{ clientX: 100, clientY: 250 }] });
    expect(detail.getByAltText("Bouquet de lado")).toBeInTheDocument();
    fireEvent.keyDown(gallery, { key: "ArrowLeft" });
    expect(detail.getByAltText("Bouquet de frente")).toBeInTheDocument();
  });

  it("uses main_image if there are no product_images", async () => {
    mocks.images.mockResolvedValue([]);
    renderCard();
    const detail = await openCard();
    expect(detail.getByRole("img")).toHaveAttribute("src", product.image);
    expect(detail.queryByRole("button", { name: "Fotografia seguinte" })).not.toBeInTheDocument();
  });

  it("keeps main_image on a fetch failure and lets the visitor retry", async () => {
    mocks.images.mockRejectedValueOnce(new Error("Offline"));
    renderCard();
    const detail = await openCard();
    expect(detail.getByRole("img")).toHaveAttribute("src", product.image);
    fireEvent.click(detail.getByRole("button", { name: "Tentar novamente" }));
    expect(await detail.findByAltText("Bouquet de frente")).toBeInTheDocument();
  });

  it("falls back to main_image for a broken gallery photo, then to the existing brand placeholder", async () => {
    renderCard();
    const detail = await openCard();
    fireEvent.error(detail.getByAltText("Bouquet de frente"));
    expect(detail.getByAltText("Bouquet de frente")).toHaveAttribute("src", product.image);
    fireEvent.error(detail.getByAltText("Bouquet de frente"));
    expect(detail.queryByAltText("Bouquet de frente")).not.toBeInTheDocument();
    expect(detail.getAllByText("Eterna Flor").length).toBeGreaterThan(0);
  });

  it("preserves unavailable products and closes the detail view", async () => {
    renderCard({ ...product, available: false });
    const detail = await openCard();
    expect(detail.queryByRole("link", { name: "Quero este" })).not.toBeInTheDocument();
    expect(detail.getByText("Indisponível")).toHaveAttribute("aria-disabled");
    fireEvent.click(detail.getByRole("button", { name: "Fechar detalhes do produto" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
