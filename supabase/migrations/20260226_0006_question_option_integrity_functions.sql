begin;

create or replace function public.get_question_option_integrity(p_question_id uuid)
returns table (
  active_options integer,
  active_correct_options integer,
  is_ready boolean
)
language sql
stable
set search_path = public
as $$
  with stats as (
    select
      count(*) filter (where qo.is_active) as active_options,
      count(*) filter (where qo.is_active and qo.is_correct) as active_correct_options
    from public.question_options qo
    where qo.question_id = p_question_id
  )
  select
    stats.active_options::integer as active_options,
    stats.active_correct_options::integer as active_correct_options,
    (stats.active_options >= 2 and stats.active_correct_options = 1) as is_ready
  from stats;
$$;

revoke all on function public.get_question_option_integrity(uuid) from public;
grant execute on function public.get_question_option_integrity(uuid)
to authenticated, service_role;

create or replace function public.set_question_option_correct(
  p_question_id uuid,
  p_option_id uuid
)
returns public.question_options
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_option public.question_options;
begin
  select *
  into v_option
  from public.question_options qo
  where qo.question_id = p_question_id
    and qo.id = p_option_id
  limit 1;

  if v_option.id is null then
    raise exception 'Option was not found.';
  end if;

  if not v_option.is_active then
    raise exception 'Correct option must be active.';
  end if;

  update public.question_options
  set is_correct = (id = p_option_id)
  where question_id = p_question_id
    and is_active = true;

  select *
  into v_option
  from public.question_options qo
  where qo.question_id = p_question_id
    and qo.id = p_option_id
  limit 1;

  return v_option;
end;
$$;

revoke all on function public.set_question_option_correct(uuid, uuid) from public;
grant execute on function public.set_question_option_correct(uuid, uuid)
to authenticated, service_role;

commit;
