import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HeroImage } from "@/components/site/HeroImage";
import { heroImagePreloads, mobileHeroImageSources } from "@/lib/responsive-images";

const configured = "https://photos.test/hero.webp";
const fallback = "/homepage-hero.webp";
const alt = "Bouquet feito à mão";
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
function photo(src: string | null = configured) {
  return <HeroImage src={src} fallbackSrc={fallback} alt={alt} />;
}
function loaded(image: HTMLElement, decode: () => Promise<void> = () => Promise.resolve()) {
  Object.defineProperty(image, "naturalWidth", { configurable: true, value: 1080 });
  Object.defineProperty(image, "decode", { configurable: true, value: decode });
  fireEvent.load(image);
}

describe("LCP hero photo", () => {
  it("matches the mobile preload to its picture source while retaining the original desktop URL and priority", () => {
    vi.stubEnv("VITE_EXT_SUPABASE_URL", "https://shop.supabase.co");
    const src =
      "https://shop.supabase.co/storage/v1/object/public/product-images/site/hero/photo.webp";
    const html = renderToString(photo(src));
    expect(html).toContain("<picture>");
    expect(html).toContain(`src="${src}"`);
    expect(html).toContain('loading="eager"');
    expect(html).toContain('fetchPriority="high"');
    expect(html).not.toContain('rel="preload"');
    const links = heroImagePreloads(src);
    expect(links[0]).toMatchObject({
      imageSrcSet: mobileHeroImageSources(src),
      imageSizes: "calc(100vw - 3rem)",
      media: "(max-width: 767px)",
      fetchPriority: "high",
    });
    expect(links[1]).toMatchObject({ href: src, media: "(min-width: 768px)" });
    expect(heroImagePreloads(fallback)).toEqual([]);
  });

  it("retries the original after a mobile variant fails without remounting or replaying the hero", async () => {
    vi.stubEnv("VITE_EXT_SUPABASE_URL", "https://shop.supabase.co");
    const src =
      "https://shop.supabase.co/storage/v1/object/public/product-images/site/hero/photo.webp";
    const { container } = render(photo(src));
    const image = screen.getByAltText(alt) as HTMLImageElement;
    Object.defineProperty(image, "currentSrc", {
      configurable: true,
      value:
        src.replace("/object/public/", "/render/image/public/") +
        "?width=1080&quality=75&resize=contain",
    });
    fireEvent.error(image);
    expect(container.querySelector("source")).toBeNull();
    expect(screen.getByAltText(alt)).toBe(image);
    expect(image).toHaveAttribute("src", src);
    await act(async () => loaded(image));
    expect(image.style.visibility).toBe("");
    expect(image).toHaveAttribute("data-image-state", "ready");
    expect(image).not.toHaveAttribute("data-reveal");
    Object.defineProperty(image, "currentSrc", { configurable: true, value: src });
    fireEvent.error(image);
    expect(screen.getByAltText(alt)).toHaveAttribute("src", fallback);
  });

  it("renders the configured URL directly in SSR with high priority and no client preload dependency", () => {
    const html = renderToString(photo());
    expect(html).toContain(`src="${configured}"`);
    expect(html).toContain('loading="eager"');
    expect(html).toContain('fetchPriority="high"');
    expect(html).toContain("color:transparent");
    expect(html).not.toContain('data-image-state="loading"');
    expect(html).not.toContain(fallback);
    expect((html.match(/rel="preload"/g) ?? []).length).toBeLessThanOrEqual(1);
  });

  it("hydrates the same URL without errors and waits for decoding before the loading reveal", async () => {
    const container = document.createElement("div");
    container.innerHTML = renderToString(photo());
    document.body.append(container);
    const recoverable = vi.fn();
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    let root: ReturnType<typeof hydrateRoot>;
    await act(async () => {
      root = hydrateRoot(container, photo(), { onRecoverableError: recoverable });
    });
    const image = screen.getByAltText(alt);
    expect(image).toHaveAttribute("src", configured);
    expect(image).toHaveAttribute("data-image-state", "loading");
    let decode!: () => void;
    const decoding = new Promise<void>((resolve) => {
      decode = resolve;
    });
    loaded(image, () => decoding);
    expect(image).not.toHaveAttribute("data-image-state", "ready");
    await act(async () => {
      decode();
      await decoding;
    });
    expect(image).toHaveAttribute("data-image-state", "ready");
    expect(errors).not.toHaveBeenCalled();
    expect(recoverable).not.toHaveBeenCalled();
    act(() => root.unmount());
    container.remove();
  });

  it("uses the local default for a null URL, falls back on failure, and hides a failed default", async () => {
    expect(renderToString(photo(null))).toContain(`src="${fallback}"`);
    render(photo());
    const remote = screen.getByAltText(alt);
    fireEvent.error(remote);
    expect(remote.style.visibility).toBe("hidden");
    const defaultImage = screen.getByAltText(alt);
    expect(defaultImage).toHaveAttribute("src", fallback);
    loaded(defaultImage);
    await waitFor(() => expect(defaultImage).toHaveAttribute("data-image-state", "ready"));
    fireEvent.error(defaultImage);
    expect(screen.getByAltText(alt)).not.toBeVisible();
  });

  it("does not re-hide an already loaded SSR image and ignores decoding an outdated URL", async () => {
    vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(true);
    vi.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockReturnValue(1080);
    const view = render(photo());
    await waitFor(() =>
      expect(screen.getByAltText(alt)).toHaveAttribute("data-image-state", "cached"),
    );
    const first = screen.getByAltText(alt);
    let decode!: () => void;
    const pending = new Promise<void>((resolve) => {
      decode = resolve;
    });
    loaded(first, () => pending);
    view.rerender(photo("https://photos.test/updated.webp"));
    await act(async () => {
      decode();
      await pending;
    });
    expect(screen.getByAltText(alt)).toHaveAttribute("src", "https://photos.test/updated.webp");
    expect(screen.getByAltText(alt)).toHaveAttribute("data-image-state", "cached");
  });
});
