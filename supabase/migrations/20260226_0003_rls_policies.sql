begin;

alter table public.profiles enable row level security;
alter table public.topics enable row level security;
alter table public.questions enable row level security;
alter table public.question_options enable row level security;
alter table public.simulators enable row level security;
alter table public.simulator_versions enable row level security;
alter table public.simulator_version_questions enable row level security;
alter table public.simulator_version_question_options enable row level security;
alter table public.attempts enable row level security;
alter table public.attempt_answers enable row level security;
alter table public.attempt_topic_scores enable row level security;
alter table public.access_code_attempts enable row level security;

drop policy if exists profiles_select_own_or_admin on public.profiles;
create policy profiles_select_own_or_admin
on public.profiles
for select
to authenticated
using (id = auth.uid() or public.is_admin());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists profiles_admin_all on public.profiles;
create policy profiles_admin_all
on public.profiles
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists topics_student_select_active on public.topics;
create policy topics_student_select_active
on public.topics
for select
to authenticated
using (is_active = true);

drop policy if exists topics_admin_all on public.topics;
create policy topics_admin_all
on public.topics
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists questions_admin_all on public.questions;
create policy questions_admin_all
on public.questions
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists question_options_admin_all on public.question_options;
create policy question_options_admin_all
on public.question_options
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists simulators_student_select_visible on public.simulators;
create policy simulators_student_select_visible
on public.simulators
for select
to authenticated
using (status = 'published' and is_active = true);

drop policy if exists simulators_admin_all on public.simulators;
create policy simulators_admin_all
on public.simulators
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists simulator_versions_admin_all on public.simulator_versions;
create policy simulator_versions_admin_all
on public.simulator_versions
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists simulator_version_questions_admin_all on public.simulator_version_questions;
create policy simulator_version_questions_admin_all
on public.simulator_version_questions
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists simulator_version_question_options_admin_all on public.simulator_version_question_options;
create policy simulator_version_question_options_admin_all
on public.simulator_version_question_options
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists attempts_student_select_own on public.attempts;
create policy attempts_student_select_own
on public.attempts
for select
to authenticated
using (student_id = auth.uid());

drop policy if exists attempts_student_insert_own on public.attempts;
create policy attempts_student_insert_own
on public.attempts
for insert
to authenticated
with check (student_id = auth.uid());

drop policy if exists attempts_student_update_active_own on public.attempts;
create policy attempts_student_update_active_own
on public.attempts
for update
to authenticated
using (student_id = auth.uid() and status = 'active')
with check (student_id = auth.uid());

drop policy if exists attempts_admin_all on public.attempts;
create policy attempts_admin_all
on public.attempts
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists attempt_answers_student_select_own on public.attempt_answers;
create policy attempt_answers_student_select_own
on public.attempt_answers
for select
to authenticated
using (
  exists (
    select 1
    from public.attempts a
    where a.id = attempt_answers.attempt_id
      and a.student_id = auth.uid()
  )
);

drop policy if exists attempt_answers_student_insert_active_own on public.attempt_answers;
create policy attempt_answers_student_insert_active_own
on public.attempt_answers
for insert
to authenticated
with check (
  exists (
    select 1
    from public.attempts a
    where a.id = attempt_answers.attempt_id
      and a.student_id = auth.uid()
      and a.status = 'active'
  )
);

drop policy if exists attempt_answers_student_update_active_own on public.attempt_answers;
create policy attempt_answers_student_update_active_own
on public.attempt_answers
for update
to authenticated
using (
  exists (
    select 1
    from public.attempts a
    where a.id = attempt_answers.attempt_id
      and a.student_id = auth.uid()
      and a.status = 'active'
  )
)
with check (
  exists (
    select 1
    from public.attempts a
    where a.id = attempt_answers.attempt_id
      and a.student_id = auth.uid()
      and a.status = 'active'
  )
);

drop policy if exists attempt_answers_admin_all on public.attempt_answers;
create policy attempt_answers_admin_all
on public.attempt_answers
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists attempt_topic_scores_student_select_own on public.attempt_topic_scores;
create policy attempt_topic_scores_student_select_own
on public.attempt_topic_scores
for select
to authenticated
using (
  exists (
    select 1
    from public.attempts a
    where a.id = attempt_topic_scores.attempt_id
      and a.student_id = auth.uid()
  )
);

drop policy if exists attempt_topic_scores_admin_all on public.attempt_topic_scores;
create policy attempt_topic_scores_admin_all
on public.attempt_topic_scores
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists access_code_attempts_student_select_own on public.access_code_attempts;
create policy access_code_attempts_student_select_own
on public.access_code_attempts
for select
to authenticated
using (student_id = auth.uid());

drop policy if exists access_code_attempts_student_insert_own on public.access_code_attempts;
create policy access_code_attempts_student_insert_own
on public.access_code_attempts
for insert
to authenticated
with check (student_id = auth.uid());

drop policy if exists access_code_attempts_admin_all on public.access_code_attempts;
create policy access_code_attempts_admin_all
on public.access_code_attempts
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

commit;
