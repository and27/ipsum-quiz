begin;

alter table public.profiles
  drop constraint if exists profiles_grade_score_check;

alter table public.profiles
  add constraint profiles_grade_score_check
  check (
    grade_score is null
    or (grade_score >= 0 and grade_score <= 10)
  );

commit;
