create type public.app_role as enum ('admin');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.user_roles where user_id = _user_id and role = _role) $$;

create policy "Users read own roles" on public.user_roles for select to authenticated
  using (user_id = auth.uid());

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public
as $$ begin new.updated_at = now(); return new; end $$;

-- categories
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
grant select on public.categories to anon, authenticated;
grant insert, update, delete on public.categories to authenticated;
grant all on public.categories to service_role;
alter table public.categories enable row level security;
create policy "Public reads active categories" on public.categories for select to anon, authenticated using (active = true);
create policy "Admins read categories" on public.categories for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "Admins insert categories" on public.categories for insert to authenticated with check (public.has_role(auth.uid(), 'admin'));
create policy "Admins update categories" on public.categories for update to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create policy "Admins delete categories" on public.categories for delete to authenticated using (public.has_role(auth.uid(), 'admin'));

-- products
create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  short_description text,
  description text,
  price numeric(10,2) not null,
  old_price numeric(10,2),
  category_id uuid references public.categories(id) on delete set null,
  main_image text,
  active boolean not null default true,
  featured boolean not null default false,
  customizable boolean not null default true,
  available boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index products_order_idx on public.products (sort_order, created_at);
grant select on public.products to anon, authenticated;
grant insert, update, delete on public.products to authenticated;
grant all on public.products to service_role;
alter table public.products enable row level security;
create policy "Public reads active products" on public.products for select to anon, authenticated using (active = true);
create policy "Admins read products" on public.products for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "Admins insert products" on public.products for insert to authenticated with check (public.has_role(auth.uid(), 'admin'));
create policy "Admins update products" on public.products for update to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create policy "Admins delete products" on public.products for delete to authenticated using (public.has_role(auth.uid(), 'admin'));
create trigger products_updated_at before update on public.products for each row execute function public.set_updated_at();

-- product images
create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  image_url text not null,
  alt_text text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
grant select on public.product_images to anon, authenticated;
grant insert, update, delete on public.product_images to authenticated;
grant all on public.product_images to service_role;
alter table public.product_images enable row level security;
create policy "Public reads images of active products" on public.product_images for select to anon, authenticated
  using (exists (select 1 from public.products p where p.id = product_id and p.active = true));
create policy "Admins read images" on public.product_images for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "Admins insert images" on public.product_images for insert to authenticated with check (public.has_role(auth.uid(), 'admin'));
create policy "Admins update images" on public.product_images for update to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create policy "Admins delete images" on public.product_images for delete to authenticated using (public.has_role(auth.uid(), 'admin'));

-- storage policies for product-images bucket
create policy "Public reads product images" on storage.objects for select to anon, authenticated using (bucket_id = 'product-images');
create policy "Admins upload product images" on storage.objects for insert to authenticated with check (bucket_id = 'product-images' and public.has_role(auth.uid(), 'admin'));
create policy "Admins update product images" on storage.objects for update to authenticated using (bucket_id = 'product-images' and public.has_role(auth.uid(), 'admin'));
create policy "Admins delete product images" on storage.objects for delete to authenticated using (bucket_id = 'product-images' and public.has_role(auth.uid(), 'admin'));

-- seed categories
insert into public.categories (name, slug, sort_order) values
  ('Bouquets', 'bouquets', 1),
  ('Flores individuais', 'flores-individuais', 2),
  ('Vasos', 'vasos', 3),
  ('Caixas', 'caixas', 4),
  ('Personalizados', 'personalizados', 5),
  ('Presentes até 15€', 'presentes-ate-15', 6);

-- seed current catalog (real products)
insert into public.products (name, slug, short_description, price, category_id, main_image, featured, sort_order) values
  ('Bouquet Gerberas Rosa', 'bouquet-gerberas-rosa', 'Gerberas e tulipas em rosa, com papel kraft e laço de cetim.', 25, (select id from public.categories where slug='bouquets'), '/__l5e/assets-v1/7da99c8a-6230-4a2d-a8b6-bed7c5a3652c/bouquet-gerberas-rosa.webp', true, 1),
  ('Bouquet Van Gogh', 'bouquet-van-gogh', 'Inspirado na «Noite Estrelada», em azuis e amarelo.', 25, (select id from public.categories where slug='bouquets'), '/__l5e/assets-v1/33889a75-8162-48bd-b7c2-2133b26090ae/bouquet-van-gogh.webp', true, 2),
  ('Bouquet Girassol', 'bouquet-girassol', 'Girassol e margaridas brancas — um raio de sol em kraft.', 15, (select id from public.categories where slug='bouquets'), '/__l5e/assets-v1/2a245d39-693a-45c8-b77e-43a5d0ec32d3/bouquet-girassol.webp', true, 3),
  ('Bouquet Terracota', 'bouquet-terracota', 'Gerberas em tons terra, quente e sofisticado.', 20, (select id from public.categories where slug='bouquets'), '/__l5e/assets-v1/39849061-0c21-4fd3-bd0a-6ab9001e9ea7/bouquet-terracota.webp', true, 4),
  ('Bouquet Lírios Rosé', 'bouquet-lirios-rose', 'Lírios e tulipas rosé, romântico e delicado.', 18, (select id from public.categories where slug='bouquets'), '/__l5e/assets-v1/24c11a33-3384-49fd-86c5-c4fc0340b92a/bouquet-lirios-rose.webp', true, 5),
  ('Bouquet Vermelho', 'bouquet-vermelho', 'Lírios e tulipas vermelhos, para grandes paixões.', 28, (select id from public.categories where slug='bouquets'), '/__l5e/assets-v1/21a7b34e-a78b-4126-b8d1-e1e219740cc2/bouquet-vermelho.webp', true, 6),
  ('Caixa de Flores', 'caixa-de-flores', 'Arranjo em caixa redonda rosé com laço de cetim.', 30, (select id from public.categories where slug='caixas'), '/__l5e/assets-v1/ded3cf75-52fa-40cf-85f4-cb85d4f6ae56/caixa-flores.webp', true, 7),
  ('Mini Margaridas Azuis', 'mini-margaridas-azuis', 'Mini bouquet de margaridas azuis, pronto a oferecer.', 12, (select id from public.categories where slug='presentes-ate-15'), '/__l5e/assets-v1/cbbc2c4f-840d-4f35-ae00-d34333fd0889/mini-margaridas.webp', true, 8),
  ('Coração Vermelho', 'coracao-vermelho', 'Rosas vermelhas em coração — o presente romântico.', 12, (select id from public.categories where slug='presentes-ate-15'), '/__l5e/assets-v1/ca65ea0d-e5e2-4aeb-bd75-1c8767ea39e8/coracao-vermelho.webp', true, 9),
  ('Quadro «Amor» Personalizado', 'quadro-amor-personalizado', 'Quadro com as vossas fotos e flores, feito à medida.', 35, (select id from public.categories where slug='personalizados'), '/__l5e/assets-v1/904dc4a3-5bde-4a40-af4c-1ec3679268ec/quadro-amor.webp', true, 10);
