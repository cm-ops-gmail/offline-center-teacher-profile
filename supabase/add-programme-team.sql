-- Run once in Supabase → SQL Editor. Adds the Programme team's classroom-observation ratings of teachers.
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
