import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { createRef, useRef, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnimatedGrid, type AnimatedGridHandle } from "@/components/site/AnimatedGrid";
import { CrossfadeImage } from "@/components/site/CrossfadeImage";
import { ImageReveal } from "@/components/site/ImageReveal";
import { MenuBackdrop } from "@/components/site/MenuBackdrop";
import { motion } from "@/lib/storefront-motion";
import { StorefrontMotion } from "@/components/site/StorefrontMotion";
import { ProductCard } from "@/components/site/ProductCard";
import type { PublicProduct } from "@/lib/catalog.functions";
vi.mock("@/lib/product-images", () => ({
  productImagesQuery: (id: string) => ({ queryKey: ["unused", id], queryFn: () => [] }),
}));

type Played = {
  element: HTMLElement;
  frames: Keyframe[];
  options: KeyframeAnimationOptions;
  animation: Animation;
  finish: () => void;
};
let played: Played[];
let reduced: boolean;
let listeners: Set<() => void>;
const originalHeight = window.innerHeight;

beforeEach(() => {
  played = [];
  reduced = false;
  listeners = new Set();
  vi.spyOn(window, "matchMedia").mockImplementation(
    (media) =>
      ({
        media,
        get matches() {
          return reduced;
        },
        addEventListener: (_: string, fn: () => void) => listeners.add(fn),
        removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
      }) as unknown as MediaQueryList,
  );
  Object.defineProperty(HTMLElement.prototype, "animate", {
    configurable: true,
    value: vi.fn(function (
      this: HTMLElement,
      frames: Keyframe[],
      options: KeyframeAnimationOptions,
    ) {
      let finish!: () => void, reject!: (reason: Error) => void;
      const finished = new Promise<void>((resolve, fail) => {
        finish = resolve;
        reject = fail;
      });
      const animation = {
        finished,
        cancel: vi.fn(() => reject(new Error("cancelled"))),
      } as unknown as Animation;
      played.push({ element: this, frames, options, animation, finish });
      return animation;
    }),
  });
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
    this: HTMLElement,
  ) {
    const children = [...(this.parentElement?.children ?? [])].filter((element) =>
      element.hasAttribute("data-product-id"),
    );
    const index = children.indexOf(this);
    const left = 100 + Math.max(0, index % 3) * 200;
    const top = 200 + Math.max(0, Math.floor(index / 3)) * 300;
    return {
      left,
      right: left + 180,
      top,
      bottom: top + 260,
      width: 180,
      height: 260,
      x: left,
      y: top,
    } as DOMRect;
  });
});
afterEach(() => {
  cleanup();
  Object.defineProperty(window, "innerHeight", { configurable: true, value: originalHeight });
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete (HTMLElement.prototype as Partial<HTMLElement>).animate;
});

function items(ids: string[]) {
  return ids.map((id) => (
    <article key={id} data-product-id={id}>
      <div data-reveal data-card-reveal>
        <button>{id}</button>
        <a href={`https://orders.test/${id}`}>Quero {id}</a>
      </div>
    </article>
  ));
}
function Grid() {
  const [ids, setIds] = useState(["a", "b", "c"]);
  const ref = useRef<AnimatedGridHandle>(null);
  const update = (next: string[]) => {
    ref.current?.capture();
    setIds(next);
  };
  return (
    <>
      <button onClick={() => update(["c", "a", "d"])}>Filtrar</button>
      <button onClick={() => update(["d", "c"])}>Outra categoria</button>
      <button onClick={() => update([])}>Sem resultados</button>
      <AnimatedGrid ref={ref}>{items(ids)}</AnimatedGrid>
    </>
  );
}

