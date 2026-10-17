-- Run once in Supabase → SQL Editor. Adds the date each rating was given.
alter table master_ratings    add column if not exists rated_on date;
alter table student_responses add column if not exists rated_on date;
create index if not exists master_ratings_rated_on_idx on master_ratings (rated_on);
