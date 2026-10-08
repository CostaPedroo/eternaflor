import { useEffect, useRef, type HTMLAttributes } from "react";
import {
  completeEntrance,
  completeReveal,
  motion,
  motionStyle,
  onceEntranceSelector,
} from "@/lib/storefront-motion";

/** Visible SSR content is enhanced only if it has not entered the viewport yet. */
export function StorefrontMotion({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const registered = new WeakSet<Element>();
    const observer =
      typeof window.IntersectionObserver === "function"
        ? new IntersectionObserver(
            (entries) => {
              for (const entry of entries) {
                const element = entry.target as HTMLElement;
                // A queued notification must not resurrect a focused/completed reveal.
                if (
                  !root.contains(element) ||
                  element.dataset["revealed"] !== "waiting" ||
                  !entry.isIntersecting ||
                  entry.intersectionRatio < motion.threshold
                )
                  continue;
                if (preference.matches || element.closest('[data-layout-active="true"]'))
                  completeReveal(element, "immediate");
                else element.dataset["revealed"] = "animate";
                observer?.unobserve(element);
              }
            },
            { rootMargin: "0px", threshold: motion.threshold },
          )
        : null;

    const register = () => {
      root.querySelectorAll<HTMLElement>("[data-reveal]").forEach((element) => {
        if (registered.has(element)) return;
        registered.add(element);
        const state = element.dataset["revealed"];
        if (state && state !== "waiting") return;
        if (state === "waiting") {
          observer?.observe(element);
          return;
        }
        const delay = Math.min(
          motion.stagger.limit,
          Math.max(0, Number(element.dataset["revealDelay"]) || 0),
        );
        element.style.setProperty("--reveal-delay", delay + "ms");
        const bounds = element.getBoundingClientRect();
        const visibleHeight = Math.max(
          0,
          Math.min(bounds.bottom, window.innerHeight) - Math.max(bounds.top, 0),
        );
        // Never hide content already painted in view, even below the 20% trigger.
        if (
          !observer ||
          preference.matches ||
          element.closest('[data-layout-active="true"]') ||
          (bounds.height > 0 && (bounds.bottom <= 0 || visibleHeight > 0))
        ) {
          completeReveal(element, "immediate");
        } else {
          element.dataset["revealed"] = "waiting";
          observer.observe(element);
        }
      });
    };
    const reduceMotion = () => {
      if (!preference.matches) return;
      observer?.disconnect();
      root
        .querySelectorAll<HTMLElement>("[data-reveal]")
        .forEach((element) => completeReveal(element, "immediate"));
      root.querySelectorAll<HTMLElement>(onceEntranceSelector).forEach(completeEntrance);
    };
    const finish = (event: AnimationEvent) => {
      if (!(event.target instanceof HTMLElement)) return;
      const element = event.target;
      if (element.matches("[data-reveal]") && element.dataset["revealed"] === "animate")
        completeReveal(element);
      if (element.matches(onceEntranceSelector)) completeEntrance(element);
    };
    const showFocusedContent = (event: FocusEvent) => {
      if (!(event.target instanceof Element)) return;
      const reveal = event.target.closest<HTMLElement>("[data-reveal]");
      if (reveal) {
        observer?.unobserve(reveal);
        completeReveal(reveal, "immediate");
      }
      const entrance = event.target.closest<HTMLElement>(onceEntranceSelector);
      if (entrance) completeEntrance(entrance);
    };
    register();
    reduceMotion();
    const mutations =
      typeof MutationObserver === "function"
        ? new MutationObserver((records) => {
            for (const record of records)
              record.removedNodes.forEach((node) => {
                if (!(node instanceof Element) || root.contains(node)) return;
                observer?.unobserve(node);
                node
                  .querySelectorAll("[data-reveal]")
                  .forEach((element) => observer?.unobserve(element));
              });
            register();
            reduceMotion();
          })
        : null;
    mutations?.observe(root, { childList: true, subtree: true });
    preference.addEventListener("change", reduceMotion);
    root.addEventListener("focusin", showFocusedContent);
    root.addEventListener("animationend", finish);
    return () => {
      observer?.disconnect();
      mutations?.disconnect();
      preference.removeEventListener("change", reduceMotion);
      root.removeEventListener("focusin", showFocusedContent);
      root.removeEventListener("animationend", finish);
      // Preserve all visual/latch states. The DOM disappears on a real unmount.
    };
  }, []);

  return (
    <div
      {...props}
      style={{ ...motionStyle, ...props.style }}
      ref={ref}
      className={"storefront-motion " + className}
    />
  );
}
