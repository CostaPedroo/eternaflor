import { act, fireEvent } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import type { ComponentType, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StorefrontMotion } from "@/components/site/StorefrontMotion";
import { ImageReveal } from "@/components/site/ImageReveal";
import { HeroImage } from "@/components/site/HeroImage";
import { normalizeNetlifyHead } from "@/lib/normalize-netlify-head";

vi.mock("@tanstack/react-router", async (original) => ({
  ...(await original<typeof import("@tanstack/react-router")>()),
  HeadContent: () => (
    <>
      <meta charSet="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Eterna Flor</title>
      <script type="application/ld+json">{'{"@type":"ItemList"}'}</script>
    </>
  ),
  Scripts: () => null,
}));

import { Route } from "@/routes/__root";
const Shell = (
  Route.options as typeof Route.options & { shellComponent: ComponentType<{ children: ReactNode }> }
).shellComponent;
const remote = "https://photos.test/site/hero/managed.webp";
// The deployed response inserts this newline + comment immediately after charset.
const netlifyAnnotation =
  "\n<!-- This site is hosted on Netlify. Anyone can build and deploy a site\n     like this one for free: https://netlify.new/\n     Netlify hosting facts for this site: static/SSR served via Netlify Edge. -->";
function page() {
  return (
    <Shell>
      <StorefrontMotion>
        <ImageReveal trigger="mount">
          <HeroImage src={remote} fallbackSrc="/homepage-hero.webp" alt="Hero" />
        </ImageReveal>
      </StorefrontMotion>
    </Shell>
  );
}
let root: ReturnType<typeof hydrateRoot> | undefined;
afterEach(() => {
  if (root) act(() => root!.unmount());
  root = undefined;
  document.head.replaceChildren();
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe("Full document hydration after Netlify HTML annotation", () => {
  it("normalizes only the known post-charset separator and preserves every head element", () => {
    const document = new DOMParser().parseFromString(
      `<html><head><meta charset="utf-8">${netlifyAnnotation}<title>Eterna Flor</title><script type="application/ld+json">{}</script>\n<!-- unrelated annotation --></head><body></body></html>`,
      "text/html",
    );
    const charset = document.querySelector("meta")!,
      title = document.querySelector("title")!,
      script = document.querySelector("script")!;
    const annotation = charset.nextSibling!.nextSibling!;
    const unrelatedWhitespace = script.nextSibling!;
    normalizeNetlifyHead(document);
    expect(charset.nextSibling).toBe(annotation);
    expect(document.querySelector("meta")).toBe(charset);
    expect(document.querySelector("title")).toBe(title);
    expect(document.querySelector("script")).toBe(script);
    expect(script.nextSibling).toBe(unrelatedWhitespace);
    const normalized = document.head.innerHTML;
    normalizeNetlifyHead(document);
    expect(document.head.innerHTML).toBe(normalized);
    const ordinary = new DOMParser().parseFromString(
      '<head><meta charset="utf-8">\n<!-- unrelated annotation --><title>Eterna Flor</title></head>',
      "text/html",
    );
    const original = ordinary.head.innerHTML;
    normalizeNetlifyHead(ordinary);
    expect(ordinary.head.innerHTML).toBe(original);
  });
  it.each([false, true])(
    "preserves the SSR hero and its single timeline through hydration/decode (Netlify annotation: %s)",
    async (annotated) => {
      const html = renderToString(page());
      const delivered = annotated
        ? html.replace(/(<meta charSet="utf-8"\/>)/, "$1" + netlifyAnnotation)
        : html;
      const parsed = new DOMParser().parseFromString(delivered, "text/html");
      document.documentElement.lang = parsed.documentElement.lang;
      document.head.replaceChildren(...Array.from(parsed.head.childNodes));
      document.body.replaceChildren(...Array.from(parsed.body.childNodes));
      const frame = document.querySelector<HTMLElement>('[data-image-trigger="mount"]')!;
      const scale = frame.querySelector<HTMLElement>("[data-image-scale]")!;
      const image = frame.querySelector<HTMLImageElement>("img")!;
      const rootStyle = frame.closest<HTMLElement>(".storefront-motion")!.getAttribute("style");
      expect(image).toHaveAttribute("src", remote);
      expect(image).toHaveAttribute("loading", "eager");
      expect(image).toHaveAttribute("fetchPriority", "high");
      expect(frame).not.toHaveAttribute("data-reveal");
      const mutations: MutationRecord[] = [];
      const watch = new MutationObserver((records) => mutations.push(...records));
      watch.observe(frame, {
        attributes: true,
        attributeOldValue: true,
        subtree: true,
        childList: true,
      });
      const recoverable = vi.fn(),
        errors = vi.spyOn(console, "error").mockImplementation(() => {});
      normalizeNetlifyHead(document);
      await act(async () => {
        root = hydrateRoot(document, page(), { onRecoverableError: recoverable });
      });
      expect(document.querySelector('[data-image-trigger="mount"]')).toBe(frame);
      expect(frame.querySelector("[data-image-scale]")).toBe(scale);
      expect(frame.querySelector("img")).toBe(image);
      expect(frame.closest(".storefront-motion")).toHaveAttribute("style", rootStyle);
      expect(image).toHaveAttribute("src", remote);
      Object.defineProperty(image, "naturalWidth", { value: 1080 });
      let resolve!: () => void;
      const decoded = new Promise<void>((done) => {
        resolve = done;
      });
      const decode = vi.fn(() => decoded);
      Object.defineProperty(image, "decode", { value: decode });
      fireEvent.load(image);
      fireEvent.load(image);
      await act(async () => {
        resolve();
        await decoded;
      });
      expect(decode).toHaveBeenCalledTimes(1);
      expect(image).toHaveAttribute("data-image-state", "ready");
      expect(
        mutations.filter(
          (record) =>
            record.type === "childList" ||
            ["class", "style", "data-image-trigger", "src"].includes(record.attributeName ?? ""),
        ),
      ).toEqual([]);
      fireEvent.animationEnd(frame);
      fireEvent.animationEnd(scale);
      await act(async () => root!.render(page()));
      expect(document.querySelector('[data-image-trigger="mount"]')).toBe(frame);
      expect(frame).toHaveAttribute("data-motion-complete", "true");
      expect(scale).toHaveAttribute("data-motion-complete", "true");
      expect(recoverable).not.toHaveBeenCalled();
      expect(errors).not.toHaveBeenCalled();
      watch.disconnect();
    },
  );
});
