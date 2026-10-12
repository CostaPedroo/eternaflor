-- Apply manually to the EXTERNAL project configured by VITE_EXT_SUPABASE_URL.
begin;

lock table public.products, public.categories in share row exclusive mode;
create table public.product_categories (
  product_id uuid not null references public.products(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (product_id, category_id)
);
-- The primary key covers product_id; this index covers category lookups/cascades.
create index product_categories_category_id_idx
  on public.product_categories (category_id, product_id);

insert into public.product_categories (product_id, category_id)
  select id, category_id from public.products where category_id is not null;
do $$
begin
  if exists (
    select 1 from public.products p where p.category_id is not null
      and not exists (select 1 from public.product_categories pc
                      where pc.product_id = p.id and pc.category_id = p.category_id)
  ) then
    raise exception 'Existing category assignment was not backfilled';
  end if;
end;
$$;

alter table public.product_categories enable row level security;
revoke all on public.product_categories from anon, authenticated;
grant select on public.product_categories to anon;
grant select, insert, update, delete on public.product_categories to authenticated;
grant all on public.product_categories to service_role;
create policy "Public product categories"
  on public.product_categories for select to anon, authenticated
  using (
    exists (select 1 from public.products p where p.id = product_id and p.active)
    and exists (select 1 from public.categories c where c.id = category_id and c.active)
  );
create policy "Admins read product categories"
  on public.product_categories for select to authenticated using (private.is_admin());
create policy "Admins insert product categories"
  on public.product_categories for insert to authenticated with check (private.is_admin());
create policy "Admins update product categories"
  on public.product_categories for update to authenticated
  using (private.is_admin()) with check (private.is_admin());
create policy "Admins delete product categories"
  on public.product_categories for delete to authenticated using (private.is_admin());

-- Staged compatibility: legacy writes are translated into junction writes.
-- New application code never reads/writes category_id. Remove this bridge only
-- after every deployed client has migrated (see PRODUCT_CATEGORIES_SETUP.md).
create function private.product_categories_from_legacy()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if current_setting('eternaflor.product_categories_mirror', true) = new.id::text then
    return new;
  end if;
  if tg_op = 'UPDATE' then
    if old.category_id is not distinct from new.category_id then return new; end if;
    -- FK SET NULL after a category deletion is not an intentional legacy edit.
    if old.category_id is not null and not exists (
      select 1 from public.categories c where c.id = old.category_id
    ) then return new; end if;
  end if;
  delete from public.product_categories where product_id = new.id;
  if new.category_id is not null then
    insert into public.product_categories (product_id, category_id)
      values (new.id, new.category_id) on conflict do nothing;
  end if;
  return new;
end;
$$;
revoke all on function private.product_categories_from_legacy() from public, anon, authenticated;
create trigger product_categories_legacy_write
  after insert or update of category_id on public.products
  for each row execute function private.product_categories_from_legacy();

-- At commit, mirror ONE membership for old clients. The junction remains the
-- authoritative set. Deferral also handles category/product FK cascades safely.
create function private.product_categories_legacy_mirror()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  affected uuid[];
  product_uuid uuid;
  previous_mirror text;
begin
  if tg_op = 'INSERT' then affected := array[new.product_id];
  elsif tg_op = 'DELETE' then affected := array[old.product_id];
  else affected := array[old.product_id, new.product_id]; end if;
  foreach product_uuid in array affected loop
    previous_mirror := current_setting('eternaflor.product_categories_mirror', true);
    perform set_config('eternaflor.product_categories_mirror', product_uuid::text, true);
    update public.products p set category_id = (
      select pc.category_id from public.product_categories pc
      where pc.product_id = product_uuid
      order by (pc.category_id = p.category_id) desc nulls last, pc.category_id limit 1
    ) where p.id = product_uuid and p.category_id is distinct from (
      select pc.category_id from public.product_categories pc
      where pc.product_id = product_uuid
      order by (pc.category_id = p.category_id) desc nulls last, pc.category_id limit 1
    );
    perform set_config('eternaflor.product_categories_mirror', coalesce(previous_mirror, ''), true);
  end loop;
  return null;
end;
$$;
revoke all on function private.product_categories_legacy_mirror() from public, anon, authenticated;
create constraint trigger product_categories_legacy_mirror
  after insert or update or delete on public.product_categories
  deferrable initially deferred for each row
  execute function private.product_categories_legacy_mirror();
comment on column public.products.category_id is
  'Deprecated compatibility mirror; product_categories is authoritative. Do not use in new application code.';

-- Product fields and the exact final membership set commit together.
-- Definer access calls the PRIVATE helper without exposing its schema to clients.
-- Every entry point checks the request's admin identity before any mutation.
create function public.save_product_with_categories(
  _product_id uuid, _product jsonb, _category_ids uuid[]
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  fields public.products;
  saved_id uuid;
begin
  if not coalesce(private.is_admin(), false) then
    raise exception 'Admin role required' using errcode = '42501';
  end if;
  if _category_ids is null or array_position(_category_ids, null) is not null
    or exists (select 1 from unnest(_category_ids) ids(id)
               where not exists (select 1 from public.categories c where c.id = ids.id)) then
    raise exception 'Invalid category selection' using errcode = '22023';
  end if;
  if _product is null or jsonb_typeof(_product) <> 'object'
    or not (_product ?& array['name','slug','price','available','active','featured','customizable'])
    or exists (select 1 from jsonb_object_keys(_product) keys(key)
               where key <> all(array['name','slug','price','old_price','short_description',
                                      'description','available','active','featured','customizable','sort_order'])) then
    raise exception 'Invalid product fields' using errcode = '22023';
  end if;
  select * into fields from jsonb_populate_record(null::public.products, _product);
  if nullif(btrim(fields.name), '') is null or nullif(btrim(fields.slug), '') is null
    or fields.price is null or fields.price < 0 then
    raise exception 'Invalid product name, slug or price' using errcode = '22023';
  end if;
  if _product_id is null then
    insert into public.products (name, slug, price, old_price, short_description, description,
      available, active, featured, customizable, sort_order)
    values (fields.name, fields.slug, fields.price, fields.old_price, fields.short_description,
      fields.description, fields.available, fields.active, fields.featured,
      fields.customizable, coalesce(fields.sort_order, 0)) returning id into saved_id;
  else
    update public.products set name = fields.name, slug = fields.slug, price = fields.price,
      old_price = fields.old_price, short_description = fields.short_description,
      description = fields.description, available = fields.available, active = fields.active,
      featured = fields.featured, customizable = fields.customizable
      where id = _product_id returning id into saved_id;
    if saved_id is null then
      raise exception 'Product not found or not writable' using errcode = '42501';
    end if;
  end if;
  delete from public.product_categories pc where pc.product_id = saved_id
    and not (pc.category_id = any(_category_ids));
  insert into public.product_categories (product_id, category_id)
    select saved_id, id from (select distinct unnest(_category_ids) id) ids
    on conflict do nothing;
  return saved_id;
end;
$$;
revoke all on function public.save_product_with_categories(uuid, jsonb, uuid[]) from public, anon;
grant execute on function public.save_product_with_categories(uuid, jsonb, uuid[]) to authenticated;

-- The hidden copy, every category and the existing photo order commit together.
create function public.duplicate_product_with_categories(_source_id uuid, _name text, _slug text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  source public.products;
  copied_id uuid;
begin
  if not coalesce(private.is_admin(), false) then
    raise exception 'Admin role required' using errcode = '42501';
  end if;
  select * into source from public.products where id = _source_id for update;
  if not found then raise exception 'Product not found' using errcode = '22023'; end if;
  insert into public.products (name, slug, short_description, description, price, old_price,
    main_image, active, available, featured, customizable, sort_order)
  values (_name, _slug, source.short_description, source.description, source.price, source.old_price,
    source.main_image, false, source.available, source.featured, source.customizable, source.sort_order)
  returning id into copied_id;
  insert into public.product_categories (product_id, category_id)
    select copied_id, category_id from public.product_categories where product_id = _source_id;
  insert into public.product_images (product_id, image_url, alt_text, sort_order)
    select copied_id, image_url, alt_text, sort_order from public.product_images where product_id = _source_id;
  return copied_id;
end;
$$;
revoke all on function public.duplicate_product_with_categories(uuid, text, text) from public, anon;
grant execute on function public.duplicate_product_with_categories(uuid, text, text) to authenticated;

notify pgrst, 'reload schema';
commit;
