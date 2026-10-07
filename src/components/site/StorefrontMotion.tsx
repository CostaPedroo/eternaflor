import { useEffect, useRef, type HTMLAttributes } from "react";
import { motion, motionStyle } from "@/lib/storefront-motion";

/** Progressive enhancement: server-rendered content is visible before any client setup. */
export function StorefrontMotion({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root || typeof window.IntersectionObserver !== "function") return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const registered = new WeakSet<Element>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          // The initial observer notification can intersect below our reveal threshold.
          if (!entry.isIntersecting || entry.intersectionRatio < motion.threshold) continue;
          (entry.target as HTMLElement).dataset["revealed"] =
            preference.matches || entry.target.closest('[data-layout-active="true"]')
              ? "immediate"
              : "animate";
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: "0px", threshold: motion.threshold },
    );

    const register = () => {
      root.querySelectorAll<HTMLElement>("[data-reveal]").forEach((element) => {
        if (registered.has(element)) return;
        registered.add(element);
        const delay = Math.min(
          motion.stagger.limit,
          Math.max(0, Number(element.dataset["revealDelay"]) || 0),
        );
        element.style.setProperty("--reveal-delay", `${delay}ms`);
        const bounds = element.getBoundingClientRect();
        const visibleHeight = Math.max(
          0,
          Math.min(bounds.bottom, window.innerHeight) - Math.max(bounds.top, 0),
        );
        // Preserve content already in view, including restored back/forward scroll positions.
        if (
          preference.matches ||
          element.closest('[data-layout-active="true"]') ||
          (bounds.height > 0 &&
            (bounds.bottom <= 0 || visibleHeight >= bounds.height * motion.threshold))
        ) {
          element.dataset["revealed"] = "immediate";
        } else {
          observer.observe(element);
        }
      });
    };
    const reduceMotion = () => {
      if (!preference.matches) return;
      observer.disconnect();
      root.querySelectorAll<HTMLElement>("[data-reveal]").forEach((element) => {
        element.dataset["revealed"] = "immediate";
      });
    };
    const showFocusedContent = (event: FocusEvent) => {
      if (!(event.target instanceof Element)) return;
      const element = event.target.closest<HTMLElement>("[data-reveal]");
      if (element) {
        observer.unobserve(element);
        element.dataset["revealed"] = "immediate";
      }
    };
    register();
    // Catalogue filtering can mount new cards without remounting the public page.
    const mutations =
      typeof MutationObserver === "function"
        ? new MutationObserver((records) => {
            for (const record of records) {
              record.removedNodes.forEach((node) => {
                if (!(node instanceof Element) || root.contains(node)) return;
                observer.unobserve(node);
                node
                  .querySelectorAll("[data-reveal]")
                  .forEach((element) => observer.unobserve(element));
              });
            }
            register();
          })
        : null;
    mutations?.observe(root, { childList: true, subtree: true });
    preference.addEventListener("change", reduceMotion);
    root.addEventListener("focusin", showFocusedContent);
    return () => {
      observer.disconnect();
      mutations?.disconnect();
      preference.removeEventListener("change", reduceMotion);
      root.removeEventListener("focusin", showFocusedContent);
      root.querySelectorAll<HTMLElement>("[data-reveal]").forEach((element) => {
        delete element.dataset["revealed"];
        element.style.removeProperty("--reveal-delay");
      });
    };
  }, []);

  return (
    <div
      {...props}
      style={{ ...motionStyle, ...props.style }}
      ref={ref}
      className={`storefront-motion ${className}`}
    />
  );
}
