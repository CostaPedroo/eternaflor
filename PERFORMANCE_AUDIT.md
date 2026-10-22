# Mobile performance audit — 22 October 2026

## Measurement and results

The hero photograph is the homepage LCP element. Its URL is already present in SSR,
eagerly loaded with high priority; hydration does not need to discover it.

Production was measured **before** changes only. The supplied PageSpeed result was
76 / FCP 3.2 s / LCP 4.5 s. Two additional live Lighthouse samples ranged from
73–85, FCP 2.18–3.09 s and LCP 3.71–5.46 s. This variability makes a single live
sample unsuitable as an optimization comparison. No deployment was performed.

The comparison below uses production builds of baseline commit `d1efbc6` and the
working tree, HTTP/2 + gzip, identical read-only public-data fixtures, warm SSR
with a 500 ms minimum response time, and cold browser caches. Lighthouse 13.5.0
ran in Edge 155 at 390×844, DPR 3, CPU ×4, simulated RTT 150 ms / 1,638.4 Kbit/s.
Each homepage figure is the median of three runs. Supabase image delivery still
uses the network, so CDN/network variation remains possible.

| Homepage, simulated mobile | Before | After |
| --- | ---: | ---: |
| Performance | 79 | 82 |
| FCP | 2.87 s | 2.78 s |
| LCP | 4.46 s | 4.10 s |
| TBT | 0 ms | 17.5 ms |
| CLS | 0 | 0 |
| Transferred resources | 1,362,755 B | 1,046,020 B |
| JavaScript transferred | 277,266 B | 261,938 B |
| Images transferred | 932,419 B | 630,592 B |

FCP improved only slightly (3%); LCP improved 8%, with 23% less total transfer.
These are local lab measurements, **not updated production PageSpeed scores**.

A second three-run comparison applied throttling directly in the browser
(562.5 ms request latency, 1,474.56 Kbit/s download, 675 Kbit/s upload, CPU ×4):
FCP 2.291 → 2.294 s, LCP 7.906 → 5.696 s, TBT 48.85 → 5.79 ms, CLS 0 → 0.
The first cold SSR initialization run was excluded; retained runs had comparable
TTFB (median 507 → 515 ms). The applied and simulated methods must not be mixed.

Other routes had one comparable simulated mobile sample each:

| Route | FCP before → after | LCP before → after | Transfer before → after |
| --- | --- | --- | --- |
| `/catalogo` | 2.58 → 2.58 s | 5.95 → 4.93 s | 2.93 → 1.53 MB |
| `/galeria` | 2.43 → 2.43 s | 9.29 → 9.35 s | 2.67 → 2.67 MB |

Gallery results are effectively unchanged. Product details are a modal, and the
custom form is part of the homepage; both were tested as interactions. Field INP
was unavailable; Lighthouse TBT is not a substitute for a field INP measurement.

## Evidence and retained changes

- **Mobile image bandwidth:** the original hero is 1080×1350, about 270 KB. A
  visually checked Supabase variant retains that resolution and composition at
  quality 75, transferring about 209 KB in the browser. A mobile-only picture
  source offers 480/768/1080 widths. Its SSR responsive preload matches the source;
  browser checks found one hero request, with eager/high priority retained.
- **Product thumbnails:** four homepage photos originally transferred about
  447 KB despite rendering around 163×204 CSS pixels each. Mobile-only
  320/480/640/960 variants at quality 85 reduced those transfers to about 207 KB.
  Catalogue cards share this improvement. Desktop retains the original image URLs.
- **Initial JavaScript:** the existing React calendar is now a separate 60.7 KB
  raw / 18.5 KB gzip chunk, loaded when its field approaches the viewport or on
  focus/open. Observed initial JavaScript transfer fell about 15 KB. Calendar
  appearance, civil-date handling and submitted WhatsApp date remain unchanged.
- Transformations are read-only requests to the existing external Supabase public
  bucket. Original uploads, admin settings and storage data are unchanged. Failed
  variants retry the original; the hero then retains its existing local fallback.
