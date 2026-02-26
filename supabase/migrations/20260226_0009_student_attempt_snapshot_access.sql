begin;

alter function public.start_or_resume_attempt(uuid) security definer;

drop policy if exists simulator_version_questions_student_select_attempt_scope on public.simulator_version_questions;
create policy simulator_version_questions_student_select_attempt_scope
on public.simulator_version_questions
for select
to authenticated
using (
  exists (
    select 1
    from public.attempts a
    where a.simulator_version_id = simulator_version_questions.simulator_version_id
      and a.student_id = auth.uid()
  )
);

drop policy if exists simulator_version_question_options_student_select_attempt_scope on public.simulator_version_question_options;
create policy simulator_version_question_options_student_select_attempt_scope
on public.simulator_version_question_options
for select
to authenticated
using (
  exists (
    select 1
    from public.simulator_version_questions svq
    inner join public.attempts a
      on a.simulator_version_id = svq.simulator_version_id
    where svq.id = simulator_version_question_options.simulator_version_question_id
      and a.student_id = auth.uid()
  )
);

commit;
