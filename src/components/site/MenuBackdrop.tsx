import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { animatePhotoOrLayout, motion } from "@/lib/storefront-motion";

/** Closing stays mounted until its fade completes; no navigation/filter timers. */
export function MenuBackdrop({ open, close }: { open: boolean; close: () => void }) {
  const [present, setPresent] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open) setPresent(true);
  }, [open]);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    let cancelled = false;
    const animation = animatePhotoOrLayout(
      element,
      [{ opacity: open ? 0 : 1 }, { opacity: open ? 1 : 0 }],
      { duration: motion.duration.menu },
    );
    if (animation)
      void animation.finished.then(
        () => {
          if (!open) setPresent(false);
        },
        () => {},
      );
    else if (!open) setPresent(false);
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      if (preference.matches) {
        animation?.cancel();
        if (!cancelled && !open) setPresent(false);
      }
    };
    preference.addEventListener("change", update);
    return () => {
      cancelled = true;
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
