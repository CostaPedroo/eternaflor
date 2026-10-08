import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { animatePhotoOrLayout, motion, reducedMotion } from "@/lib/storefront-motion";

/** A decoded source change is the sole owner of gallery opacity/scale. */
export function CrossfadeImage({
  src,
  alt,
  onError,
}: {
  src: string;
  alt: string;
  onError: () => void;
}) {
  const incoming = useRef<HTMLImageElement>(null);
  const outgoing = useRef<HTMLImageElement>(null);
  const [loaded, setLoaded] = useState<string | null>(null);
  const [previous, setPrevious] = useState<string | null>(null);
  const intent = useRef({ src, changed: false });
  const animations = useRef<Animation[]>([]);
  const decoding = useRef(new WeakSet<HTMLImageElement>());
  const stop = () => {
    animations.current.forEach((animation) => animation.cancel());
    animations.current = [];
  };

  useLayoutEffect(() => {
    const changed = intent.current.src !== src;
    intent.current = { src, changed };
    stop();
    setPrevious(changed && !reducedMotion() ? loaded : null);
    const photo = incoming.current;
    // Initial SSR/first load stays visible; only a new source is prepared for crossfade.
    if (photo && changed && !reducedMotion() && typeof photo.animate === "function")
      photo.style.opacity = "0";
    if (photo?.complete && photo.naturalWidth) void decodePhoto(photo);
    // Source is the trigger; loaded state and parent rerenders must not retrigger it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  async function decodePhoto(photo: HTMLImageElement) {
    if (decoding.current.has(photo)) return;
    decoding.current.add(photo);
    try {
      if (typeof photo.decode === "function") await photo.decode();
    } catch {
      /* Native load remains usable. */
    }
    if (incoming.current !== photo) return;
    photo.dataset["loaded"] = "true";
    photo.style.opacity = "";
    setLoaded(src);
    if (!intent.current.changed || intent.current.src !== src || reducedMotion()) {
      setPrevious(null);
      return;
    }
    intent.current.changed = false;
    const oldPhoto = outgoing.current;
    const fadeIn = animatePhotoOrLayout(
      photo,
      [
        { opacity: 0, transform: "scale(" + motion.scale.gallery + ")" },
        { opacity: 1, transform: "none" },
      ],
      { duration: motion.duration.gallery },
    );
    const fadeOut =
      oldPhoto &&
      animatePhotoOrLayout(oldPhoto, [{ opacity: 1 }, { opacity: 0 }], {
        duration: motion.duration.gallery,
        fill: "forwards",
      });
    const running = [fadeIn, fadeOut].filter((animation): animation is Animation => !!animation);
    animations.current = running;
    if (!running.length) {
      setPrevious(null);
      return;
    }
    void Promise.all(running.map((animation) => animation.finished)).then(
      () => {
        // Preserve final opacity before removing filled animation objects/React's old layer.
        if (oldPhoto) oldPhoto.style.opacity = "0";
        running.forEach((animation) => animation.cancel());
        animations.current = animations.current.filter((animation) => !running.includes(animation));
        if (incoming.current === photo) setPrevious(null);
      },
      () => {},
    );
  }

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      if (!preference.matches) return;
      stop();
      setPrevious(null);
      if (incoming.current) incoming.current.style.opacity = "";
    };
    preference.addEventListener("change", update);
    return () => {
      stop();
      preference.removeEventListener("change", update);
    };
  }, []);

  return (
    <>
      {previous && previous !== src && (
        <img
          key={previous}
          ref={outgoing}
          src={previous}
          alt=""
          aria-hidden
          draggable={false}
          className="gallery-photo absolute inset-0 h-full w-full object-contain"
        />
      )}
      <img
        key={src}
        ref={incoming}
        src={src}
        alt={alt}
        decoding="async"
        draggable={false}
        className="gallery-photo relative h-full w-full object-contain"
        onLoad={(event) => void decodePhoto(event.currentTarget)}
        onError={(event) => {
          event.currentTarget.style.visibility = "hidden";
          onError();
        }}
      />
    </>
  );
}
