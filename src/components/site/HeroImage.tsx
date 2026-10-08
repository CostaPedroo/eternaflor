import { useCallback, useEffect, useRef, useState } from "react";

type Props = { src: string | null | undefined; fallbackSrc: string; alt: string };

/** The real URL is in SSR HTML. Loading/decoding never waits for a separate Image() preload. */
export function HeroImage({ src, fallbackSrc, alt }: Props) {
  return <HeroPhoto src={src || fallbackSrc} fallbackSrc={fallbackSrc} alt={alt} />;
}

function HeroPhoto({ src, fallbackSrc, alt }: { src: string; fallbackSrc: string; alt: string }) {
  const ref = useRef<HTMLImageElement>(null);
  const [failures, setFailures] = useState<{ source: string; urls: string[] }>({
    source: src,
    urls: [],
  });
  const failed = failures.source === src ? failures.urls : [];
  const decoding = useRef(new WeakSet<HTMLImageElement>());
  const [phase, setPhase] = useState<{ url: string; state: "loading" | "ready" | "cached" } | null>(
    null,
  );
  const url = [src, fallbackSrc].find((candidate) => !failed.includes(candidate));

  const fail = useCallback(
    (image: HTMLImageElement, failedUrl: string) => {
      if (ref.current !== image) return;
      // Hide the failing node immediately, before React replaces it with the default image.
      image.style.visibility = "hidden";
      setFailures((previous) => ({
        source: src,
        urls: previous.source === src ? [...new Set([...previous.urls, failedUrl])] : [failedUrl],
      }));
    },
    [src],
  );
  const decodePhoto = useCallback(
    async (image: HTMLImageElement, loadedUrl: string, cached: boolean) => {
      if (decoding.current.has(image)) return;
      decoding.current.add(image);
      try {
        if (typeof image.decode === "function") await image.decode();
      } catch {
        // A decode interruption can still leave a usable native image (e.g. browser cache).
      }
      if (ref.current !== image) return;
      if (!image.naturalWidth) {
        fail(image, loadedUrl);
        return;
      }
      setPhase({ url: loadedUrl, state: cached ? "cached" : "ready" });
    },
    [fail],
  );

  useEffect(() => {
    const image = ref.current;
    if (!image || !url) return;
    if (image.complete) {
      // Do not re-hide an image that was already painted from the server HTML.
      void decodePhoto(image, url, true);
    } else {
      setPhase({ url, state: "loading" });
    }
    // The keyed image ref prevents an old decode from revealing a new source.
  }, [url, decodePhoto]);

  return (
    <img
      key={url ?? "failed"}
      ref={ref}
      src={url ?? fallbackSrc}
      alt={alt}
      loading="eager"
      fetchPriority="high"
      decoding="async"
      data-hero="image"
      data-image-state={!url ? "failed" : phase?.url === url ? phase.state : undefined}
      style={{ color: "transparent", fontSize: 0, ...(!url ? { visibility: "hidden" } : {}) }}
      className="hero-image editorial-image h-full w-full object-cover"
      onLoad={(event) => {
        if (url) void decodePhoto(event.currentTarget, url, false);
      }}
      onError={(event) => {
        if (url) fail(event.currentTarget, url);
      }}
    />
  );
}
