import type { HTMLAttributes } from "react";

/** Masks the existing frame without moving it or postponing the image request. */
export function ImageReveal({
  direction = "left",
  trigger = "scroll",
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  direction?: "left" | "right";
  trigger?: "scroll" | "mount";
}) {
  return (
    <div
      {...props}
      data-image-reveal={direction}
      data-image-trigger={trigger}
      {...(trigger === "scroll" ? { "data-reveal": "image" } : {})}
    >
      <div data-image-scale className="image-reveal-scale h-full w-full">
        {children}
      </div>
    </div>
  );
}
