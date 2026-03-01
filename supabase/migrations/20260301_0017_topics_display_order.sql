begin;

alter table public.topics
  add column if not exists display_order integer;

with ordered_topics as (
  select
    id,
    row_number() over (
      order by
        coalesce(display_order, 2147483647),
        lower(name),
        created_at,
        id
    ) as next_display_order
  from public.topics
)
update public.topics t
set display_order = ordered_topics.next_display_order
from ordered_topics
where ordered_topics.id = t.id
  and t.display_order is distinct from ordered_topics.next_display_order;

alter table public.topics
  alter column display_order set not null;

alter table public.topics
  drop constraint if exists topics_display_order_check;

alter table public.topics
  add constraint topics_display_order_check
  check (display_order > 0);

create unique index if not exists topics_display_order_key
  on public.topics (display_order);

commit;
