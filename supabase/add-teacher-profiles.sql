-- Run once in Supabase → SQL Editor. Adds the editable teacher profiles
-- (the "Manage profile" dialog on a teacher's page).
create table if not exists teacher_profiles (
  -- the teacher's id in the app (the slug of their name in master_ratings)
  teacher_id           text primary key,
  name                 text not null default '',
  designation          text not null default '',
  email                text not null default '',
  phone                text not null default '',
  years_of_experience numeric check (years_of_experience is null or years_of_experience >= 0),
  status               text not null default 'active' check (status in ('active','inactive')),
  address              text not null default '',
  -- public URL of the photo in the "teacher-photos" storage bucket
  image_url            text,
  updated_at           timestamptz not null default now()
);

alter table teacher_profiles enable row level security;
drop policy if exists app_all on teacher_profiles;
create policy app_all on teacher_profiles for all to anon using (true) with check (true);

-- A public bucket for the teacher photos. The app writes through the server
-- (service-role key when configured), so no direct-to-browser uploads happen.
insert into storage.buckets (id, name, public)
values ('teacher-photos', 'teacher-photos', true)
on conflict (id) do nothing;

-- Needed only when the project has no service-role key configured; harmless otherwise.
drop policy if exists app_all_teacher_photos on storage.objects;
create policy app_all_teacher_photos on storage.objects
  for all to anon
  using (bucket_id = 'teacher-photos')
  with check (bucket_id = 'teacher-photos');
