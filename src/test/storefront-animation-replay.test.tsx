import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StorefrontMotion } from "@/components/site/StorefrontMotion";
import { ImageReveal } from "@/components/site/ImageReveal";
import { HeroImage } from "@/components/site/HeroImage";
import { readFileSync } from "node:fs";

/** Use the actual CSS selectors to verify which timelines are active, not class snapshots. */
function animationRules() {
  const style = document.createElement("style");
  const motionCss = readFileSync("src/styles.css", "utf8");
  style.textContent = motionCss.slice(motionCss.indexOf("/* Public storefront only."));
  document.head.append(style);
  const result: { selector: string; animation: string }[] = [];
  const collect = (rules: CSSRuleList) => {
    for (const rule of Array.from(rules)) {
      if (rule.type === CSSRule.MEDIA_RULE) {
        const media = rule as CSSMediaRule;
        if (!media.media.mediaText.includes("prefers-reduced-motion: reduce"))
          collect(media.cssRules);
      } else if (rule.type === CSSRule.STYLE_RULE) {
        const declaration = rule as CSSStyleRule;
        const animation = declaration.style.getPropertyValue("animation");
        if (animation && animation !== "none")
          result.push({ selector: declaration.selectorText, animation });
      }
    }
  };
  collect(style.sheet!.cssRules);
  style.remove();
  return (element: HTMLElement) => result.filter((rule) => element.matches(rule.selector));
}

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

function hero(src = "/hero.webp") {
  return (
    <StorefrontMotion>
      <ImageReveal trigger="mount">
        <HeroImage src={src} fallbackSrc="/default.webp" alt="Hero" />
      </ImageReveal>
      <div data-hero="cta">
        <button>Catálogo</button>
      </div>
    </StorefrontMotion>
  );
}

describe("Once-only CSS entrance ownership", () => {
  it("keeps one hero timeline through hydration, delayed decoding, repeated loads and same-source rerenders", async () => {
    const timelines = animationRules();
    const container = document.createElement("div");
    container.innerHTML = renderToString(hero());
    document.body.append(container);
    const frame = container.querySelector<HTMLElement>('[data-image-trigger="mount"]')!;
    const scale = frame.querySelector<HTMLElement>("[data-image-scale]")!;
    const initialMask = timelines(frame),
      initialScale = timelines(scale);
    expect(initialMask).toHaveLength(1);
    expect(initialScale).toHaveLength(1);
    const errors = vi.spyOn(console, "error").mockImplementation(() => {}),
      recoverable = vi.fn();
    let root!: ReturnType<typeof hydrateRoot>;
    await act(async () => {
      root = hydrateRoot(container, hero(), { onRecoverableError: recoverable });
    });
    const image = screen.getByAltText("Hero");
    expect(timelines(frame)).toEqual(initialMask);
    expect(timelines(scale)).toEqual(initialScale);
    expect(timelines(image)).toEqual([]);
    expect(image.style.opacity).toBe("");
    Object.defineProperty(image, "naturalWidth", { value: 1080 });
    let resolve!: () => void;
    const pending = new Promise<void>((done) => {
      resolve = done;
    });
    const decode = vi.fn(() => pending);
    Object.defineProperty(image, "decode", { value: decode });
    fireEvent.load(image);
    fireEvent.load(image);
    expect(decode).toHaveBeenCalledTimes(1);
    expect(timelines(frame)).toEqual(initialMask);
    await act(async () => {
      resolve();
      await pending;
    });
    expect(image).toHaveAttribute("data-image-state", "ready");
    expect(timelines(frame)).toEqual(initialMask);
    expect(timelines(scale)).toEqual(initialScale);
    fireEvent.animationEnd(frame);
    fireEvent.animationEnd(scale);
    await act(async () => root.render(hero()));
    fireEvent.load(image);
    expect(container.querySelector('[data-image-trigger="mount"]')).toBe(frame);
    expect(timelines(frame)).toEqual([]);
    expect(timelines(scale)).toEqual([]);
    expect(timelines(image)).toEqual([]);
    expect(errors).not.toHaveBeenCalled();
    expect(recoverable).not.toHaveBeenCalled();
    act(() => root.unmount());
    container.remove();
  });

  it("does not restart the mask/scale when a fallback or updated hero URL replaces only the image", async () => {
    const timelines = animationRules();
    const view = render(hero());
    const frame = document.querySelector<HTMLElement>('[data-image-trigger="mount"]')!,
      scale = frame.querySelector<HTMLElement>("[data-image-scale]")!;
    const active = timelines(frame);
    fireEvent.error(screen.getByAltText("Hero"));
    expect(screen.getByAltText("Hero")).toHaveAttribute("src", "/default.webp");
    expect(timelines(frame)).toEqual(active);
    fireEvent.animationEnd(frame);
    fireEvent.animationEnd(scale);
    view.rerender(hero("/updated.webp"));
    expect(document.querySelector('[data-image-trigger="mount"]')).toBe(frame);
    const image = screen.getByAltText("Hero");
    Object.defineProperty(image, "naturalWidth", { value: 1080 });
    fireEvent.load(image);
    await waitFor(() => expect(image).toHaveAttribute("data-image-state", "ready"));
    expect(timelines(frame)).toEqual([]);
    expect(timelines(scale)).toEqual([]);
  });

  it("does not restore the hero CTA entrance on focus-out or reduced-motion toggles", () => {
    const timelines = animationRules();
    let reduced = false;
    const listeners = new Set<() => void>();
    vi.spyOn(window, "matchMedia").mockImplementation(
      (media) =>
        ({
          media,
          get matches() {
            return reduced;
          },
          addEventListener: (_: string, handler: () => void) => listeners.add(handler),
          removeEventListener: (_: string, handler: () => void) => listeners.delete(handler),
        }) as unknown as MediaQueryList,
    );
    render(hero());
    const button = screen.getByRole("button"),
      cta = button.parentElement!;
    expect(timelines(cta)).toHaveLength(1);
    fireEvent.focusIn(button);
    fireEvent.focusOut(button);
    expect(timelines(cta)).toEqual([]);
    reduced = true;
    act(() => listeners.forEach((listener) => listener()));
    reduced = false;
    act(() => listeners.forEach((listener) => listener()));
    expect(timelines(document.querySelector<HTMLElement>('[data-image-trigger="mount"]')!)).toEqual(
      [],
    );
    expect(timelines(cta)).toEqual([]);
  });
});
