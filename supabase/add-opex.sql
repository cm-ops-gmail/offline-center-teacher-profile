-- Run once in Supabase → SQL Editor. Adds the OpEx team's monthly ratings of teachers.
create table if not exists opex_ratings (
  id              bigint generated always as identity primary key,
  instructor_name text not null,
  branch          text not null default '',
  -- who rated: the OpEx / ABM / AC person (or people) for the branch
  rater           text not null default '',
  -- the six questions, in order; null = left blank
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
