import { useEffect, useState, type ImgHTMLAttributes } from "react";

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "onError"> & {
  src: string | null | undefined;
  fallbackSrc: string;
};

/** Keep the existing image visible until the configured photo has actually loaded. */
export function FallbackImage({ src, fallbackSrc, style, ...props }: Props) {
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const [fallbackFailed, setFallbackFailed] = useState(false);

  useEffect(() => {
    if (!src || src === fallbackSrc) return;
    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      if (!cancelled) {
        setLoadedSrc(src);
        setFallbackFailed(false);
      }
    };
    image.src = src;
    return () => {
      cancelled = true;
      image.onload = null;
    };
  }, [src, fallbackSrc]);

  const displayedSrc = src && loadedSrc === src ? src : fallbackSrc;
  return (
    <img
      {...props}
      src={displayedSrc}
      style={{ ...style, ...(fallbackFailed ? { visibility: "hidden" } : {}) }}
      onError={() => {
        if (displayedSrc === fallbackSrc) setFallbackFailed(true);
        else setLoadedSrc(null);
      }}
    />
  );
}
