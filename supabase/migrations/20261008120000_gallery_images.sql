-- Apply to the owner's EXTERNAL Supabase project, not the retired Lovable project.
begin;

create table public.gallery_images (
  id uuid primary key default gen_random_uuid(),
  image_url text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  -- Automatically recorded on upload, so natural image composition reserves space in SSR.
  width integer not null check (width > 0),
  height integer not null check (height > 0)
);

create index gallery_images_public_order_idx
  on public.gallery_images (sort_order, created_at, id) where is_active;

alter table public.gallery_images enable row level security;
revoke all on public.gallery_images from anon, authenticated;
grant select on public.gallery_images to anon;
grant select, insert, update, delete on public.gallery_images to authenticated;
grant all on public.gallery_images to service_role;

create policy "Active gallery images are public"
  on public.gallery_images for select to anon, authenticated using (is_active);
create policy "Admins can read all gallery images"
  on public.gallery_images for select to authenticated
  using (private.is_admin());
create policy "Admins can insert gallery images"
  on public.gallery_images for insert to authenticated
  with check (private.is_admin());
create policy "Admins can update gallery images"
  on public.gallery_images for update to authenticated
  using (private.is_admin())
  with check (private.is_admin());
create policy "Admins can delete gallery images"
  on public.gallery_images for delete to authenticated
  using (private.is_admin());

-- One transaction avoids partially persisted ordering from multiple HTTP updates.
create function public.reorder_gallery_images(_ids uuid[])
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if not coalesce(private.is_admin(), false) then
    raise exception 'Admin role required' using errcode = '42501';
  end if;
  perform id from public.gallery_images order by id for update;
  if _ids is null
    or cardinality(_ids) <> (select count(*) from public.gallery_images)
    or cardinality(_ids) <> (select count(distinct id) from unnest(_ids) as supplied(id))
    or exists (select id from unnest(_ids) as supplied(id)
               where not exists (select 1 from public.gallery_images g where g.id = supplied.id)) then
    raise exception 'Gallery changed; reload before reordering' using errcode = '22023';
  end if;
  update public.gallery_images as g
    set sort_order = supplied.position - 1
    from unnest(_ids) with ordinality as supplied(id, position)
    where g.id = supplied.id;
end;
$$;
revoke all on function public.reorder_gallery_images(uuid[]) from public, anon;
grant execute on function public.reorder_gallery_images(uuid[]) to authenticated;

-- Existing product-images bucket and its admin-only storage policies are reused.
notify pgrst, 'reload schema';
commit;
