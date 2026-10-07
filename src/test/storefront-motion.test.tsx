import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StorefrontMotion } from "@/components/site/StorefrontMotion";

let callback: IntersectionObserverCallback;
const observe = vi.fn();
const unobserve = vi.fn();
const disconnect = vi.fn();
let reduced = false;
let change: (() => void) | undefined;

beforeEach(() => {
  vi.clearAllMocks();
  reduced = false;
  change = undefined;
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(fn: IntersectionObserverCallback) {
        callback = fn;
      }
      observe = observe;
      unobserve = unobserve;
      disconnect = disconnect;
    },
  );
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query) =>
      ({
        get matches() {
          return reduced;
        },
        media: query,
        addEventListener: (_event: string, fn: () => void) => {
          change = fn;
        },
        removeEventListener: vi.fn(),
      }) as unknown as MediaQueryList,
  );
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
    this: HTMLElement,
  ) {
    const top = this.hasAttribute("data-above-fold")
      ? 0
      : this.hasAttribute("data-at-edge")
        ? window.innerHeight - 40
        : 2000;
    return { top, bottom: top + 500, height: 500 } as DOMRect;
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function enter(target: HTMLElement, intersectionRatio = 0.2) {
  act(() =>
    callback(
      [
        {
          target,
          isIntersecting: true,
          boundingClientRect: target.getBoundingClientRect(),
          intersectionRatio,
          intersectionRect: target.getBoundingClientRect(),
          rootBounds: null,
          time: 0,
        },
      ],
      {} as IntersectionObserver,
    ),
  );
}

describe("Public storefront motion", () => {
  it("server-renders visible content and hydrates without changing the initial markup", async () => {
    const page = (
      <StorefrontMotion>
        <section data-reveal>Flores feitas à mão</section>
      </StorefrontMotion>
    );
    const html = renderToString(page);
    expect(html).not.toContain("data-revealed");
    expect(html).not.toContain("opacity");
    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.append(container);
    const recoverable = vi.fn();
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    let root: ReturnType<typeof hydrateRoot>;
    await act(async () => {
      root = hydrateRoot(container, page, { onRecoverableError: recoverable });
    });
    expect(recoverable).not.toHaveBeenCalled();
    expect(errors).not.toHaveBeenCalled();
    expect(container.textContent).toBe("Flores feitas à mão");
    act(() => root.unmount());
    container.remove();
  });

  it("reveals approaching sections once with a capped stagger, preserving content already on screen", () => {
    render(
      <StorefrontMotion>
        <section data-reveal data-above-fold>
          Hero
        </section>
        <section data-reveal data-reveal-delay="900">
          Favoritos
        </section>
      </StorefrontMotion>,
    );
    const hero = screen.getByText("Hero");
    const favorites = screen.getByText("Favoritos");
    expect(hero.dataset["revealed"]).toBe("immediate");
    expect(observe).not.toHaveBeenCalledWith(hero);
    expect(observe).toHaveBeenCalledWith(favorites);
    expect(favorites.style.getPropertyValue("--reveal-delay")).toBe("240ms");
    enter(favorites, 0.1);
    expect(favorites).not.toHaveAttribute("data-revealed");
    expect(unobserve).not.toHaveBeenCalledWith(favorites);
    enter(favorites);
    expect(favorites.dataset["revealed"]).toBe("animate");
    expect(unobserve).toHaveBeenCalledWith(favorites);
  });

  it("waits for the reveal threshold when a section starts partly visible at the viewport edge", () => {
    render(
      <StorefrontMotion>
        <section data-reveal data-at-edge>
          Personalizados
        </section>
      </StorefrontMotion>,
    );
    const section = screen.getByText("Personalizados");
    expect(observe).toHaveBeenCalledWith(section);
    enter(section, 0.08);
    expect(section).not.toHaveAttribute("data-revealed");
    enter(section, 0.2);
    expect(section.dataset["revealed"]).toBe("animate");
  });

  it("shows a focused group immediately rather than making keyboard users wait", () => {
    render(
      <StorefrontMotion>
        <section data-reveal>
          <button>Criar bouquet</button>
        </section>
      </StorefrontMotion>,
    );
    const button = screen.getByRole("button");
    fireEvent.focusIn(button);
    expect(button.parentElement?.dataset["revealed"]).toBe("immediate");
    expect(unobserve).toHaveBeenCalledWith(button.parentElement);
  });

  it("shows everything immediately for reduced motion, including a preference change", () => {
    const view = render(
      <StorefrontMotion>
        <section data-reveal>FAQ</section>
      </StorefrontMotion>,
    );
    reduced = true;
    act(() => change?.());
    expect(screen.getByText("FAQ").dataset["revealed"]).toBe("immediate");
    expect(disconnect).toHaveBeenCalled();
    view.unmount();
    observe.mockClear();
    render(
      <StorefrontMotion>
        <section data-reveal>Rodapé</section>
      </StorefrontMotion>,
    );
    expect(screen.getByText("Rodapé").dataset["revealed"]).toBe("immediate");
    expect(observe).not.toHaveBeenCalled();
  });

  it("observes new filtered cards, releases removed cards and disconnects on navigation", async () => {
    const view = render(
      <StorefrontMotion>
        <article data-reveal>Rosa</article>
      </StorefrontMotion>,
    );
    const removed = screen.getByText("Rosa");
    view.rerender(
      <StorefrontMotion>
        <article key="new" data-reveal>
          Tulipa
        </article>
      </StorefrontMotion>,
    );
    await waitFor(() => expect(observe).toHaveBeenCalledWith(screen.getByText("Tulipa")));
    expect(unobserve).toHaveBeenCalledWith(removed);
    view.unmount();
    expect(disconnect).toHaveBeenCalled();
  });

  it("keeps content usable when IntersectionObserver is unavailable", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    render(
      <StorefrontMotion>
        <section data-reveal>Personalizados</section>
      </StorefrontMotion>,
    );
    expect(screen.getByText("Personalizados")).toBeVisible();
    expect(screen.getByText("Personalizados")).not.toHaveAttribute("data-revealed");
  });
});
