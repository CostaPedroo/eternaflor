# Multi-category deployment

The existing production relationship is nullable `products.category_id`, with
a foreign key to `categories.id`. The existing admin deliberately offers
“Sem categoria”; the new checkboxes retain that supported empty selection.

1. Review [the complete SQL](migrations/20261012120000_product_categories.sql).
2. Execute it manually in the SQL Editor of the **external** Supabase project
   configured by `VITE_EXT_SUPABASE_URL`. Do not use `supabase/config.toml` to
   push to the retired Lovable project. This migration has **not** been applied
   by Codex.
3. Deploy the new application code after the migration succeeds.
4. Check one existing product, save two/three categories, remove one, duplicate
   the product, and check each public filter. Check active/hidden categories
   and products with the existing production RLS as part of this live check.

The migration locks products/categories during its transaction, backfills every
non-null legacy relationship, and aborts if any assignment is missing. Both
junction foreign keys cascade on deletion. The composite primary key handles
product lookups; the category-first index handles category lookups/cascades.
See [PostgreSQL indexing documentation](https://www.postgresql.org/docs/current/indexes-multicolumn.html).

`product_categories` is authoritative. `category_id` is deprecated and retained
temporarily for old deployed clients. Compatibility triggers translate legacy
single-category writes into junction operations, and mirror one membership back
to the old column at commit. Deleting a category preserves all other memberships.
The new application never filters or saves using the old column. Public reads
use one nested query and expose `product.categories: [{ id, name, slug }]`.
Refresh old admin tabs before assigning multiple categories: an old client's
intentional category change still replaces the membership set with its single
selection. Keeping the deployment transition short avoids that limitation.

The new table's RLS and both atomic admin RPCs use the production helper
`private.is_admin()`. Existing authentication and existing table policies are
unchanged. The RPCs use a definer context with an empty search path and an
explicit request-admin check before every mutation. This avoids granting
frontend roles access to the private schema; inputs are limited to the existing
product fields and validated category IDs. Save commits the product fields and exact selected set together;
duplicate commits the hidden product, every membership, and the photo rows
together. Photo upload behavior in the form remains the existing pipeline.

Validation uses a development-only PGlite PostgreSQL instance with an isolated
fixture of the existing tables/roles. It tests real migration SQL, policies,
backfill, cascades, exact-set updates, duplication and transaction rollback.
It does not write to production or replace live validation against production's
existing policies. The compiled SSR/hydration scripts use read-only backend
fixtures while the production junction table has not yet been installed.

```sh
npx tsc --noEmit
npm test
bun run build
node scripts/check-multicategory-hydration.mjs /
node scripts/check-multicategory-hydration.mjs /catalogo
node scripts/check-gallery-hydration.mjs
```

Local Supabase types include the staged column, junction/FKs and RPC signatures.
After applying the migration, you can regenerate from the external project with
`supabase gen types typescript --project-id <external-project-ref> --schema public`.
Do not use the retired project reference.

## Later removal of the compatibility column

Only after the new application is deployed, old admin tabs are refreshed, and
any other external consumers stop using `category_id`, review and execute the
following **separate cleanup** in the external SQL Editor. Do not run it during
the initial deployment. It intentionally avoids `CASCADE` so unknown dependencies
block removal rather than being silently deleted. Regenerate local types afterward.
The new save/duplicate RPCs and application queries already work without the column.

```sql
begin;
drop trigger product_categories_legacy_write on public.products;
drop trigger product_categories_legacy_mirror on public.product_categories;
drop function private.product_categories_from_legacy();
drop function private.product_categories_legacy_mirror();
alter table public.products drop column category_id;
notify pgrst, 'reload schema';
commit;
```
