begin;

alter table public.simulators
  add column if not exists campus text;

update public.simulators
set campus = 'canar'
where campus is null;

alter table public.simulators
  alter column campus set default 'canar';

alter table public.simulators
  alter column campus set not null;

alter table public.simulators
  drop constraint if exists simulators_campus_check;

alter table public.simulators
  add constraint simulators_campus_check
  check (campus in ('canar', 'azogues'));

commit;
