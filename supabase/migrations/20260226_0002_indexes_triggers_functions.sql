begin;

create unique index if not exists topics_name_unique_lower_idx
  on public.topics (lower(name));

create unique index if not exists question_options_one_correct_active_idx
  on public.question_options (question_id)
  where is_correct = true and is_active = true;

create unique index if not exists simulator_version_question_options_one_correct_idx
  on public.simulator_version_question_options (simulator_version_question_id)
  where is_correct = true;

create unique index if not exists attempts_one_active_per_student_simulator_idx
  on public.attempts (student_id, simulator_id)
  where status = 'active';

create index if not exists attempts_student_simulator_created_at_idx
  on public.attempts (student_id, simulator_id, created_at desc);

create index if not exists attempts_simulator_status_created_at_idx
  on public.attempts (simulator_id, status, created_at desc);

create index if not exists attempts_status_expires_at_idx
  on public.attempts (status, expires_at);

create index if not exists attempt_answers_attempt_id_idx
  on public.attempt_answers (attempt_id);

create index if not exists simulator_version_questions_version_position_idx
  on public.simulator_version_questions (simulator_version_id, position);

create index if not exists access_code_attempts_lookup_idx
  on public.access_code_attempts (simulator_id, student_id, ip, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute procedure public.set_updated_at();

drop trigger if exists topics_set_updated_at on public.topics;
create trigger topics_set_updated_at
before update on public.topics
for each row execute procedure public.set_updated_at();

drop trigger if exists questions_set_updated_at on public.questions;
create trigger questions_set_updated_at
before update on public.questions
for each row execute procedure public.set_updated_at();

drop trigger if exists question_options_set_updated_at on public.question_options;
create trigger question_options_set_updated_at
before update on public.question_options
for each row execute procedure public.set_updated_at();

drop trigger if exists simulators_set_updated_at on public.simulators;
create trigger simulators_set_updated_at
before update on public.simulators
for each row execute procedure public.set_updated_at();

drop trigger if exists simulator_versions_set_updated_at on public.simulator_versions;
create trigger simulator_versions_set_updated_at
before update on public.simulator_versions
for each row execute procedure public.set_updated_at();

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role)
  values (new.id, 'student')
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user_profile();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated, service_role;

create or replace function public.promote_user_to_admin(user_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  select u.id
  into v_user_id
  from auth.users u
  where lower(u.email) = lower(user_email)
  limit 1;

  if v_user_id is null then
    raise exception 'No auth user found for email: %', user_email;
  end if;

  insert into public.profiles (id, role)
  values (v_user_id, 'admin')
  on conflict (id) do update
    set role = 'admin',
        updated_at = now();
end;
$$;

revoke all on function public.promote_user_to_admin(text) from public;
grant execute on function public.promote_user_to_admin(text) to service_role;

commit;