- The hero keeps the same SSR frame/image through hydration and the same CSS
  animation owner and timings. No changes to ImageReveal, StorefrontMotion,
  animation CSS, layout, typography, SEO text, reduced-motion or business logic.
- Google Fonts is render blocking (Lighthouse estimated about 610 ms potential
  savings). An isolated self-hosting/preload experiment did not consistently
  improve the measured result and regressed applied-throttling FCP. It was
  discarded; the original font configuration is retained.

## Data and hosting audit

Homepage product/settings/gallery reads already run concurrently. Products include
their categories in one query; only four featured cards render. The gallery
preview query is capped at six. Product-image queries run when details open.
SSR data seeds the client query cache without redundant hydration reads. No N+1
query or safe, necessary schema change was identified; fetching all public products
also supports the existing homepage minimum-price logic.

Production HTML was gzip-compressed, with `Cache-Control: no-cache` and Netlify
edge miss / durable-cache bypass in the captured response. Live TTFB was around
1.1–1.3 s in measured samples; application, database and platform contributions
cannot be separated without correlated server timings. No Netlify/cache/auth
configuration or production database operation was changed.

## Validation

- `npx tsc --noEmit`: passed.
- `npm test`: 22 files, 151 tests passed, including responsive-image fallbacks and
  full-document Netlify SSR → hydration → image decode regression coverage.
- `npx --yes --package=bun bun run build`: passed; `dist/client` exists.
- All three built production checks passed: homepage/Netlify annotation, gallery,
  and multi-category catalogue hydration; zero console errors.
- Headless Edge at 320, 390, 768, 1024 and 1440 px: no horizontal overflow or
  console errors on homepage/catalogue/gallery; product details, search/filter
  drawer, gallery lightbox, calendar selection and WhatsApp date serialization
  passed. WhatsApp opening was intercepted, so no message was sent. The hero made
  one request, retained its SSR node, and started each existing animation once.
  The calendar chunk was absent initially and loaded near the form. The browser
  harness waits for the existing calendar close transition before continuing.
- No dependencies added. No commit, push or deployment performed.

## Remaining priorities

1. Profile Netlify SSR and Supabase round trips/regions to reduce mobile FCP and
   LCP further. Introduce server timings before choosing caching; any cache must
   preserve admin image freshness and authentication isolation.
2. Add measured responsive gallery thumbnails separately. The unchanged gallery
   still transfers about 2.3 MB of images in the mobile sample; keep originals for
   its lightbox and preserve its masonry composition.
3. Investigate public-bundle inclusion of admin dependencies. The Supabase SDK is
   about 53 KB compressed in the initial bundle; eager admin guard imports mean
   simply moving a public import does not remove it. Leave guard/auth changes for
   a separately validated task. Lighthouse also reports substantial unused JS.
4. Revisit critical CSS/font loading with production measurements. Self-hosting
   alone was not a demonstrated improvement here. Avoid delaying/removing the
   existing animations merely to improve a score.

## Files changed

- `src/components/site/HeroImage.tsx`
- `src/components/site/ResponsiveProductImage.tsx` (new)
- `src/components/site/ProductCard.tsx`
- `src/components/site/OrderDatePicker.tsx`
- `src/components/site/OrderDateCalendar.tsx` (new)
- `src/lib/responsive-images.ts` (new)
- `src/routes/index.tsx`
- `src/test/hero-image.test.tsx`
- `src/test/netlify-hydration.test.tsx`
- `src/test/responsive-product-image.test.tsx` (new)
- `src/test/order-date-picker.test.tsx`
- `src/test/storefront-interactions.test.tsx`
- `scripts/check-production-hydration.mjs` (exposes JSDOM's browser Image API)
- `PERFORMANCE_AUDIT.md` (new)

Raw reports, original-build snapshot, benchmark scripts and screenshots are local,
ignored artifacts in `dist/performance/`; they are not deployment configuration.
