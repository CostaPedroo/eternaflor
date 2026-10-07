<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Catalog products live in the database (products/categories/product_images); the homepage reads active products through a public server function, never hardcoded — so the shop owner manages them from /admin.
- Admin access is role-based (user_roles + has_role) with RLS; /admin is a client-only gated layout and /admin/login is outside it — public sign-up is disabled, admins are granted the role manually.
- Product photos go to a private storage bucket (public buckets are blocked) and are shown via signed URLs; DB image values are storage paths or legacy asset URLs (see isStoragePath).
- WhatsApp number and order message live only in src/lib/config.ts.

- Backend is the owner's external Supabase project via src/integrations/external/client.ts (publishable key + RLS only); never import @/integrations/supabase/client — Lovable Cloud is retired for this app. Product bucket is public, so images use getPublicUrl, not signed URLs.
- Homepage shows only up to 4 featured products; the full catalogue (filters, search, sorting, client-side) lives at /catalogo, with categories read from the DB — keeps the homepage curated as the catalogue grows.
- External backend config comes only from VITE_EXT_SUPABASE_URL / VITE_EXT_SUPABASE_PUBLISHABLE_KEY (.env.development / .env.production), no code fallbacks — single source of configuration.
