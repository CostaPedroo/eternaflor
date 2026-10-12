// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

// Isolated local PostgreSQL. No network, production credentials or production writes.
const A = "00000000-0000-4000-8000-000000000001";
const B = "00000000-0000-4000-8000-000000000002";
const C = "00000000-0000-4000-8000-000000000003";
const HIDDEN = "00000000-0000-4000-8000-000000000004";
const P = "10000000-0000-4000-8000-000000000001";
const INACTIVE = "10000000-0000-4000-8000-000000000002";
const UNCAT = "10000000-0000-4000-8000-000000000003";
let db: PGlite;
const payload = {
  name: "Caixa de Flores",
  slug: "caixa-de-flores",
  price: 25,
  old_price: 30,
  short_description: "Feito à mão",
  description: "Descrição",
  active: true,
  available: true,
  featured: true,
  customizable: true,
};
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema private;
    create function private.is_admin() returns boolean language sql stable as
      $$ select coalesce(current_setting('test.is_admin', true) = 'true', false) $$;
    grant usage on schema private to anon, authenticated;
    grant execute on function private.is_admin() to anon, authenticated;
    create table public.categories (id uuid primary key default gen_random_uuid(), name text not null,
      slug text not null unique, active boolean not null default true, sort_order integer not null default 0,
      created_at timestamptz not null default now());
    create table public.products (id uuid primary key default gen_random_uuid(), name text not null,
      slug text not null unique, category_id uuid references public.categories(id) on delete set null,
      price numeric not null check (price >= 0), old_price numeric, short_description text, description text,
      main_image text, active boolean not null default true, available boolean not null default true,
      featured boolean not null default false, customizable boolean not null default true,
      sort_order integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
    create table public.product_images (id uuid primary key default gen_random_uuid(), product_id uuid not null
      references public.products(id) on delete cascade, image_url text not null, alt_text text,
      sort_order integer not null default 0, created_at timestamptz not null default now());
    alter table public.products enable row level security;
    alter table public.categories enable row level security;
    alter table public.product_images enable row level security;
    create policy product_public on public.products for select to anon, authenticated using(active);
    create policy product_admin on public.products to authenticated using(private.is_admin()) with check(private.is_admin());
    create policy category_public on public.categories for select to anon, authenticated using(active);
    create policy category_admin on public.categories to authenticated using(private.is_admin()) with check(private.is_admin());
    create policy photo_admin on public.product_images to authenticated using(private.is_admin()) with check(private.is_admin());
    grant select on public.products, public.categories to anon;
    grant select, insert, update, delete on public.products, public.categories, public.product_images to authenticated;
    insert into public.categories (id,name,slug,active) values
      ('${A}','Bouquets','bouquets',true), ('${B}','Caixas','caixas',true),
      ('${C}','Personalizados','personalizados',true), ('${HIDDEN}','Oculta','oculta',false);
    insert into public.products(id,name,slug,category_id,price,active,featured,main_image) values
      ('${P}','Original','original','${A}',25,true,true,'original/main.webp'),
      ('${INACTIVE}','Oculto','oculto','${B}',10,false,false,null),
      ('${UNCAT}','Sem categoria','sem-categoria',null,10,true,false,null);
  `);
  await db.exec(
    readFileSync(
      new URL("../../supabase/migrations/20261012120000_product_categories.sql", import.meta.url),
      "utf8",
    ),
  );
}, 20_000);
afterAll(async () => {
  await db?.close();
});
beforeEach(async () => {
  await db.exec("begin; set local test.is_admin = 'true';");
});
afterEach(async () => {
  await db.exec("rollback; reset role;");
});

async function attempt<T>(sql: string, args: unknown[] = []) {
  await db.exec("savepoint mutation;");
  try {
    return await db.query<T>(sql, args);
  } catch (error) {
    await db.exec("rollback to savepoint mutation;");
    throw error;
  } finally {
    await db.exec("release savepoint mutation;");
  }
}
async function save(ids: string[], id: string | null = P, fields = payload) {
  const result = await attempt<{ id: string }>(
    "select public.save_product_with_categories($1, $2::jsonb, $3::uuid[]) as id",
    [id, JSON.stringify(fields), ids],
  );
  return result.rows[0]!.id;
}
async function ids(id = P) {
  return (
    await db.query<{ category_id: string }>(
      "select category_id from public.product_categories where product_id=$1 order by category_id",
      [id],
    )
  ).rows.map((row) => row.category_id);
}
async function mirror() {
  await db.exec(
    "set constraints product_categories_legacy_mirror immediate; set constraints product_categories_legacy_mirror deferred;",
  );
}
describe("External product-category migration on local PostgreSQL", () => {
  it("keeps save, edit and duplicate working after the documented later compatibility cleanup", async () => {
    await db.exec(`
      drop trigger product_categories_legacy_write on public.products;
      drop trigger product_categories_legacy_mirror on public.product_categories;
      drop function private.product_categories_from_legacy();
      drop function private.product_categories_legacy_mirror();
      alter table public.products drop column category_id;
    `);
    const created = await save([A, B], null);
    expect(await ids(created)).toEqual([A, B]);
    await save([A, C], created);
    expect(await ids(created)).toEqual([A, C]);
    const copy = (
      await attempt<{ id: string }>(
        "select public.duplicate_product_with_categories($1,'Cleanup copy','cleanup-copy') id",
        [created],
      )
    ).rows[0]!.id;
    expect(await ids(copy)).toEqual([A, C]);
  });
  it("matches the junction schema/FKs and provides both indexed lookup directions", async () => {
    expect(
      (
        await db.query(
          "select column_name,data_type,is_nullable from information_schema.columns where table_schema='public' and table_name='product_categories' order by ordinal_position",
        )
      ).rows,
    ).toEqual([
      { column_name: "product_id", data_type: "uuid", is_nullable: "NO" },
      { column_name: "category_id", data_type: "uuid", is_nullable: "NO" },
      { column_name: "created_at", data_type: "timestamp with time zone", is_nullable: "NO" },
    ]);
    expect(
      (
        await db.query(
          "select conname,confdeltype from pg_constraint where conrelid='public.product_categories'::regclass and contype='f' order by conname",
        )
      ).rows,
    ).toEqual([
      { conname: "product_categories_category_id_fkey", confdeltype: "c" },
      { conname: "product_categories_product_id_fkey", confdeltype: "c" },
    ]);
    const indexes = (
      await db.query<{ indexdef: string }>(
        "select indexdef from pg_indexes where schemaname='public' and tablename='product_categories'",
      )
    ).rows.map((row) => row.indexdef);
    expect(indexes.some((index) => index.includes("(product_id, category_id)"))).toBe(true);
    expect(indexes.some((index) => index.includes("(category_id, product_id)"))).toBe(true);
  });
  it("uses the private admin helper without granting frontend roles private-schema access", async () => {
    await db.exec(
      "revoke usage on schema private from authenticated; set local role authenticated;",
    );
    const created = await save([A, B], null);
    expect(await ids(created)).toEqual([A, B]);
    const copy = (
      await attempt<{ id: string }>(
        "select public.duplicate_product_with_categories($1,'Private copy','private-copy') id",
        [created],
      )
    ).rows[0]!.id;
    expect(await ids(copy)).toEqual([A, B]);
    await db.exec("set local test.is_admin='false';");
    await expect(save([A], null)).rejects.toThrow(/Admin role required/);
    await expect(
      attempt("select public.duplicate_product_with_categories($1,'Denied','denied')", [created]),
    ).rejects.toThrow(/Admin role required/);
  });
  it("backfills every legacy assignment, including hidden products, and preserves uncategorized products", async () => {
    expect(await ids()).toEqual([A]);
    expect(await ids(INACTIVE)).toEqual([B]);
    expect(await ids(UNCAT)).toEqual([]);
    expect((await db.query("select count(*)::int n from public.products")).rows).toEqual([
      { n: 3 },
    ]);
  });
  it("creates a product with two memberships in one operation", async () => {
    await db.exec("set local role authenticated;");
    const created = await save([A, B], null);
    expect(await ids(created)).toEqual([A, B]);
    await mirror();
    expect(
      (
        await db.query<{ category_id: string }>(
          "select category_id from public.products where id=$1",
          [created],
        )
      ).rows[0]?.category_id,
    ).toBe(A);
  });
  it("edits one membership to three, then removes only one and never duplicates rows", async () => {
    await db.exec("set local role authenticated;");
    await save([A, B, C, A]);
    expect(await ids()).toEqual([A, B, C]);
    await save([B, C]);
    expect(await ids()).toEqual([B, C]);
    await mirror();
    expect(
      (
        await db.query<{ category_id: string }>(
          "select category_id from public.products where id=$1",
          [P],
        )
      ).rows[0]?.category_id,
    ).toBe(B);
  });
  it("copies all memberships, photo order and flags atomically into a hidden duplicate", async () => {
    await save([A, B, C]);
    await db.query(
      "insert into public.product_images(product_id,image_url,alt_text,sort_order) values($1,'one.webp','Frente',0),($1,'two.webp','Lado',1)",
      [P],
    );
    await db.exec("set local role authenticated;");
    const copy = (
      await attempt<{ id: string }>(
        "select public.duplicate_product_with_categories($1, 'Cópia', 'copia') id",
        [P],
      )
    ).rows[0]!.id;
    expect(await ids(copy)).toEqual([A, B, C]);
    expect(
      (
        await db.query(
          "select image_url,sort_order from public.product_images where product_id=$1 order by sort_order",
          [copy],
        )
      ).rows,
    ).toEqual([
      { image_url: "one.webp", sort_order: 0 },
      { image_url: "two.webp", sort_order: 1 },
    ]);
    expect(
      (
        await db.query(
          "select active,available,featured,main_image from public.products where id=$1",
          [copy],
        )
      ).rows,
    ).toEqual([
      { active: false, available: true, featured: true, main_image: "original/main.webp" },
    ]);
  });
  it("rejects invalid categories without changing the product or its existing set", async () => {
    await expect(save([B, "ffffffff-ffff-4fff-8fff-ffffffffffff"])).rejects.toThrow(
      /Invalid category/,
    );
    expect(await ids()).toEqual([A]);
    expect((await db.query("select name from public.products where id=$1", [P])).rows).toEqual([
      { name: "Original" },
    ]);
  });
  it("rolls back a failure after product fields and memberships have begun changing", async () => {
    await db.exec(`create function public.fail_category_test() returns trigger language plpgsql as $$begin raise exception 'Test membership failure'; end;$$;
      create trigger fail_category_test before insert on public.product_categories for each row when(new.category_id='${C}') execute function public.fail_category_test();`);
    await expect(save([B, C])).rejects.toThrow(/Test membership failure/);
    expect(await ids()).toEqual([A]);
    expect((await db.query("select name from public.products where id=$1", [P])).rows).toEqual([
      { name: "Original" },
    ]);
  });
  it("rolls back the duplicate if photo copying fails", async () => {
    await db.query(
      "insert into public.product_images(product_id,image_url) values($1,'one.webp')",
      [P],
    );
    await db.exec(`create function public.fail_photo_test() returns trigger language plpgsql as $$begin raise exception 'Test photo failure'; end;$$;
      create trigger fail_photo_test before insert on public.product_images for each row when(new.product_id<>'${P}') execute function public.fail_photo_test();`);
    await expect(
      attempt("select public.duplicate_product_with_categories($1, 'Cópia', 'failed-copy')", [P]),
    ).rejects.toThrow(/Test photo failure/);
    expect(
      (await db.query("select count(*)::int n from public.products where slug='failed-copy'")).rows,
    ).toEqual([{ n: 0 }]);
  });
  it("public reads expose only active products and categories, even if available=false", async () => {
    await save([A, HIDDEN]);
    await db.query("update public.products set available=false where id=$1", [P]);
    await db.exec("set local test.is_admin='false'; set local role anon;");
    expect(
      (
        await db.query(
          "select product_id,category_id from public.product_categories order by product_id",
        )
      ).rows,
    ).toEqual([{ product_id: P, category_id: A }]);
    await expect(
      attempt("select public.save_product_with_categories(null, '{}'::jsonb, '{}'::uuid[])"),
    ).rejects.toThrow(/permission denied/);
  });
  it("non-admin authenticated requests cannot mutate assignments or invoke admin RPCs", async () => {
    await db.exec("set local test.is_admin='false'; set local role authenticated;");
    await expect(
      attempt("insert into public.product_categories(product_id,category_id) values($1,$2)", [
        P,
        B,
      ]),
    ).rejects.toThrow(/row-level security/);
    await expect(save([B])).rejects.toThrow(/Admin role required/);
    await expect(
      attempt("select public.duplicate_product_with_categories($1,'Bad','bad')", [P]),
    ).rejects.toThrow(/Admin role required/);
    expect(await ids()).toEqual([A]);
  });
  it("allows admins to read hidden assignments and insert/update/delete membership rows", async () => {
    await db.exec("set local role authenticated;");
    expect(await ids(INACTIVE)).toEqual([B]);
    await db.query("insert into public.product_categories(product_id,category_id) values($1,$2)", [
      P,
      B,
    ]);
    await db.query(
      "update public.product_categories set category_id=$1 where product_id=$2 and category_id=$3",
      [C, P, B],
    );
    expect(await ids()).toEqual([A, C]);
    await db.query("delete from public.product_categories where product_id=$1 and category_id=$2", [
      P,
      C,
    ]);
    expect(await ids()).toEqual([A]);
  });
  it("retains supported uncategorized products and validates missing/invalid selections", async () => {
    await save([]);
    expect(await ids()).toEqual([]);
    await mirror();
    expect(
      (await db.query("select category_id from public.products where id=$1", [P])).rows,
    ).toEqual([{ category_id: null }]);
    await expect(
      attempt("select public.save_product_with_categories($1,$2::jsonb,null)", [
        P,
        JSON.stringify(payload),
      ]),
    ).rejects.toThrow(/Invalid category/);
  });
  it("translates old clients' writes and mirrors the committed authoritative set without losing cascade survivors", async () => {
    await db.query("update public.products set category_id=$1 where id=$2", [B, P]);
    expect(await ids()).toEqual([B]);
    await save([A, B, C]);
    await mirror();
    await db.query("delete from public.categories where id=$1", [B]);
    await mirror();
    expect(await ids()).toEqual([A, C]);
    expect(
      (await db.query("select category_id from public.products where id=$1", [P])).rows,
    ).toEqual([{ category_id: A }]);
    await db.query("delete from public.products where id=$1", [P]);
    expect(await ids()).toEqual([]);
  });
});
