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
  -- the day this rating (first or last) was given
  rated_on        date,
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
  submission_id   text not null default '',
  rated_on        date
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

-- OpEx ratings of teachers (also in supabase/add-opex.sql for databases created before this table existed)
create table if not exists opex_ratings (
  id              bigint generated always as identity primary key,
  instructor_name text not null,
  branch          text not null default '',
  rater           text not null default '',
  scores          numeric[] not null,
  average_rating  numeric,
  remarks         text not null default '',
  rated_on        date not null default current_date,
  created_at      timestamptz not null default now()
);
create index if not exists opex_ratings_rated_on_idx on opex_ratings (rated_on);
alter table opex_ratings enable row level security;
drop policy if exists app_all on opex_ratings;
create policy app_all on opex_ratings for all to anon using (true) with check (true);

-- Programme team ratings (also in supabase/add-programme-team.sql)
create table if not exists programme_ratings (
  id                   bigint generated always as identity primary key,
  instructor_name      text not null,
  branch               text not null default '',
  -- the Programme team member who observed the class
  rater                text not null default '',
  -- the ten criteria, in order; null = left blank
  scores               numeric[] not null,
  average_rating       numeric,
  strengths            text not null default '',
  areas_of_development text not null default '',
  remarks              text not null default '',
  -- the observation date
  rated_on             date not null default current_date,
  created_at           timestamptz not null default now()
);
create index if not exists programme_ratings_rated_on_idx on programme_ratings (rated_on);

alter table programme_ratings enable row level security;
drop policy if exists app_all on programme_ratings;
create policy app_all on programme_ratings for all to anon using (true) with check (true);
