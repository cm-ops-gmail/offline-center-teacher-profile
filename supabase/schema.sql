-- Run this once in Supabase → SQL Editor → New query → Run.
-- Then load the demo data with:  npm run db:seed

create table if not exists master_ratings (
  id              bigint generated always as identity primary key,
  program         text not null check (program in ('ielts','sej','ef','assc')),
  instructor_name text not null,
  branch          text not null default '',
  level           text,
  batch           text not null default '',
  class           text not null check (class in ('first','last')),
  -- one entry per criterion of the programme, in order; null = left blank
  scores          numeric[] not null,
  average_rating  numeric,
  remarks         text not null default '',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists master_ratings_program_idx on master_ratings (program, class);

create table if not exists student_responses (
  id              bigint generated always as identity primary key,
  program         text not null check (program in ('ielts','sej','ef','assc')),
  instructor_name text not null,
  branch          text not null default '',
  level           text,
  batch           text not null default '',
  class           text not null check (class in ('first','last')),
  users_rated     integer,
  scores          numeric[] not null,
  average_rating  numeric,
  feedback        text not null default '',
  form_date       text not null default '',
  source_file     text not null default '',
  submitted_at    timestamptz not null default now(),
  submission_id   text not null default ''
);
create index if not exists student_responses_program_idx on student_responses (program, class);

create table if not exists lookups (
  id    bigint generated always as identity primary key,
  kind  text not null check (kind in ('branch','batch')),
  value text not null,
  unique (kind, value)
);

-- The app talks to Supabase from its server with the publishable key, so the "anon" role needs access.
-- (Safer later: put the secret key in SUPABASE_SERVICE_ROLE_KEY and delete these three policies.)
alter table master_ratings    enable row level security;
alter table student_responses enable row level security;
alter table lookups           enable row level security;

drop policy if exists app_all on master_ratings;
drop policy if exists app_all on student_responses;
drop policy if exists app_all on lookups;
create policy app_all on master_ratings    for all to anon using (true) with check (true);
create policy app_all on student_responses for all to anon using (true) with check (true);
create policy app_all on lookups           for all to anon using (true) with check (true);
