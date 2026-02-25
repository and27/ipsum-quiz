begin;

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'student' check (role in ('admin', 'student')),
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.topics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.topics (id),
  statement text not null,
  image_url text,
  is_active boolean not null default true,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.question_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions (id) on delete cascade,
  position integer not null check (position > 0),
  text text not null,
  image_url text,
  is_correct boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (question_id, position)
);

create table if not exists public.simulators (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  access_code_hash text,
  max_attempts integer not null default 3 check (max_attempts > 0),
  duration_minutes integer not null check (duration_minutes > 0),
  is_active boolean not null default false,
  status text not null default 'draft' check (status in ('draft', 'published')),
  published_version_id uuid,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.simulator_versions (
  id uuid primary key default gen_random_uuid(),
  simulator_id uuid not null references public.simulators (id) on delete cascade,
  version_number integer not null check (version_number > 0),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_from_version_id uuid references public.simulator_versions (id),
  published_at timestamptz,
  has_attempts boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (simulator_id, version_number)
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'simulators_published_version_fk'
  ) then
    alter table public.simulators
      add constraint simulators_published_version_fk
      foreign key (published_version_id) references public.simulator_versions (id);
  end if;
end
$$;

create table if not exists public.simulator_version_questions (
  id uuid primary key default gen_random_uuid(),
  simulator_version_id uuid not null references public.simulator_versions (id) on delete cascade,
  position integer not null check (position > 0),
  topic_id uuid not null references public.topics (id),
  statement text not null,
  image_url text,
  source_question_id uuid references public.questions (id),
  created_at timestamptz not null default now(),
  unique (simulator_version_id, position)
);

create table if not exists public.simulator_version_question_options (
  id uuid primary key default gen_random_uuid(),
  simulator_version_question_id uuid not null references public.simulator_version_questions (id) on delete cascade,
  position integer not null check (position > 0),
  text text not null,
  image_url text,
  is_correct boolean not null,
  created_at timestamptz not null default now(),
  unique (simulator_version_question_id, position),
  unique (id, simulator_version_question_id)
);

create table if not exists public.attempts (
  id uuid primary key default gen_random_uuid(),
  simulator_id uuid not null references public.simulators (id),
  simulator_version_id uuid not null references public.simulator_versions (id),
  student_id uuid not null references public.profiles (id),
  status text not null check (status in ('active', 'finished', 'expired')),
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  finished_at timestamptz,
  score_total integer,
  questions_total integer not null check (questions_total > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.attempt_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.attempts (id) on delete cascade,
  simulator_version_question_id uuid not null references public.simulator_version_questions (id),
  selected_option_id uuid,
  is_correct boolean,
  answered_at timestamptz,
  created_at timestamptz not null default now(),
  unique (attempt_id, simulator_version_question_id),
  foreign key (selected_option_id, simulator_version_question_id)
    references public.simulator_version_question_options (id, simulator_version_question_id)
);

create table if not exists public.attempt_topic_scores (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.attempts (id) on delete cascade,
  topic_id uuid not null references public.topics (id),
  correct_count integer not null check (correct_count >= 0),
  total_count integer not null check (total_count > 0),
  created_at timestamptz not null default now(),
  unique (attempt_id, topic_id)
);

create table if not exists public.access_code_attempts (
  id bigserial primary key,
  simulator_id uuid not null references public.simulators (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  ip inet not null,
  success boolean not null,
  created_at timestamptz not null default now()
);

commit;
