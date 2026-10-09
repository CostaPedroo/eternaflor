# Gallery setup

Apply `migrations/20261008120000_gallery_images.sql` using the SQL Editor in the
owner's **external** Supabase project (the project configured by
`VITE_EXT_SUPABASE_URL`). The repository's `supabase/config.toml` refers to the
retired Lovable project; do not use it to push this migration to that project.

The migration adds only `gallery_images` and its ordering function/policies.
It reuses the existing `public.has_role(auth.uid(), 'admin')` role check.
Anonymous visitors can select active images; administrators can read hidden
images and insert/update/delete/reorder. No authentication, existing table,
bucket, or storage-policy changes are made.

`width` and `height` record the processed photo's intrinsic dimensions and
reserve its natural aspect ratio in SSR. They are filled automatically by the
admin; no photo title, description, price, or category is required.

After applying the migration, open `/admin/galeria`, add one or more photos,
review their previews, and choose **Guardar fotografias**. Photos use the
existing `product-images` bucket at `gallery/<uuid>.webp`. The existing admin
storage policies must permit these paths. Processing uses the existing site
photo pipeline: maximum 2000px, WebP quality 0.86, maximum 2 MiB, with additional
resizing for oversized results. Originals are never uploaded. Browsers without
WebP encoding are asked to retry in a compatible browser. HEIC decoding depends
on the browser's existing native decoder; no HEIC dependency is added.

Public pages show active photos in `sort_order`, `created_at`, `id` order.
The full public and admin galleries read in 500-row batches so a larger gallery
is not truncated by Supabase's default per-response row cap.
The homepage query uses `limit(6)` and does not load the full gallery. Empty or
unavailable data renders a safe empty/error state. A schema migration must be
applied before admin uploads or real database-backed gallery validation can work.

Validation: `npx tsc --noEmit`, `npm test`, `bun run build`, and
`node scripts/check-production-hydration.mjs` and
`node scripts/check-gallery-hydration.mjs` after building. The gallery production
check uses read-only backend fixtures, verifies an 18-image SSR gallery and a
six-image homepage preview, and checks that hydration retains the image DOM.

Responsive review: 320px uses one column; 375px, 390px and 430px use two;
tablet uses three from 768px; large desktop uses four from 1280px. The preview
keeps at most three columns. Verify these viewports in a browser with real
photos after applying the migration; headless DOM checks do not verify layout.
