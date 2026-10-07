import type { HTMLAttributes } from "react";

/** Masks the existing frame without moving it or postponing the image request. */
export function ImageReveal({
  direction = "left",
  trigger = "scroll",
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  direction?: "left" | "right";
  trigger?: "scroll" | "load";
}) {
  return (
    <div
      {...props}
      data-image-reveal={direction}
      data-image-trigger={trigger}
      {...(trigger === "scroll" ? { "data-reveal": "image" } : {})}
    />
  );
}
