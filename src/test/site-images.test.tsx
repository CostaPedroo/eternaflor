import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FallbackImage } from "@/components/site/FallbackImage";
import { prepareSiteImage } from "@/lib/site-image";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Homepage image fallback", () => {
  let preloads: HTMLImageElement[];

  beforeEach(() => {
    preloads = [];
    vi.stubGlobal("Image", function () {
      const image = document.createElement("img");
      preloads.push(image);
      return image;
    });
  });

  it("uses the existing photo when no URL is configured", () => {
    render(<FallbackImage src={null} fallbackSrc="/existing.jpg" alt="Homepage" />);
    expect(screen.getByRole("img")).toHaveAttribute("src", "/existing.jpg");
    expect(preloads).toHaveLength(0);
  });

  it("keeps the existing photo while the new photo loads, then displays it", () => {
    render(
      <FallbackImage
        src="https://photos.test/new.webp"
        fallbackSrc="/existing.jpg"
        alt="Homepage"
      />,
    );
    expect(screen.getByRole("img")).toHaveAttribute("src", "/existing.jpg");
    act(() => fireEvent.load(preloads[0]!));
    expect(screen.getByRole("img")).toHaveAttribute("src", "https://photos.test/new.webp");
  });

  it("retains the fallback for a broken configured URL", () => {
    render(
      <FallbackImage
        src="https://photos.test/missing.webp"
        fallbackSrc="/existing.jpg"
        alt="Homepage"
      />,
    );
    act(() => fireEvent.error(preloads[0]!));
    expect(screen.getByRole("img")).toHaveAttribute("src", "/existing.jpg");
  });

  it("falls back if an image fails after preloading, and hides a failed fallback", () => {
    render(
      <FallbackImage
        src="https://photos.test/new.webp"
        fallbackSrc="/existing.jpg"
        alt="Homepage"
      />,
    );
    act(() => fireEvent.load(preloads[0]!));
    fireEvent.error(screen.getByRole("img"));
    expect(screen.getByRole("img")).toHaveAttribute("src", "/existing.jpg");
    fireEvent.error(screen.getByRole("img"));
    expect(screen.getByAltText("Homepage")).not.toBeVisible();
  });

  it("ignores an outdated preload and restores the fallback if settings become unavailable", () => {
    const { rerender } = render(
      <FallbackImage
        src="https://photos.test/old.webp"
        fallbackSrc="/existing.jpg"
        alt="Homepage"
      />,
    );
    rerender(
      <FallbackImage
        src="https://photos.test/new.webp"
        fallbackSrc="/existing.jpg"
        alt="Homepage"
      />,
    );
    act(() => fireEvent.load(preloads[0]!));
    expect(screen.getByRole("img")).toHaveAttribute("src", "/existing.jpg");
    act(() => fireEvent.load(preloads[1]!));
    expect(screen.getByRole("img")).toHaveAttribute("src", "https://photos.test/new.webp");
    rerender(<FallbackImage src={null} fallbackSrc="/existing.jpg" alt="Homepage" />);
    expect(screen.getByRole("img")).toHaveAttribute("src", "/existing.jpg");
  });
});

describe("Photo processing", () => {
  let canvas: HTMLCanvasElement;
  let close: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    canvas = document.createElement("canvas");
    close = vi.fn();
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn().mockResolvedValue({ width: 6000, height: 4000, close }),
    );
    vi.spyOn(document, "createElement").mockReturnValue(canvas);
    vi.spyOn(canvas, "getContext").mockReturnValue({
      drawImage: vi.fn(),
      fillRect: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
  });

  it("reduces a phone photo to 2000px and uploads the WebP result", async () => {
    const processed = new Blob(["webp"], { type: "image/webp" });
    vi.spyOn(canvas, "toBlob").mockImplementation((callback) => callback(processed));
    const result = await prepareSiteImage(
      new File(["original"], "phone.jpg", { type: "image/jpeg" }),
    );
    expect(result).toBe(processed);
    expect(canvas.width).toBe(2000);
    expect(canvas.height).toBe(1333);
    expect(canvas.toBlob).toHaveBeenCalledWith(expect.any(Function), "image/webp", 0.86);
    expect(close).toHaveBeenCalled();
  });

  it("uses JPEG when the browser cannot encode WebP", async () => {
    vi.spyOn(canvas, "toBlob").mockImplementation((callback, type) =>
      callback(new Blob(["photo"], { type: type === "image/webp" ? "image/png" : "image/jpeg" })),
    );
    const result = await prepareSiteImage(
      new File(["original"], "phone.jpg", { type: "image/jpeg" }),
    );
    expect(result.type).toBe("image/jpeg");
    expect(canvas.toBlob).toHaveBeenCalledTimes(2);
  });

  it("reduces dimensions further when the first result exceeds 2 MB", async () => {
    vi.spyOn(canvas, "toBlob")
      .mockImplementationOnce((callback) =>
        callback(new Blob([new Uint8Array(3 * 1024 * 1024)], { type: "image/webp" })),
      )
      .mockImplementationOnce((callback) => callback(new Blob(["small"], { type: "image/webp" })));
    await prepareSiteImage(new File(["original"], "phone.jpg", { type: "image/jpeg" }));
    expect(canvas.width).toBe(1600);
    expect(canvas.toBlob).toHaveBeenCalledTimes(2);
  });

  it("rejects processing failures instead of uploading the original", async () => {
    vi.spyOn(canvas, "toBlob").mockImplementation((callback) => callback(null));
    await expect(
      prepareSiteImage(new File(["original"], "phone.jpg", { type: "image/jpeg" })),
    ).rejects.toThrow("Não foi possível reduzir");
    expect(close).toHaveBeenCalled();
  });

  it("rejects non-image files before decoding", async () => {
    await expect(
      prepareSiteImage(new File(["text"], "file.txt", { type: "text/plain" })),
    ).rejects.toThrow("Escolhe uma fotografia");
    expect(createImageBitmap).not.toHaveBeenCalled();
  });
});
