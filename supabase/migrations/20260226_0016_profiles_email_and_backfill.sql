begin;

alter table public.profiles
  add column if not exists email text;

update public.profiles p
set email = u.email,
    updated_at = now()
from auth.users u
where u.id = p.id
  and (p.email is null or trim(p.email) = '');

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, full_name, email)
  values (
    new.id,
    'student',
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    new.email
  )
  on conflict (id) do update
    set full_name = coalesce(
      nullif(trim(excluded.full_name), ''),
      public.profiles.full_name
    ),
    email = coalesce(excluded.email, public.profiles.email),
    updated_at = now();

  return new;
end;
$$;

commit;
