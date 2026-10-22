import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ResponsiveProductImage } from "@/components/site/ResponsiveProductImage";
import { mobileProductImageSources } from "@/lib/responsive-images";

const origin = "https://shop.supabase.co";
const original = `${origin}/storage/v1/object/public/product-images/product/front.webp`;
const resized = `${origin}/storage/v1/render/image/public/product-images/product/front.webp?width=640&quality=85&resize=contain`;
const image = (src = original) => (
  <ResponsiveProductImage src={src} alt="Bouquet" className="h-full w-full object-cover" />
);

beforeEach(() => vi.stubEnv("VITE_EXT_SUPABASE_URL", origin));
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("Responsive public product images", () => {
  it("keeps the original desktop source, lazy loading and composition with mobile-only width candidates", () => {
    const html = renderToString(image());
    expect(html).toContain(`src="${original}"`);
    expect(html).toContain('media="(max-width: 767px)"');
    expect(html).toContain('sizes="calc((100vw - 4rem) / 2)"');
    expect(html).toContain('loading="lazy"');
    expect(html).toContain("object-cover");
    for (const width of [320, 480, 640, 960]) expect(html).toContain(`${width}w`);
    expect(html).toContain("resize=contain");
  });

  it("does not rewrite legacy URLs, other projects, private buckets or non-photo files", () => {
    for (const src of [
      "/legacy.jpg",
      "https://other.test/photo.webp",
      "https://other.supabase.co/storage/v1/object/public/product-images/photo.webp",
      `${origin}/storage/v1/object/public/private/photo.webp`,
      `${origin}/storage/v1/object/public/product-images/icon.svg`,
    ]) {
      expect(mobileProductImageSources(src)).toBeNull();
    }
    vi.stubEnv("VITE_EXT_SUPABASE_URL", "");
    expect(mobileProductImageSources(original)).toBeNull();
  });

  it("retries the original if a transformation fails, then retains the existing placeholder behavior", () => {
    const { container } = render(image());
    const photo = screen.getByAltText("Bouquet") as HTMLImageElement;
    Object.defineProperty(photo, "currentSrc", { configurable: true, value: resized });
    fireEvent.error(photo);
    expect(photo.style.visibility).toBe("hidden");
    expect(container.querySelector("source")).toBeNull();
    expect(photo).toHaveAttribute("src", original);
    fireEvent.load(photo);
    expect(photo.style.visibility).toBe("");
    Object.defineProperty(photo, "currentSrc", { configurable: true, value: original });
    fireEvent.error(photo);
    expect(photo.style.display).toBe("none");
  });

  it("does not carry a failed image into an updated product photo", () => {
    const { rerender } = render(image());
    const previous = screen.getByAltText("Bouquet");
    Object.defineProperty(previous, "currentSrc", { value: original });
    fireEvent.error(previous);
    rerender(image(original.replace("front.webp", "new.webp")));
    const next = screen.getByAltText("Bouquet");
    expect(next).not.toBe(previous);
    expect(next.style.display).toBe("");
    expect(document.querySelector("source")).not.toBeNull();
  });

  it("hydrates the same picture and original image without changing the source or emitting errors", async () => {
    const container = document.createElement("div");
    container.innerHTML = renderToString(image());
    document.body.append(container);
    const before = container.querySelector("img");
    const recoverable = vi.fn();
    const errors = vi.spyOn(console, "error");
    let root: ReturnType<typeof hydrateRoot>;
    await act(async () => {
      root = hydrateRoot(container, image(), { onRecoverableError: recoverable });
    });
    expect(container.querySelector("img")).toBe(before);
    expect(before).toHaveAttribute("src", original);
    expect(recoverable).not.toHaveBeenCalled();
    expect(errors).not.toHaveBeenCalled();
    act(() => root.unmount());
    container.remove();
  });
});
