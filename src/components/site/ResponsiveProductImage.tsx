import { useState } from "react";
import { mobileProductImageSources } from "@/lib/responsive-images";

export function ResponsiveProductImage({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className: string;
}) {
  const [originalOnly, setOriginalOnly] = useState<string | null>(null);
  const sources = mobileProductImageSources(src);
  return (
    <picture>
      {sources && originalOnly !== src && (
        <source media="(max-width: 767px)" srcSet={sources} sizes="calc((100vw - 4rem) / 2)" />
      )}
      <img
        key={src}
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        className={className}
        onLoad={(event) => {
          event.currentTarget.style.visibility = "";
        }}
        onError={(event) => {
          const image = event.currentTarget;
          if (sources && originalOnly !== src && image.currentSrc !== image.src) {
            // A resized variant may fail independently. Retry the original before
            // using the card's existing placeholder; never show a broken glyph.
            image.style.visibility = "hidden";
            setOriginalOnly(src);
          } else {
            image.style.display = "none";
          }
        }}
      />
    </picture>
  );
}
