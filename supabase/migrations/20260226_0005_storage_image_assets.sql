begin;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values
  (
    'questions-original',
    'questions-original',
    false,
    8388608,
    array['image/jpeg', 'image/png', 'image/webp']
  ),
  (
    'questions-public',
    'questions-public',
    true,
    8388608,
    array['image/jpeg', 'image/webp']
  )
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.image_assets (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('question', 'option')),
  uploaded_by uuid not null references public.profiles (id),
  original_bucket text not null default 'questions-original',
  original_path text not null,
  original_mime_type text not null,
  original_bytes integer not null check (original_bytes > 0),
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  webp_bucket text not null default 'questions-public',
  webp_path text not null,
  webp_url text not null,
  webp_bytes integer not null check (webp_bytes > 0),
  jpeg_bucket text not null default 'questions-public',
  jpeg_path text not null,
  jpeg_url text not null,
  jpeg_bytes integer not null check (jpeg_bytes > 0),
  created_at timestamptz not null default now()
);

create index if not exists image_assets_uploaded_by_created_at_idx
  on public.image_assets (uploaded_by, created_at desc);

alter table public.image_assets enable row level security;

drop policy if exists image_assets_admin_all on public.image_assets;
create policy image_assets_admin_all
on public.image_assets
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists storage_questions_original_admin_select on storage.objects;
create policy storage_questions_original_admin_select
on storage.objects
for select
to authenticated
using (bucket_id = 'questions-original' and public.is_admin());

drop policy if exists storage_questions_original_admin_insert on storage.objects;
create policy storage_questions_original_admin_insert
on storage.objects
for insert
to authenticated
with check (bucket_id = 'questions-original' and public.is_admin());

drop policy if exists storage_questions_original_admin_update on storage.objects;
create policy storage_questions_original_admin_update
on storage.objects
for update
to authenticated
using (bucket_id = 'questions-original' and public.is_admin())
with check (bucket_id = 'questions-original' and public.is_admin());

drop policy if exists storage_questions_original_admin_delete on storage.objects;
create policy storage_questions_original_admin_delete
on storage.objects
for delete
to authenticated
using (bucket_id = 'questions-original' and public.is_admin());

drop policy if exists storage_questions_public_read on storage.objects;
create policy storage_questions_public_read
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'questions-public');

drop policy if exists storage_questions_public_admin_insert on storage.objects;
create policy storage_questions_public_admin_insert
on storage.objects
for insert
to authenticated
with check (bucket_id = 'questions-public' and public.is_admin());

drop policy if exists storage_questions_public_admin_update on storage.objects;
create policy storage_questions_public_admin_update
on storage.objects
for update
to authenticated
using (bucket_id = 'questions-public' and public.is_admin())
with check (bucket_id = 'questions-public' and public.is_admin());

drop policy if exists storage_questions_public_admin_delete on storage.objects;
create policy storage_questions_public_admin_delete
on storage.objects
for delete
to authenticated
using (bucket_id = 'questions-public' and public.is_admin());

commit;
