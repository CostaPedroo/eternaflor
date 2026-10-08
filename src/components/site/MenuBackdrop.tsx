import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { animatePhotoOrLayout, motion } from "@/lib/storefront-motion";

/** Closing stays mounted until its fade completes; no navigation/filter timers. */
export function MenuBackdrop({ open, close }: { open: boolean; close: () => void }) {
  const [present, setPresent] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open) setPresent(true);
  }, [open]);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    let cancelled = false;
    if (!element.dataset["backdropReady"]) {
      element.style.opacity = "0";
      element.dataset["backdropReady"] = "true";
    }
    const from = getComputedStyle(element).opacity || element.style.opacity;
    const to = open ? "1" : "0";
    const animation = animatePhotoOrLayout(element, [{ opacity: from }, { opacity: to }], {
      duration: motion.duration.menu,
      fill: "forwards",
    });
    if (animation)
      void animation.finished.then(
        () => {
          if (cancelled) return;
          element.style.opacity = to;
          animation.cancel();
          if (!open) setPresent(false);
        },
        () => {},
      );
    else {
      element.style.opacity = to;
      if (!open) setPresent(false);
    }
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      if (preference.matches) {
        element.style.opacity = to;
        animation?.cancel();
        if (!cancelled && !open) setPresent(false);
      }
    };
    preference.addEventListener("change", update);
    return () => {
      cancelled = true;
      element.style.opacity = getComputedStyle(element).opacity || element.style.opacity;
      animation?.cancel();
      preference.removeEventListener("change", update);
    };
  }, [open, present]);
  return present
    ? createPortal(
        <div
          ref={ref}
          aria-hidden
          onClick={close}
          className="storefront-menu-backdrop fixed inset-0 z-30 bg-foreground/10 lg:hidden"
        />,
        document.body,
      )
    : null;
}
