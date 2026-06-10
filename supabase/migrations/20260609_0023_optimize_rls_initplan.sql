begin;

-- Optimizacion de performance de RLS (recomendada por Supabase):
-- envolver las llamadas a funciones (auth.uid(), public.is_admin()) en un
-- subquery escalar `(select ...)`. Asi el planner las evalua UNA sola vez por
-- statement (InitPlan) en vez de una vez por fila.
--
-- Contexto: las tablas del flujo de examen (preguntas, opciones, respuestas)
-- se leen en lotes de decenas/cientos de filas. Como las policies permissive se
-- combinan con OR, en cada lectura se evaluaban TANTO la policy del estudiante
-- COMO la admin_all (is_admin() -> query a profiles) por cada fila. Esto deja
-- esas evaluaciones en O(1) por statement.
--
-- Semantica identica a 20260226_0003 y 20260226_0009; solo cambia el envoltorio
-- (select ...). Idempotente vía drop/create.

-- profiles
drop policy if exists profiles_select_own_or_admin on public.profiles;
create policy profiles_select_own_or_admin
on public.profiles
for select
to authenticated
using (id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
on public.profiles
for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

drop policy if exists profiles_admin_all on public.profiles;
create policy profiles_admin_all
on public.profiles
for all
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

-- topics
drop policy if exists topics_admin_all on public.topics;
create policy topics_admin_all
on public.topics
for all
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

-- questions
drop policy if exists questions_admin_all on public.questions;
create policy questions_admin_all
on public.questions
for all
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

-- question_options
drop policy if exists question_options_admin_all on public.question_options;
create policy question_options_admin_all
on public.question_options
for all
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

-- simulators
drop policy if exists simulators_admin_all on public.simulators;
create policy simulators_admin_all
on public.simulators
for all
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

-- simulator_versions
drop policy if exists simulator_versions_admin_all on public.simulator_versions;
create policy simulator_versions_admin_all
on public.simulator_versions
for all
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

-- simulator_version_questions (tabla caliente del examen)
drop policy if exists simulator_version_questions_admin_all on public.simulator_version_questions;
create policy simulator_version_questions_admin_all
on public.simulator_version_questions
for all
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

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
      and a.student_id = (select auth.uid())
  )
);

-- simulator_version_question_options (tabla caliente del examen)
drop policy if exists simulator_version_question_options_admin_all on public.simulator_version_question_options;
create policy simulator_version_question_options_admin_all
on public.simulator_version_question_options
for all
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

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
      and a.student_id = (select auth.uid())
  )
);

-- attempts
drop policy if exists attempts_student_select_own on public.attempts;
create policy attempts_student_select_own
on public.attempts
for select
to authenticated
using (student_id = (select auth.uid()));

drop policy if exists attempts_student_insert_own on public.attempts;
create policy attempts_student_insert_own
on public.attempts
for insert
to authenticated
with check (student_id = (select auth.uid()));

drop policy if exists attempts_student_update_active_own on public.attempts;
create policy attempts_student_update_active_own
on public.attempts
for update
to authenticated
using (student_id = (select auth.uid()) and status = 'active')
with check (student_id = (select auth.uid()));

drop policy if exists attempts_admin_all on public.attempts;
create policy attempts_admin_all
on public.attempts
for all
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

-- attempt_answers (tabla caliente del examen)
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
      and a.student_id = (select auth.uid())
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
      and a.student_id = (select auth.uid())
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
      and a.student_id = (select auth.uid())
      and a.status = 'active'
  )
)
with check (
  exists (
    select 1
    from public.attempts a
    where a.id = attempt_answers.attempt_id
      and a.student_id = (select auth.uid())
      and a.status = 'active'
  )
);

drop policy if exists attempt_answers_admin_all on public.attempt_answers;
create policy attempt_answers_admin_all
on public.attempt_answers
for all
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

-- attempt_topic_scores
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
      and a.student_id = (select auth.uid())
  )
);

drop policy if exists attempt_topic_scores_admin_all on public.attempt_topic_scores;
create policy attempt_topic_scores_admin_all
on public.attempt_topic_scores
for all
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

-- access_code_attempts
drop policy if exists access_code_attempts_student_select_own on public.access_code_attempts;
create policy access_code_attempts_student_select_own
on public.access_code_attempts
for select
to authenticated
using (student_id = (select auth.uid()));

drop policy if exists access_code_attempts_student_insert_own on public.access_code_attempts;
create policy access_code_attempts_student_insert_own
on public.access_code_attempts
for insert
to authenticated
with check (student_id = (select auth.uid()));

drop policy if exists access_code_attempts_admin_all on public.access_code_attempts;
create policy access_code_attempts_admin_all
on public.access_code_attempts
for all
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

commit;
