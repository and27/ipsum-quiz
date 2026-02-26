begin;

create or replace function public.start_or_resume_attempt(
  p_simulator_id uuid
)
returns table (
  attempt_id uuid,
  resumed boolean,
  expires_at timestamptz,
  questions_total integer,
  simulator_version_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_now timestamptz := now();
  v_lock_key bigint;
  v_simulator record;
  v_active_attempt record;
  v_attempts_used integer;
  v_questions_total integer;
  v_created_attempt record;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select
    s.id,
    s.published_version_id,
    s.duration_minutes,
    s.max_attempts
  into v_simulator
  from public.simulators s
  where s.id = p_simulator_id
    and s.status = 'published'
    and s.is_active = true
  limit 1;

  if v_simulator.id is null or v_simulator.published_version_id is null then
    raise exception 'SIMULATOR_NOT_AVAILABLE';
  end if;

  v_lock_key := hashtextextended(v_user_id::text || ':' || p_simulator_id::text, 0);
  perform pg_advisory_xact_lock(v_lock_key);

  select
    a.id,
    a.expires_at,
    a.questions_total,
    a.simulator_version_id
  into v_active_attempt
  from public.attempts a
  where a.simulator_id = p_simulator_id
    and a.student_id = v_user_id
    and a.status = 'active'
  order by a.started_at desc
  limit 1;

  if v_active_attempt.id is not null then
    if v_active_attempt.expires_at <= v_now then
      update public.attempts a
      set status = 'expired',
          finished_at = v_now
      where a.id = v_active_attempt.id
        and a.status = 'active';
    else
      return query
      select
        v_active_attempt.id::uuid,
        true,
        v_active_attempt.expires_at::timestamptz,
        v_active_attempt.questions_total::integer,
        v_active_attempt.simulator_version_id::uuid;
      return;
    end if;
  end if;

  select count(*)
  into v_attempts_used
  from public.attempts a
  where a.simulator_id = p_simulator_id
    and a.student_id = v_user_id;

  if v_attempts_used >= v_simulator.max_attempts then
    raise exception 'MAX_ATTEMPTS_REACHED';
  end if;

  select count(*)
  into v_questions_total
  from public.simulator_version_questions svq
  where svq.simulator_version_id = v_simulator.published_version_id;

  if v_questions_total <= 0 then
    raise exception 'VERSION_HAS_NO_QUESTIONS';
  end if;

  insert into public.attempts as a (
    simulator_id,
    simulator_version_id,
    student_id,
    status,
    started_at,
    expires_at,
    questions_total
  )
  values (
    p_simulator_id,
    v_simulator.published_version_id,
    v_user_id,
    'active',
    v_now,
    v_now + make_interval(mins => v_simulator.duration_minutes),
    v_questions_total
  )
  returning
    a.id,
    a.expires_at,
    a.questions_total,
    a.simulator_version_id
  into v_created_attempt;

  insert into public.attempt_answers (
    attempt_id,
    simulator_version_question_id
  )
  select
    v_created_attempt.id,
    svq.id
  from public.simulator_version_questions svq
  where svq.simulator_version_id = v_simulator.published_version_id;

  update public.simulator_versions sv
  set has_attempts = true
  where sv.id = v_simulator.published_version_id;

  return query
  select
    v_created_attempt.id::uuid,
    false,
    v_created_attempt.expires_at::timestamptz,
    v_created_attempt.questions_total::integer,
    v_created_attempt.simulator_version_id::uuid;
end;
$$;

revoke all on function public.start_or_resume_attempt(uuid) from public;
grant execute on function public.start_or_resume_attempt(uuid)
to authenticated, service_role;

commit;
