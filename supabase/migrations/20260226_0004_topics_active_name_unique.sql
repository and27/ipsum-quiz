begin;

drop index if exists public.topics_name_unique_lower_idx;

create unique index if not exists topics_name_unique_active_lower_idx
  on public.topics (lower(name))
  where is_active = true;

commit;

