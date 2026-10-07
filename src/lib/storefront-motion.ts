import type { CSSProperties } from "react";

/** Shared by CSS reveals and native layout/photo transitions; public storefront only. */
export const motion = {
  ease: "cubic-bezier(0.22, 1, 0.36, 1)",
  threshold: 0.2,
  duration: {
    reveal: 850,
    heading: 800,
    image: 1050,
    hero: 800,
    page: 400,
    layout: 420,
    gallery: 300,
    menu: 240,
    interaction: 220,
    nav: 250,
    hover: 500,
    footer: 950,
  },
  stagger: { item: 80, layout: 40, menu: 35, limit: 240 },
  hero: { title: 80, intro: 160, cta: 240, image: 180, label: 320 },
  distance: {
    reveal: 40,
    mobile: 26,
    heading: 30,
    card: 35,
    split: 35,
    page: 10,
    enter: 12,
    exit: 8,
    menu: 6,
    menuLink: 4,
    title: 2,
  },
  iconAngle: 3,
  scale: { image: 1.04, hover: 1.035, gallery: 1.015, card: 0.97, section: 0.98, press: 0.98 },
} as const;

export const motionStyle = {
  "--storefront-ease": motion.ease,
  ...Object.fromEntries(
    Object.entries(motion.duration).map(([key, value]) => [`--motion-${key}`, `${value}ms`]),
  ),
  ...Object.fromEntries(
    Object.entries(motion.hero).map(([key, value]) => [`--hero-${key}-delay`, `${value}ms`]),
  ),
  "--reveal-desktop": `${motion.distance.reveal}px`,
  "--reveal-mobile": `${motion.distance.mobile}px`,
  "--heading-desktop": `${motion.distance.heading}px`,
  "--card-desktop": `${motion.distance.card}px`,
  "--split-desktop": `${motion.distance.split}px`,
  "--page-distance": `${motion.distance.page}px`,
  "--menu-distance": `${motion.distance.menu}px`,
  "--menu-link-distance": `${motion.distance.menuLink}px`,
  "--title-distance": `${motion.distance.title}px`,
  "--icon-angle": `${motion.iconAngle}deg`,
  "--image-scale": motion.scale.image,
  "--hover-scale": motion.scale.hover,
  "--section-scale": motion.scale.section,
  "--press-scale": motion.scale.press,
  "--item-stagger": `${motion.stagger.item}ms`,
  "--menu-stagger": `${motion.stagger.menu}ms`,
  "--stagger-limit": `${motion.stagger.limit}ms`,
} as CSSProperties;

export function reducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** No timers, and a functional immediate fallback in browsers without WAAPI. */
export function animatePhotoOrLayout(
  element: HTMLElement,
  frames: Keyframe[],
  options: KeyframeAnimationOptions = {},
) {
  if (reducedMotion() || typeof element.animate !== "function") return null;
  const animation = element.animate(frames, {
    duration: motion.duration.layout,
    easing: motion.ease,
    ...options,
  });
  // Cancellation is expected during rapid interaction, resize and navigation.
  void animation.finished.catch(() => {});
  return animation;
}
