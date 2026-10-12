import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { JSDOM, VirtualConsole } from "jsdom";

// Real production SSR/client with read-only fixtures for the not-yet-applied
// schema. Run once for / and once for /catalogo after bun run build.
const pathname = process.argv[2] ?? "/catalogo";
assert.ok(["/", "/catalogo"].includes(pathname));
const categories = [
  { id: "a", name: "Bouquets", slug: "bouquets" },
  { id: "b", name: "Caixas", slug: "caixas" },
];
const products = Array.from({ length: 6 }, (_, index) => ({
  id: `product-${index}`,
  name: index === 0 ? "Caixa de Flores" : index === 1 ? "Caixa mini" : `Bouquet ${index}`,
  slug: `product-${index}`,
  short_description: "Flores artesanais",
  description: "Feito à mão",
  price: [25, 10, 12, 30, 5, 18][index],
  old_price: index === 0 ? 30 : null,
  main_image: `https://photos.test/product-${index}.webp`,
  featured: index < 5,
  customizable: true,
  available: index !== 1,
  sort_order: index,
  created_at: "2026-10-12T00:00:00Z",
  product_categories: (index === 0
    ? categories
    : index === 1
      ? [categories[1]]
      : index === 5
        ? []
        : [categories[0]]
  ).map((category) => ({ categories: category })),
}));
const productReads = [];
async function backendFetch(input, init) {
  const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
  if (url.pathname.endsWith("/rest/v1/products")) {
    assert.equal(url.searchParams.get("active"), "eq.true");
    assert.ok(
      url.searchParams.get("select").includes("product_categories(categories(id,name,slug))"),
    );
    productReads.push(url);
    return Response.json(products);
  }
  if (url.pathname.endsWith("/rest/v1/categories")) return Response.json(categories);
  if (/\/rest\/v1\/(site_settings|gallery_images)$/.test(url.pathname)) return Response.json([]);
  throw new Error(`Unmocked read-only fixture request: ${url.pathname}`);
}
const errors = [];
const originalError = console.error;
console.error = (...args) => errors.push(args.map(String).join(" "));
globalThis.fetch = backendFetch;
const { default: app } = await import("../dist/server/server.js");
const response = await app.fetch(
  new Request(`http://localhost:8080${pathname}`, { headers: { accept: "text/html" } }),
);
assert.equal(response.status, 200);
const html = (await response.text()).replace(
  /(<meta charSet="utf-8"\/>)/,
  "$1\n<!-- This site is hosted on Netlify. Anyone can build and deploy a site like this one for free: https://netlify.new/ -->",
);
const virtualConsole = new VirtualConsole();
virtualConsole.on("jsdomError", (error) => errors.push(String(error)));
virtualConsole.on("error", (...args) => errors.push(args.map(String).join(" ")));
const dom = new JSDOM(html, {
  url: `http://localhost:8080${pathname}`,
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
const cards = () => [...document.querySelectorAll("article[data-product-id]")];
const ids = () => cards().map((card) => card.dataset.productId);
const originalCards = cards();
assert.equal(originalCards.length, pathname === "/" ? 4 : 6);
assert.equal(new Set(ids()).size, originalCards.length);
const hero = pathname === "/" ? document.querySelector('[data-image-trigger="mount"] img') : null;
if (hero) {
  assert.equal(hero.getAttribute("loading"), "eager");
  assert.equal(hero.getAttribute("fetchpriority"), "high");
}
const entry = [...document.scripts]
  .find((script) => script.type === "module" && script.src)
  ?.getAttribute("src");
assert.ok(entry);
async function waitFor(check) {
  const deadline = Date.now() + 5000;
  while (!check()) {
    assert.ok(
      Date.now() < deadline,
      `Production hydration/filter timed out: ${JSON.stringify({ errors, products: ids(), productReads: productReads.length })}`,
    );
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}
await import(pathToFileURL(resolve("dist/client", "." + entry)));
await waitFor(() => cards()[0]?.querySelector("[data-revealed]"));
assert.deepEqual(cards(), originalCards, "Hydration must preserve all SSR product cards");
if (hero) {
  assert.equal(document.querySelector('[data-image-trigger="mount"] img'), hero);
}
if (pathname === "/catalogo") {
  const click = (label) =>
    [...document.querySelectorAll("button")]
      .find((button) => button.textContent.trim() === label)
      .click();
  click("Caixas");
  await waitFor(() => ids().length === 2);
  assert.deepEqual(ids(), ["product-0", "product-1"]);
  click("Bouquets");
  await waitFor(() => ids().length === 4);
  assert.ok(ids().includes("product-0"));
  click("Todos");
  await waitFor(() => ids().length === 6);
  assert.equal(new Set(ids()).size, 6);
  click("Até 15€");
  await waitFor(() => ids().length === 3);
  const sort = document.querySelector("select");
  sort.value = "asc";
  sort.dispatchEvent(new Event("change", { bubbles: true }));
  await waitFor(() => ids()[0] === "product-4");
  assert.deepEqual(ids(), ["product-4", "product-1", "product-2"]);
}
assert.deepEqual(errors, [], "SSR and hydration must produce no console errors");
console.error = originalError;
console.log(
  JSON.stringify({
    productionHydration: "passed",
    pathname,
    ssrProducts: originalCards.length,
    uniqueProducts: true,
    multiCategoryFilters: pathname === "/catalogo",
    productReads: productReads.length,
    consoleErrors: errors.length,
  }),
);
window.close();
process.exit(0);
