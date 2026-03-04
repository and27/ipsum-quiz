begin;

create table if not exists public.simulator_version_topic_order (
  id uuid primary key default gen_random_uuid(),
  simulator_version_id uuid not null references public.simulator_versions(id) on delete cascade,
  topic_id uuid not null references public.topics(id) on delete cascade,
  display_order integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint simulator_version_topic_order_display_order_check
    check (display_order > 0),
  constraint simulator_version_topic_order_version_topic_key
    unique (simulator_version_id, topic_id),
  constraint simulator_version_topic_order_version_display_order_key
    unique (simulator_version_id, display_order)
);

create index if not exists simulator_version_topic_order_version_idx
  on public.simulator_version_topic_order (simulator_version_id, display_order);

drop trigger if exists simulator_version_topic_order_set_updated_at
  on public.simulator_version_topic_order;
create trigger simulator_version_topic_order_set_updated_at
before update on public.simulator_version_topic_order
for each row execute procedure public.set_updated_at();

alter table public.simulator_version_topic_order enable row level security;

drop policy if exists simulator_version_topic_order_admin_all
  on public.simulator_version_topic_order;
create policy simulator_version_topic_order_admin_all
on public.simulator_version_topic_order
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

insert into public.simulator_version_topic_order (
  simulator_version_id,
  topic_id,
  display_order
)
select
  sv.id as simulator_version_id,
  t.id as topic_id,
  row_number() over (
    partition by sv.id
    order by
      t.display_order,
      lower(t.name),
      t.created_at,
      t.id
  ) as display_order
from public.simulator_versions sv
cross join public.topics t
where not exists (
  select 1
  from public.simulator_version_topic_order svto
  where svto.simulator_version_id = sv.id
    and svto.topic_id = t.id
);

commit;
