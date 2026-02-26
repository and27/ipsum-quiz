begin;

create or replace function public.get_attempt_score_rows(
  p_attempt_id uuid
)
returns table (
  simulator_version_question_id uuid,
  selected_option_id uuid,
  question_topic_id uuid,
  topic_name text,
  correct_option_id uuid
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    aa.simulator_version_question_id,
    aa.selected_option_id,
    svq.topic_id as question_topic_id,
    t.name as topic_name,
    (
      select svqo.id
      from public.simulator_version_question_options svqo
      where svqo.simulator_version_question_id = aa.simulator_version_question_id
        and svqo.is_correct = true
      limit 1
    ) as correct_option_id
  from public.attempt_answers aa
  inner join public.simulator_version_questions svq
    on svq.id = aa.simulator_version_question_id
  inner join public.topics t
    on t.id = svq.topic_id
  where aa.attempt_id = p_attempt_id;
$$;

revoke all on function public.get_attempt_score_rows(uuid) from public;
grant execute on function public.get_attempt_score_rows(uuid)
to authenticated, service_role;

create or replace function public.set_attempt_answers_correctness(
  p_attempt_id uuid
)
returns void
language sql
volatile
security invoker
set search_path = public
as $$
  update public.attempt_answers aa
  set is_correct = (
    aa.selected_option_id is not null
    and exists (
      select 1
      from public.simulator_version_question_options svqo
      where svqo.id = aa.selected_option_id
        and svqo.simulator_version_question_id = aa.simulator_version_question_id
        and svqo.is_correct = true
    )
  )
  where aa.attempt_id = p_attempt_id;
$$;

revoke all on function public.set_attempt_answers_correctness(uuid) from public;
grant execute on function public.set_attempt_answers_correctness(uuid)
to authenticated, service_role;

commit;

