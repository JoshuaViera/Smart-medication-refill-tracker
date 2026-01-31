-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- to create the medications table and allow the app to read/write.

-- Create the medications table
create table if not exists public.medications (
  id bigint generated always as identity primary key,
  name text not null,
  dosage text not null,
  schedule jsonb not null default '[]'::jsonb,
  stock integer not null default 0 check (stock >= 0),
  refill_threshold integer not null default 7 check (refill_threshold >= 0),
  expires_on date not null,
  last_taken timestamptz,
  image_url text
);

-- If the table already exists, add image_url with: alter table public.medications add column if not exists image_url text;

-- Optional: add a comment so you know what the table is for
comment on table public.medications is 'Medications and refill tracking for the Smart Medication Tracker app';

-- Enable Row Level Security (RLS)
alter table public.medications enable row level security;

-- Policy: allow all operations for anonymous users (anon key).
-- For a real app you would restrict by user id after adding auth.
create policy "Allow all for anon"
  on public.medications
  for all
  to anon
  using (true)
  with check (true);

-- If you use Supabase Auth later, you can replace the above with:
-- create policy "Users can manage own medications"
--   on public.medications for all to authenticated
--   using (auth.uid() = user_id)
--   with check (auth.uid() = user_id);
-- (and add a user_id column to the table)
