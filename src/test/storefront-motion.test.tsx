import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StorefrontMotion } from "@/components/site/StorefrontMotion";
import { StrictMode } from "react";

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

function enter(target: HTMLElement, intersectionRatio = 0.2, isIntersecting = true) {
  act(() =>
    callback(
      [
        {
          target,
          isIntersecting,
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
    expect(favorites).toHaveAttribute("data-revealed", "waiting");
    expect(unobserve).not.toHaveBeenCalledWith(favorites);
    enter(favorites);
    expect(favorites.dataset["revealed"]).toBe("animate");
    expect(unobserve).toHaveBeenCalledWith(favorites);
  });

  it("preserves partially visible SSR content instead of hiding it at the trigger threshold", () => {
    render(
      <StorefrontMotion>
        <section data-reveal data-at-edge>
          Personalizados
        </section>
      </StorefrontMotion>,
    );
    const section = screen.getByText("Personalizados");
    expect(observe).not.toHaveBeenCalledWith(section);
    enter(section, 0.08);
    expect(section).toHaveAttribute("data-revealed", "immediate");
    enter(section, 0.2);
    expect(section.dataset["revealed"]).toBe("immediate");
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
    expect(screen.getByText("Personalizados")).toHaveAttribute("data-revealed", "immediate");
  });

  it("latches completion across exit/reentry, rerenders and queued threshold callbacks", () => {
    const view = render(
      <StorefrontMotion>
        <section data-reveal>Favoritos</section>
      </StorefrontMotion>,
    );
    const section = screen.getByText("Favoritos");
    expect(section).toHaveAttribute("data-revealed", "waiting");
    enter(section);
    expect(section).toHaveAttribute("data-revealed", "animate");
    enter(section, 0, false);
    expect(section).toHaveAttribute("data-revealed", "animate");
    fireEvent.animationEnd(section);
    expect(section).toHaveAttribute("data-revealed", "done");
    const calls = unobserve.mock.calls.length;
    enter(section, 0, false);
    enter(section);
    view.rerender(
      <StorefrontMotion>
        <section data-reveal>Favoritos</section>
      </StorefrontMotion>,
    );
    expect(section).toHaveAttribute("data-revealed", "done");
    expect(unobserve.mock.calls).toHaveLength(calls);
  });

  it("does not replay a form/CTA after focus, blur or a queued observer callback", () => {
    render(
      <StorefrontMotion>
        <form data-reveal>
          <button data-follow-reveal>Criar bouquet</button>
        </form>
      </StorefrontMotion>,
    );
    const button = screen.getByRole("button"),
      form = button.closest("form")!;
    enter(form);
    fireEvent.focusIn(button);
    fireEvent.focusOut(button);
    enter(form);
    expect(form).toHaveAttribute("data-revealed", "immediate");
    expect(button).toHaveAttribute("data-motion-complete", "true");
  });

  it("does not let descendant animation events prematurely complete a group", () => {
    render(
      <StorefrontMotion>
        <section data-reveal>
          <span>Foto</span>
        </section>
      </StorefrontMotion>,
    );
    const text = screen.getByText("Foto"),
      section = text.parentElement!;
    enter(section);
    fireEvent.animationEnd(text);
    expect(section).toHaveAttribute("data-revealed", "animate");
    fireEvent.animationEnd(section);
    expect(section).toHaveAttribute("data-revealed", "done");
  });

  it("retains completion through StrictMode effect cleanup and reduced-motion re-evaluation", () => {
    const view = render(
      <StrictMode>
        <StorefrontMotion>
          <section data-reveal>Flores</section>
          <p data-hero="title">Eterna Flor</p>
        </StorefrontMotion>
      </StrictMode>,
    );
    const section = screen.getByText("Flores"),
      title = screen.getByText("Eterna Flor");
    enter(section);
    fireEvent.animationEnd(section);
    fireEvent.animationEnd(title);
    reduced = true;
    act(() => change?.());
    reduced = false;
    act(() => change?.());
    view.rerender(
      <StrictMode>
        <StorefrontMotion>
          <section data-reveal>Flores</section>
          <p data-hero="title">Eterna Flor</p>
        </StorefrontMotion>
      </StrictMode>,
    );
    enter(section);
    expect(section).toHaveAttribute("data-revealed", "done");
    expect(title).toHaveAttribute("data-motion-complete", "true");
  });
});
