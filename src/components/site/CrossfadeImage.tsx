import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { animatePhotoOrLayout, motion, reducedMotion } from "@/lib/storefront-motion";

/** Retain the decoded outgoing photo until the incoming photo can be painted. */
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
  const animations = useRef<Animation[]>([]);
  const decoding = useRef(new WeakSet<HTMLImageElement>());
  const stop = () => {
    animations.current.forEach((animation) => animation.cancel());
    animations.current = [];
  };

  useLayoutEffect(() => {
    stop();
    setPrevious(!reducedMotion() && loaded !== src ? loaded : null);
    if (reducedMotion()) setLoaded(null);
    const photo = incoming.current;
    if (photo && !photo.complete && !reducedMotion() && typeof photo.animate === "function")
      photo.style.opacity = "0";
    if (photo?.complete && photo.naturalWidth) void reveal(photo);
    // The keyed ref and src comparison reject stale decode/completion callbacks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  async function reveal(photo: HTMLImageElement) {
    if (decoding.current.has(photo)) return;
    decoding.current.add(photo);
    try {
      if (typeof photo.decode === "function") await photo.decode();
    } catch {
      /* Native load remains usable. */
    }
    if (incoming.current !== photo) return;
    stop();
    photo.dataset["loaded"] = "true";
    photo.style.opacity = "";
    setLoaded(src);
    const fadeIn = animatePhotoOrLayout(
      photo,
      [
        { opacity: 0, transform: `scale(${motion.scale.gallery})` },
        { opacity: 1, transform: "none" },
      ],
      { duration: motion.duration.gallery },
    );
    const fadeOut =
      outgoing.current &&
      animatePhotoOrLayout(outgoing.current, [{ opacity: 1 }, { opacity: 0 }], {
        duration: motion.duration.gallery,
        fill: "forwards",
      });
    animations.current = [fadeIn, fadeOut].filter(
      (animation): animation is Animation => !!animation,
    );
    if (fadeIn)
      void fadeIn.finished.then(
        () => {
          if (incoming.current === photo) setPrevious(null);
        },
        () => {},
      );
    else setPrevious(null);
  }

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      if (!preference.matches) return;
      stop();
      setPrevious(null);
      setLoaded(null);
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
      {(previous ?? (loaded !== src ? loaded : null)) && (previous ?? loaded) !== src && (
        <img
          ref={outgoing}
          src={(previous ?? loaded)!}
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
        onLoad={(event) => void reveal(event.currentTarget)}
        onError={onError}
      />
    </>
  );
}
