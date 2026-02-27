begin;

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, full_name)
  values (
    new.id,
    'student',
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), '')
  )
  on conflict (id) do update
    set full_name = coalesce(
      nullif(trim(excluded.full_name), ''),
      public.profiles.full_name
    ),
    updated_at = now();

  return new;
end;
$$;

commit;
