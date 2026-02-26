begin;

drop policy if exists attempt_topic_scores_student_insert_active_own on public.attempt_topic_scores;
create policy attempt_topic_scores_student_insert_active_own
on public.attempt_topic_scores
for insert
to authenticated
with check (
  exists (
    select 1
    from public.attempts a
    where a.id = attempt_topic_scores.attempt_id
      and a.student_id = auth.uid()
      and a.status = 'active'
  )
);

drop policy if exists attempt_topic_scores_student_update_active_own on public.attempt_topic_scores;
create policy attempt_topic_scores_student_update_active_own
on public.attempt_topic_scores
for update
to authenticated
using (
  exists (
    select 1
    from public.attempts a
    where a.id = attempt_topic_scores.attempt_id
      and a.student_id = auth.uid()
      and a.status = 'active'
  )
)
with check (
  exists (
    select 1
    from public.attempts a
    where a.id = attempt_topic_scores.attempt_id
      and a.student_id = auth.uid()
      and a.status = 'active'
  )
);

drop policy if exists attempt_topic_scores_student_delete_active_own on public.attempt_topic_scores;
create policy attempt_topic_scores_student_delete_active_own
on public.attempt_topic_scores
for delete
to authenticated
using (
  exists (
    select 1
    from public.attempts a
    where a.id = attempt_topic_scores.attempt_id
      and a.student_id = auth.uid()
      and a.status = 'active'
  )
);

commit;