describe("Catalogue native FLIP", () => {
  it("does not shuffle or cancel on same-key rerenders or height-only mobile resize", () => {
    const ref = createRef<AnimatedGridHandle>();
    const view = render(<AnimatedGrid ref={ref}>{items(["a", "b"])}</AnimatedGrid>);
    ref.current?.capture();
    view.rerender(<AnimatedGrid ref={ref}>{items(["b", "a"])}</AnimatedGrid>);
    const count = played.length;
    ref.current?.capture();
    view.rerender(<AnimatedGrid ref={ref}>{items(["b", "a"])}</AnimatedGrid>);
    fireEvent(window, new Event("resize"));
    expect(played).toHaveLength(count);
    played.forEach((play) => expect(play.animation.cancel).not.toHaveBeenCalled());
  });

  it("keeps real card reveal and FLIP on different nodes with stable product identities", () => {
    let intersection!: IntersectionObserverCallback;
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(callback: IntersectionObserverCallback) {
          intersection = callback;
        }
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    const originalHeight = window.innerHeight;
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 50 });
    const ref = createRef<AnimatedGridHandle>();
    const product = (id: string): PublicProduct => ({
      id,
      name: id,
      slug: id,
      image: "/" + id + ".webp",
      price: 10,
      old_price: null,
      description: null,
      short_description: null,
      featured: true,
      available: true,
      customizable: true,
      category_id: null,
      sort_order: 0,
      created_at: "2026-10-08",
    });
    const page = (ids: string[]) => (
      <StorefrontMotion>
        <AnimatedGrid ref={ref}>
          {ids.map((id) => (
            <ProductCard key={id} p={product(id)} />
          ))}
        </AnimatedGrid>
      </StorefrontMotion>
    );
    const view = render(page(["a", "b"]));
    const a = document.querySelector<HTMLElement>('[data-product-id="a"]')!;
    const reveal = a.querySelector<HTMLElement>("[data-card-reveal]")!;
    const trigger = screen.getByRole("button", { name: "Ver detalhes de a" });
    act(() =>
      intersection(
        [
          {
            target: reveal,
            isIntersecting: true,
            intersectionRatio: 0.2,
          } as unknown as IntersectionObserverEntry,
        ],
        {} as IntersectionObserver,
      ),
    );
    expect(reveal).toHaveAttribute("data-revealed", "animate");
    expect(a).not.toHaveAttribute("data-reveal");
    ref.current?.capture();
    view.rerender(page(["b", "a"]));
    expect(screen.getByRole("button", { name: "Ver detalhes de a" })).toBe(trigger);
    expect(played.some((play) => play.element === a)).toBe(true);
    expect(played.some((play) => play.element === reveal)).toBe(false);
    expect(reveal).toHaveAttribute("data-revealed", "animate");
    fireEvent.animationEnd(reveal);
    expect(reveal).toHaveAttribute("data-revealed", "done");
    const count = played.length;
    view.rerender(page(["b", "a"]));
    expect(played).toHaveLength(count);
    Object.defineProperty(window, "innerHeight", { configurable: true, value: originalHeight });
  });
  it("smoothly shrinks rows through an empty result without making exiting cards interactive", () => {
    const ref = createRef<AnimatedGridHandle>();
    const view = render(<AnimatedGrid ref={ref}>{items(["a", "b", "c"])}</AnimatedGrid>);
    const grid = document.querySelector<HTMLElement>(".storefront-grid")!;
    const rect = grid.getBoundingClientRect();
    Object.defineProperty(grid, "getBoundingClientRect", {
      configurable: true,
      value: () => ({ ...rect, height: grid.querySelectorAll("article").length * 100 }),
    });
    ref.current?.capture();
    view.rerender(<AnimatedGrid ref={ref}>{items([])}</AnimatedGrid>);
    const resize = played.find((play) => play.element === grid)!;
    expect(resize.frames).toEqual([
      { height: "300px", overflow: "clip" },
      { height: "0px", overflow: "clip" },
    ]);
    expect(resize.options.duration).toBe(motion.duration.layout);
    expect(document.querySelector(".storefront-grid-exits")?.children).toHaveLength(3);
    expect(screen.queryByRole("button")).toBeNull();
  });
  it("keeps SSR visible and initial mounting motion-free", () => {
    const html = renderToString(<AnimatedGrid>{items(["a", "b"])}</AnimatedGrid>);
    expect(html).not.toContain("data-layout-active");
    expect(html).not.toContain("opacity:");
    render(<Grid />);
    expect(played).toHaveLength(0);
  });
  it("moves surviving keyed cards, enters new cards and fades inert exiting copies", async () => {
    render(<Grid />);
    const original = screen.getByRole("button", { name: "c" });
    fireEvent.click(screen.getByRole("button", { name: "Filtrar" }));
    expect(screen.getByRole("button", { name: "c" })).toBe(original);
    expect(screen.queryByRole("button", { name: "b" })).toBeNull();
    expect(screen.getByRole("link", { name: "Quero d" })).toHaveAttribute(
      "href",
      "https://orders.test/d",
    );
    const survivor = played.find((play) => play.element.dataset["productId"] === "c")!;
    expect(survivor.frames[0]?.["transform"]).toBe("translate(400px, 0px) scale(1, 1)");
    const entrant = played.find((play) => play.element.dataset["productId"] === "d")!;
    expect(entrant.frames[0]).toMatchObject({
      opacity: 0,
      transform: "translateY(12px) scale(0.97)",
    });
    expect(entrant.options.duration).toBe(motion.duration.layout);
    const ghost = document.querySelector<HTMLElement>(".storefront-grid-exits > div")!;
    expect(ghost).toHaveAttribute("aria-hidden", "true");
    expect(ghost.inert).toBe(true);
    expect(ghost.querySelector("button")).toHaveAttribute("tabindex", "-1");
    expect(ghost.querySelector("[data-card-reveal]")).toHaveAttribute("data-revealed", "immediate");
    expect(played.find((play) => play.element === ghost)?.frames[1]).toMatchObject({
      opacity: 0,
      transform: "translateY(8px) scale(0.97)",
    });
    await act(async () => {
      played.forEach((play) => play.finish());
    });
    expect(document.querySelector(".storefront-grid-exits")?.children).toHaveLength(0);
  });
  it("cancels and retargets rapid filter changes without leaving stale products/actions", async () => {
    render(<Grid />);
    fireEvent.click(screen.getByRole("button", { name: "Filtrar" }));
    const old = [...played];
    fireEvent.click(screen.getByRole("button", { name: "Outra categoria" }));
    old.forEach((play) => expect(play.animation.cancel).toHaveBeenCalled());
    expect(
      [...document.querySelectorAll("article")].map((element) => element.dataset["productId"]),
    ).toEqual(["d", "c"]);
    expect(screen.queryByRole("link", { name: "Quero a" })).toBeNull();
    await act(async () => {
      old.forEach((play) => play.finish());
    });
    expect(screen.getByRole("button", { name: "d" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sem resultados" }));
    expect(document.querySelectorAll("article")).toHaveLength(0);
  });
  it("retargets from painted in-flight geometry instead of jumping to a previous destination", () => {
    const ref = createRef<AnimatedGridHandle>();
    const view = render(<AnimatedGrid ref={ref}>{items(["a", "b"])}</AnimatedGrid>);
    ref.current?.capture();
    view.rerender(<AnimatedGrid ref={ref}>{items(["b", "a"])}</AnimatedGrid>);
    const b = screen.getByRole("button", { name: "b" }).closest("article")!;
    const final = b.getBoundingClientRect();
    Object.defineProperty(b, "getBoundingClientRect", {
      configurable: true,
      value: vi
        .fn()
        .mockReturnValueOnce({
          ...final,
          left: final.left + 70,
          width: final.width * 0.98,
        } as DOMRect)
        .mockReturnValue(final),
    });
    ref.current?.capture();
    view.rerender(<AnimatedGrid ref={ref}>{items(["b", "a", "c"])}</AnimatedGrid>);
    const latest = played.filter((play) => play.element === b).at(-1)!;
    expect(latest.frames[0]?.["transform"]).toBe("translate(70px, 0px) scale(0.98, 1)");
  });
  it("cancels on reduced-motion changes and keeps filtering immediate", () => {
    render(<Grid />);
    fireEvent.click(screen.getByRole("button", { name: "Filtrar" }));
    const count = played.length;
    reduced = true;
    act(() => listeners.forEach((listener) => listener()));
    expect(document.querySelector(".storefront-grid-exits")?.children).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Outra categoria" }));
    expect(played).toHaveLength(count);
    expect(screen.getByRole("button", { name: "d" })).toBeInTheDocument();
  });
  it("stays functional without WAAPI and bounds entering stagger", () => {
    const ref = createRef<AnimatedGridHandle>();
    const view = render(<AnimatedGrid ref={ref}>{items(["a"])}</AnimatedGrid>);
    ref.current?.capture();
    view.rerender(
      <AnimatedGrid ref={ref}>
        {items(Array.from({ length: 12 }, (_, i) => `new${i}`))}
      </AnimatedGrid>,
    );
    const entering = played.filter((play) => play.element.hasAttribute("data-product-id"));
    expect(entering[1]?.options.delay).toBe(40);
    expect(Math.max(...entering.map((play) => Number(play.options.delay)))).toBe(
      motion.stagger.limit,
    );
    delete (HTMLElement.prototype as Partial<HTMLElement>).animate;
    ref.current?.capture();
    view.rerender(<AnimatedGrid ref={ref}>{items(["final"])}</AnimatedGrid>);
    expect(screen.getByRole("button", { name: "final" })).toBeVisible();
    expect(document.querySelector(".storefront-grid-exits")?.children).toHaveLength(0);
  });
});

describe("Decoded gallery crossfade", () => {
  const photo = (src: string) => (
    <CrossfadeImage src={src} alt="Fotografia atual" onError={vi.fn()} />
  );
  it("does not animate initial load, repeated load/decode events or same-source rerenders", async () => {
    const view = render(photo("/a.webp"));
    const initial = screen.getByAltText("Fotografia atual");
    expect(initial).not.toHaveStyle({ opacity: "0" });
    fireEvent.load(initial);
    view.rerender(photo("/a.webp"));
    fireEvent.load(initial);
    expect(played).toHaveLength(0);
    expect(screen.getByAltText("Fotografia atual")).toBe(initial);
    view.rerender(photo("/b.webp"));
    const next = screen.getByAltText("Fotografia atual");
    fireEvent.load(next);
    const count = played.length;
    expect(count).toBe(2);
    view.rerender(photo("/b.webp"));
    fireEvent.load(next);
    expect(played).toHaveLength(count);
    await act(async () => {
      played.forEach((play) => play.finish());
    });
    played.forEach((play) => expect(play.animation.cancel).toHaveBeenCalled());
    expect(next).not.toHaveStyle({ opacity: "0" });
  });
  it("retains the old photo through loading, then animates both layers", async () => {
    const view = render(photo("/a.webp"));
    fireEvent.load(screen.getByAltText("Fotografia atual"));
    await act(async () => {
      played.forEach((play) => play.finish());
    });
    view.rerender(photo("/b.webp"));
    const incoming = screen.getByAltText("Fotografia atual");
    const outgoing = document.querySelector<HTMLImageElement>('img[aria-hidden="true"]')!;
    expect(outgoing.src).toContain("/a.webp");
    expect(incoming).toHaveStyle({ opacity: "0" });
    fireEvent.load(incoming);
    const entry = played.filter((play) => play.element === incoming).at(-1)!;
    expect(entry.frames[0]).toEqual({ opacity: 0, transform: "scale(1.015)" });
    expect(entry.options.duration).toBe(300);
    expect(played.find((play) => play.element === outgoing)?.frames).toEqual([
      { opacity: 1 },
      { opacity: 0 },
    ]);
    await act(async () => {
      played.forEach((play) => play.finish());
    });
    expect(document.querySelector('img[aria-hidden="true"]')).toBeNull();
  });
  it("ignores a stale decode after rapid navigation and cleans up on reduced motion", async () => {
    const view = render(photo("/a.webp"));
    fireEvent.load(screen.getByAltText("Fotografia atual"));
    view.rerender(photo("/b.webp"));
    const second = screen.getByAltText("Fotografia atual");
    let decode!: () => void;
    const pending = new Promise<void>((resolve) => {
      decode = resolve;
    });
    Object.defineProperty(second, "decode", { value: () => pending });
    fireEvent.load(second);
    view.rerender(photo("/c.webp"));
    await act(async () => {
      decode();
      await pending;
    });
    expect(screen.getByAltText("Fotografia atual")).toHaveAttribute("src", "/c.webp");
    expect(screen.getByAltText("Fotografia atual")).not.toHaveAttribute("data-loaded");
    expect(document.querySelector('img[aria-hidden="true"]')).toHaveAttribute("src", "/a.webp");
    reduced = true;
    act(() => listeners.forEach((listener) => listener()));
    expect(document.querySelector('img[aria-hidden="true"]')).toBeNull();
    expect(screen.getByAltText("Fotografia atual")).not.toHaveStyle({ opacity: "0" });
    const count = played.length;
    fireEvent.load(screen.getByAltText("Fotografia atual"));
    expect(played).toHaveLength(count);
  });
});

describe("Editorial masks and mobile menu", () => {
  it("renders mask variants without hiding SSR content or changing its structure", () => {
    const html = renderToString(
      <ImageReveal direction="right">
        <img src="/editorial.webp" alt="Flores" />
      </ImageReveal>,
    );
    expect(html).toContain('data-image-reveal="right"');
    expect(html).toContain('data-reveal="image"');
    expect(html).not.toContain("data-revealed");
    expect(html).not.toContain("clip-path:");
  });
  it("keeps the backdrop through its closing animation and cancels safely on reopening", async () => {
    const close = vi.fn();
    const view = render(<MenuBackdrop open={false} close={close} />);
    expect(document.querySelector(".storefront-menu-backdrop")).toBeNull();
    view.rerender(<MenuBackdrop open close={close} />);
    fireEvent.click(document.querySelector(".storefront-menu-backdrop")!);
    expect(close).toHaveBeenCalled();
    await act(async () => played.at(-1)!.finish());
    view.rerender(<MenuBackdrop open={false} close={close} />);
    const closing = played.at(-1)!;
    expect(document.querySelector(".storefront-menu-backdrop")).not.toBeNull();
    expect(closing.frames).toEqual([{ opacity: "1" }, { opacity: "0" }]);
    view.rerender(<MenuBackdrop open close={close} />);
    expect(closing.animation.cancel).toHaveBeenCalled();
    await act(async () => closing.finish());
    expect(document.querySelector(".storefront-menu-backdrop")).not.toBeNull();
    view.rerender(<MenuBackdrop open={false} close={close} />);
    await act(async () => played.at(-1)!.finish());
    expect(document.querySelector(".storefront-menu-backdrop")).toBeNull();
  });
});
