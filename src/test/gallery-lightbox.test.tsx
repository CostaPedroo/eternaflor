import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { GalleryGrid } from "@/components/site/GalleryGrid";

const images = [
  { id: "one", url: "/one.webp", width: 1000, height: 1400 },
  { id: "two", url: "/two.webp", width: 1400, height: 1000 },
  { id: "three", url: "/three.webp", width: 1000, height: 1000 },
];
afterEach(cleanup);
async function open(position = 1) {
  const trigger = screen.getByRole("button", { name: `Ver encomenda personalizada ${position}` });
  trigger.focus();
  fireEvent.click(trigger);
  const dialog = await screen.findByRole("dialog");
  return { trigger, dialog, detail: within(dialog) };
}
describe("Custom order gallery lightbox", () => {
  it("reserves natural image dimensions and lazy-loads without adding product UI", () => {
    const { container } = render(<GalleryGrid images={images} />);
    expect(screen.getAllByRole("img")).toHaveLength(3);
    for (const [index, photo] of screen.getAllByRole("img").entries()) {
      expect(photo).toHaveAttribute("width", String(images[index]!.width));
      expect(photo).toHaveAttribute("height", String(images[index]!.height));
      expect(photo).toHaveAttribute("loading", "lazy");
      expect((photo.closest("[data-image-reveal]") as HTMLElement).style.aspectRatio).toBe(
        `${images[index]!.width} / ${images[index]!.height}`,
      );
    }
    expect(container.querySelectorAll("[data-reveal='image']")).toHaveLength(3);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText(/Quero este/i)).not.toBeInTheDocument();
  });
  it("opens the selected image, locks scrolling, navigates cyclically and restores the actual opener", async () => {
    render(<GalleryGrid images={images} />);
    const { trigger, dialog, detail } = await open(2);
    await waitFor(() =>
      expect(detail.getByRole("button", { name: "Fechar galeria" })).toHaveFocus(),
    );
    expect(detail.getByText("2 / 3")).toBeInTheDocument();
    expect(detail.getByRole("img")).toHaveAttribute("src", "/two.webp");
    expect(document.body).toHaveAttribute("data-scroll-locked");
    fireEvent.keyDown(dialog, { key: "ArrowRight" });
    expect(detail.getByText("3 / 3")).toBeInTheDocument();
    fireEvent.click(detail.getByRole("button", { name: "Fotografia seguinte" }));
    expect(detail.getByText("1 / 3")).toBeInTheDocument();
    fireEvent.keyDown(dialog, { key: "ArrowLeft" });
    expect(detail.getByText("3 / 3")).toBeInTheDocument();
    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(document.body).not.toHaveAttribute("data-scroll-locked");
    fireEvent.click(trigger);
    const reopened = within(await screen.findByRole("dialog"));
    expect(reopened.getByText("2 / 3")).toBeInTheDocument();
    expect(reopened.getByRole("img")).toHaveAttribute("src", "/two.webp");
  });
  it("supports horizontal swipes without hijacking vertical gestures, and closes on the backdrop", async () => {
    const { baseElement } = render(<GalleryGrid images={images} />);
    const { detail } = await open();
    const frame = detail.getByRole("img").parentElement!;
    fireEvent.touchStart(frame, {
      touches: [{ clientX: 240, clientY: 100 }],
      changedTouches: [{ clientX: 240, clientY: 100 }],
    });
    fireEvent.touchEnd(frame, { changedTouches: [{ clientX: 80, clientY: 110 }] });
    expect(detail.getByText("2 / 3")).toBeInTheDocument();
    fireEvent.touchStart(frame, {
      touches: [{ clientX: 80, clientY: 100 }],
      changedTouches: [{ clientX: 80, clientY: 100 }],
    });
    fireEvent.touchEnd(frame, { changedTouches: [{ clientX: 100, clientY: 260 }] });
    expect(detail.getByText("2 / 3")).toBeInTheDocument();
    const overlay = baseElement.querySelector(".gallery-lightbox-overlay")!;
    fireEvent.pointerDown(overlay, { button: 0, pointerType: "mouse" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
  it("keeps a single photo functional without arrows and handles a broken photo gracefully", async () => {
    render(<GalleryGrid images={images.slice(0, 1)} />);
    const { detail } = await open();
    expect(detail.getByText("1 / 1")).toBeInTheDocument();
    expect(detail.queryByRole("button", { name: "Fotografia seguinte" })).not.toBeInTheDocument();
    fireEvent.error(detail.getByRole("img"));
    expect(detail.getByRole("status")).toHaveTextContent("Fotografia indisponível.");
    expect(detail.queryByRole("img")).not.toBeInTheDocument();
    fireEvent.click(detail.getByRole("button", { name: "Fechar galeria" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
  it("preserves the selected image by ID through reordering and closes if it is removed", async () => {
    const { rerender } = render(<GalleryGrid images={images} />);
    const { detail } = await open(2);
    const photo = detail.getByRole("img");
    rerender(<GalleryGrid images={[images[1]!, images[0]!, images[2]!]} />);
    expect(detail.getByRole("img")).toBe(photo);
    expect(detail.getByText("1 / 3")).toBeInTheDocument();
    rerender(<GalleryGrid images={images.slice(2)} />);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
  it("hydrates the same URLs, dimensions and DOM without a lightbox or hydration recovery", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    container.innerHTML = renderToString(<GalleryGrid images={images} />);
    const photos = Array.from(container.querySelectorAll("img"));
    const errors: unknown[] = [];
    let root: ReturnType<typeof hydrateRoot>;
    await act(async () => {
      root = hydrateRoot(container, <GalleryGrid images={images} />, {
        onRecoverableError: (error) => errors.push(error),
      });
    });
    expect(errors).toEqual([]);
    expect(Array.from(container.querySelectorAll("img"))).toEqual(photos);
    expect(container.querySelector("[role='dialog']")).toBeNull();
    await act(async () => root!.unmount());
    container.remove();
  });
});
