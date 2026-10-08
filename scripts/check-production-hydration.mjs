import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { JSDOM, VirtualConsole } from "jsdom";

// Run after bun run build. Exercise the built SSR and real TanStack client
// bootstrap, including Netlify's observed HTML annotation; no browser UI needed.
const { default: app } = await import("../dist/server/server.js");
const response = await app.fetch(
  new Request("http://localhost:8080/", { headers: { accept: "text/html" } }),
);
assert.equal(response.status, 200);
const html = await response.text();
const annotation =
  "\n<!-- This site is hosted on Netlify. Anyone can build and deploy a site like this one for free: https://netlify.new/ -->";
const delivered = html.replace(/(<meta charSet="utf-8"\/>)/, "$1" + annotation);
assert.notEqual(delivered, html, "The fixture must include the hosting annotation");
const errors = [];
const virtualConsole = new VirtualConsole();
virtualConsole.on("jsdomError", (error) => errors.push(String(error)));
virtualConsole.on("error", (...args) => errors.push(args.map(String).join(" ")));
const dom = new JSDOM(delivered, {
  url: "http://localhost:8080/",
  runScripts: "dangerously",
  pretendToBeVisual: true,
  virtualConsole,
  beforeParse(window) {
    window.scrollTo = () => {};
  },
});
const window = dom.window;
window.matchMedia = (media) => ({
  matches: false,
  media,
  addEventListener() {},
  removeEventListener() {},
});
const nativeFetch = globalThis.fetch;
window.fetch = (input, init) => {
  const request = new Request(
    new URL(typeof input === "string" ? input : input.url, window.location.href),
    init,
  );
  return request.url.startsWith(window.location.origin) ? app.fetch(request) : nativeFetch(request);
};
for (const key of [
  "window",
  "document",
  "navigator",
  "location",
  "history",
  "localStorage",
  "sessionStorage",
  "HTMLElement",
  "HTMLImageElement",
  "Element",
  "Node",
  "MutationObserver",
  "CustomEvent",
  "Event",
]) {
  Object.defineProperty(globalThis, key, { configurable: true, value: window[key] });
}
globalThis.self = window;
globalThis.fetch = window.fetch;
for (const key of [
  "requestAnimationFrame",
  "cancelAnimationFrame",
  "getComputedStyle",
  "addEventListener",
  "removeEventListener",
  "scrollTo",
])
  globalThis[key] = window[key].bind(window);
const frame = document.querySelector('[data-image-trigger="mount"]');
assert.ok(frame);
const scale = frame.querySelector("[data-image-scale]");
const image = frame.querySelector("img");
const src = image.getAttribute("src");
const frameMarkup = [
  frame.getAttribute("class"),
  frame.getAttribute("style"),
  frame.getAttribute("data-image-trigger"),
];
const motionStyle = frame.closest(".storefront-motion").getAttribute("style");
assert.equal(image.getAttribute("loading"), "eager");
assert.equal(image.getAttribute("fetchpriority"), "high");
assert.equal(frame.hasAttribute("data-reveal"), false);
const entry = [...document.scripts]
  .find((script) => script.type === "module" && script.src)
  ?.getAttribute("src");
assert.ok(entry);
const originalError = console.error;
console.error = (...args) => errors.push(args.map(String).join(" "));
async function waitFor(check) {
  const deadline = Date.now() + 5000;
  while (!check()) {
    assert.ok(Date.now() < deadline, "Production hydration/decode timed out");
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}
await import(pathToFileURL(resolve("dist/client", "." + entry)));
await waitFor(() => image.dataset.imageState === "loading");
assert.equal(
  document.querySelector('[data-image-trigger="mount"]'),
  frame,
  "Hydration must retain the SSR hero frame",
);
assert.equal(frame.querySelector("[data-image-scale]"), scale);
assert.equal(frame.querySelector("img"), image);
assert.equal(image.getAttribute("src"), src, "SSR and hydrated hero URL must match");
assert.deepEqual(
  [
    frame.getAttribute("class"),
    frame.getAttribute("style"),
    frame.getAttribute("data-image-trigger"),
  ],
  frameMarkup,
);
assert.equal(frame.closest(".storefront-motion").getAttribute("style"), motionStyle);
Object.defineProperty(image, "naturalWidth", { value: 1080 });
let decodeCalls = 0;
let finishDecode;
const decoded = new Promise((resolve) => {
  finishDecode = resolve;
});
Object.defineProperty(image, "decode", {
  value: () => {
    decodeCalls++;
    return decoded;
  },
});
image.dispatchEvent(new Event("load"));
image.dispatchEvent(new Event("load"));
finishDecode();
await waitFor(() => image.dataset.imageState === "ready");
assert.equal(decodeCalls, 1);
assert.equal(frame.querySelector("img"), image);
frame.dispatchEvent(new Event("animationend", { bubbles: true }));
scale.dispatchEvent(new Event("animationend", { bubbles: true }));
assert.equal(frame.dataset.motionComplete, "true");
assert.equal(scale.dataset.motionComplete, "true");
assert.deepEqual(errors, [], "Production hydration must not recover or emit console errors");
console.error = originalError;
console.log(
  JSON.stringify({
    productionHydration: "passed",
    netlifyAnnotation: true,
    sameHeroFrame: true,
    sameHeroUrl: true,
    decodeCalls,
    consoleErrors: errors.length,
  }),
);
dom.window.close();
process.exit(0);
