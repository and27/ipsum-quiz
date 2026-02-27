begin;

alter table public.attempts
  add column if not exists blank_count integer;

alter table public.attempt_topic_scores
  add column if not exists blank_count integer;

alter table public.attempts
  drop constraint if exists attempts_blank_count_check;

alter table public.attempts
  add constraint attempts_blank_count_check
  check (blank_count is null or blank_count >= 0);

alter table public.attempt_topic_scores
  drop constraint if exists attempt_topic_scores_blank_count_check;

alter table public.attempt_topic_scores
  add constraint attempt_topic_scores_blank_count_check
  check (blank_count is null or blank_count >= 0);

commit;
