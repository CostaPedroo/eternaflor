import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { JSDOM, VirtualConsole } from "jsdom";

// Exercise production SSR + the real compiled client with deterministic backend
// fixtures. This never writes data or requires the migration to be live already.
const nativeFetch = globalThis.fetch;
const rows = Array.from({ length: 18 }, (_, index) => ({
  id: `gallery-${index}`,
  image_url: `https://photos.test/gallery-${index}.webp`,
  width: index % 2 ? 1400 : 1000,
  height: index % 2 ? 1000 : 1400,
}));
const reads = [];
async function backendFetch(input, init) {
  const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
  if (url.pathname.endsWith("/rest/v1/gallery_images")) {
    reads.push(url);
    assert.equal(url.searchParams.get("is_active"), "eq.true");
    assert.equal(url.searchParams.get("order"), "sort_order.asc,created_at.asc,id.asc");
    return Response.json(rows.slice(0, Number(url.searchParams.get("limit") || rows.length)));
  }
  if (/\/rest\/v1\/(products|categories|site_settings)$/.test(url.pathname))
    return Response.json([]);
  return nativeFetch(input, init);
}
globalThis.fetch = backendFetch;
const { default: app } = await import("../dist/server/server.js");
const home = await app.fetch(
  new Request("http://localhost:8080/", { headers: { accept: "text/html" } }),
);
assert.equal(home.status, 200);
const homeDom = new JSDOM(await home.text());
const preview = homeDom.window.document.querySelector(".gallery-grid-preview");
assert.equal(preview?.querySelectorAll("img").length, 6);
assert.equal(reads.length, 1);
assert.equal(reads[0].searchParams.get("limit"), "6");
const previewSection = preview.closest("section");
assert.equal(previewSection.querySelector("a").getAttribute("href"), "/galeria");
const faq = homeDom.window.document.querySelector("#faq");
assert.ok(previewSection.compareDocumentPosition(faq) & 4, "Preview belongs before FAQ");
homeDom.window.close();

const response = await app.fetch(
  new Request("http://localhost:8080/galeria", { headers: { accept: "text/html" } }),
);
assert.equal(response.status, 200);
assert.equal(reads.length, 2);
assert.equal(reads[1].searchParams.get("limit"), "500");
const html = (await response.text()).replace(
  /(<meta charSet="utf-8"\/>)/,
  "$1\n<!-- Netlify hosting annotation -->",
);
const errors = [];
const virtualConsole = new VirtualConsole();
virtualConsole.on("jsdomError", (error) => errors.push(String(error)));
virtualConsole.on("error", (...args) => errors.push(args.map(String).join(" ")));
const dom = new JSDOM(html, {
  url: "http://localhost:8080/galeria",
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
window.fetch = (input, init) => {
  const request = new Request(
    new URL(typeof input === "string" ? input : input.url, window.location.href),
    init,
  );
  return request.url.startsWith(window.location.origin)
    ? app.fetch(request)
    : backendFetch(request);
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
])
  Object.defineProperty(globalThis, key, { configurable: true, value: window[key] });
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
const grid = document.querySelector(".gallery-grid");
const photos = [...grid.querySelectorAll("img")];
assert.equal(photos.length, 18);
photos.forEach((photo, index) => {
  assert.equal(photo.getAttribute("src"), rows[index].image_url);
  assert.equal(photo.getAttribute("width"), String(rows[index].width));
  assert.equal(photo.getAttribute("height"), String(rows[index].height));
  assert.equal(photo.getAttribute("loading"), "lazy");
  assert.ok(photo.closest("[data-image-reveal]").getAttribute("style").includes("aspect-ratio"));
});
const originalError = console.error;
console.error = (...args) => errors.push(args.map(String).join(" "));
const entry = [...document.scripts]
  .find((script) => script.type === "module" && script.src)
  ?.getAttribute("src");
assert.ok(entry);
await import(pathToFileURL(resolve("dist/client", "." + entry)));
const deadline = Date.now() + 5000;
while (!grid.querySelector("[data-revealed]")) {
  assert.ok(Date.now() < deadline, "Gallery production hydration timed out");
  await new Promise((resolve) => setTimeout(resolve, 10));
}
assert.equal(document.querySelector(".gallery-grid"), grid);
assert.deepEqual([...grid.querySelectorAll("img")], photos, "Hydration preserves every SSR image");
assert.equal(document.querySelector("[role='dialog']"), null);
assert.equal(reads.length, 2, "Hydration must reuse loader data without another gallery fetch");
assert.deepEqual(errors, [], "Gallery hydration must not recover or log errors");
console.error = originalError;
console.log(
  JSON.stringify({
    galleryProductionHydration: "passed",
    ssrImages: 18,
    previewImages: 6,
    galleryBackendReads: reads.length,
    sameImageNodes: true,
    consoleErrors: errors.length,
  }),
);
window.close();
process.exit(0);
