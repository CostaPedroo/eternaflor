import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  type HTMLAttributes,
} from "react";
import { animatePhotoOrLayout, motion, reducedMotion } from "@/lib/storefront-motion";

type Position = {
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: string;
  node: HTMLElement;
};
export type AnimatedGridHandle = { capture: () => void };

/** FLIP: read before the filter changes, then invert/play the committed layout. */
export const AnimatedGrid = forwardRef<AnimatedGridHandle, HTMLAttributes<HTMLDivElement>>(
  function AnimatedGrid({ children, className = "", ...props }, forwardedRef) {
    const root = useRef<HTMLDivElement>(null);
    const overlay = useRef<HTMLDivElement>(null);
    const previous = useRef(new Map<string, Position>());
    const captured = useRef<Map<string, Position> | null>(null);
    const previousHeight = useRef(0);
    const capturedHeight = useRef<number | null>(null);
    const animations = useRef(new Set<Animation>());
    const mounted = useRef(false);

    const cards = () => [
      ...(root.current?.querySelectorAll<HTMLElement>(":scope > [data-product-id]") ?? []),
    ];
    const measure = () => {
      const origin = root.current?.getBoundingClientRect();
      const result = new Map<string, Position>();
      if (!origin) return result;
      for (const card of cards()) {
        const rect = card.getBoundingClientRect();
        result.set(card.dataset["productId"]!, {
          x: rect.left - origin.left,
          y: rect.top - origin.top,
          width: rect.width,
          height: rect.height,
          opacity: getComputedStyle(card).opacity,
          node: card,
        });
      }
      return result;
    };
    const cancel = () => {
      animations.current.forEach((animation) => animation.cancel());
      animations.current.clear();
      overlay.current?.replaceChildren();
    };
    const play = (
      element: HTMLElement,
      frames: Keyframe[],
      options: KeyframeAnimationOptions = {},
      finish?: () => void,
    ) => {
      const animation = animatePhotoOrLayout(element, frames, options);
      if (!animation) {
        finish?.();
        return;
      }
      animations.current.add(animation);
      void animation.finished.then(
        () => {
          animations.current.delete(animation);
          finish?.();
        },
        () => {
          animations.current.delete(animation);
        },
      );
    };
    useImperativeHandle(forwardedRef, () => ({
      capture() {
        // Retarget from the currently painted position, even mid-animation.
        captured.current = measure();
        capturedHeight.current = root.current?.getBoundingClientRect().height ?? 0;
        cancel();
      },
    }));

    useLayoutEffect(() => {
      const before = captured.current ?? previous.current;
      const beforeHeight = capturedHeight.current ?? previousHeight.current;
      captured.current = null;
      capturedHeight.current = null;
      if (mounted.current && root.current) {
        cancel();
        root.current.dataset["layoutActive"] = "true";
        cards().forEach((card) => {
          card.dataset["revealed"] = "immediate";
        });
      }
      const after = measure();
      const afterHeight = root.current?.getBoundingClientRect().height ?? 0;
      if (mounted.current && root.current) {
        let entering = 0;
        for (const card of cards()) {
          const id = card.dataset["productId"]!;
          const old = before.get(id);
          const next = after.get(id)!;
          if (old) {
            const x = old.x - next.x,
              y = old.y - next.y;
            const sx = next.width ? old.width / next.width : 1;
            const sy = next.height ? old.height / next.height : 1;
            if (x || y || sx !== 1 || sy !== 1 || old.opacity !== "1")
              play(card, [
                {
                  transform: `translate(${x}px, ${y}px) scale(${sx}, ${sy})`,
                  transformOrigin: "top left",
                  opacity: old.opacity || "1",
                },
                { transform: "none", transformOrigin: "top left", opacity: 1 },
              ]);
          } else {
            play(
              card,
              [
                {
                  opacity: 0,
                  transform: `translateY(${motion.distance.enter}px) scale(${motion.scale.card})`,
                },
                { opacity: 1, transform: "none" },
              ],
              {
                delay: Math.min(entering++ * motion.stagger.layout, motion.stagger.limit),
                fill: "backwards",
              },
            );
          }
        }
        if (!reducedMotion())
          for (const [id, old] of before) {
            if (after.has(id) || !overlay.current) continue;
            // Only exiting cards need a copy. It has no live product identity/actions.
            const ghost = document.createElement("div");
            ghost.className = old.node.className;
            ghost.innerHTML = old.node.innerHTML;
            ghost.setAttribute("aria-hidden", "true");
            ghost.inert = true;
            ghost.querySelectorAll("[id]").forEach((node) => node.removeAttribute("id"));
            ghost
              .querySelectorAll("a, button, input, select, textarea, [tabindex]")
              .forEach((node) => node.setAttribute("tabindex", "-1"));
            Object.assign(ghost.style, {
              position: "absolute",
              left: `${old.x}px`,
              top: `${old.y}px`,
              width: `${old.width}px`,
              height: `${old.height}px`,
              pointerEvents: "none",
            });
            overlay.current.append(ghost);
            play(
              ghost,
              [
                { opacity: old.opacity, transform: "none" },
                {
                  opacity: 0,
                  transform: `translateY(${motion.distance.exit}px) scale(${motion.scale.card})`,
                },
              ],
              { duration: motion.duration.layout },
              () => ghost.remove(),
            );
          }
        // The only grid layout property we animate: retain room for exiting rows,
        // clip incoming rows while growing, and let the footer follow smoothly.
        if (beforeHeight !== afterHeight)
          play(root.current, [
            { height: `${beforeHeight}px`, overflow: "clip" },
            { height: `${afterHeight}px`, overflow: "clip" },
          ]);
      }
      mounted.current = true;
      previous.current = after;
      previousHeight.current = afterHeight;
    }, [children]);

    useEffect(() => {
      const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
      const onPreference = () => {
        if (preference.matches) cancel();
      };
      const onResize = () => {
        cancel();
        previous.current = measure();
        previousHeight.current = root.current?.getBoundingClientRect().height ?? 0;
      };
      preference.addEventListener("change", onPreference);
      window.addEventListener("resize", onResize);
      const grid = root.current;
      grid?.addEventListener("focusin", cancel);
      return () => {
        cancel();
        preference.removeEventListener("change", onPreference);
        window.removeEventListener("resize", onResize);
        grid?.removeEventListener("focusin", cancel);
      };
    }, []);
    return (
      <div {...props} ref={root} className={`storefront-grid ${className}`}>
        {children}
        <div ref={overlay} className="storefront-grid-exits" aria-hidden inert />
      </div>
    );
  },
);
