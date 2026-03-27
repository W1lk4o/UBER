create extension if not exists pgcrypto;

create table if not exists public.work_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  work_date date not null,
  start_time timestamptz not null,
  end_time timestamptz not null,
  drive_seconds integer not null default 0,
  start_km numeric(10,1) not null default 0,
  end_km numeric(10,1) not null default 0,
  gross_amount numeric(10,2) not null default 0,
  fuel_amount numeric(10,2) not null default 0,
  ride_count integer not null default 0,
  refueled boolean not null default false,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists work_days_user_date_idx on public.work_days(user_id, work_date desc);

alter table public.work_days enable row level security;

drop policy if exists "work_days_select_own" on public.work_days;
create policy "work_days_select_own"
  on public.work_days for select
  using (auth.uid() = user_id);

drop policy if exists "work_days_insert_own" on public.work_days;
create policy "work_days_insert_own"
  on public.work_days for insert
  with check (auth.uid() = user_id);

drop policy if exists "work_days_update_own" on public.work_days;
create policy "work_days_update_own"
  on public.work_days for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "work_days_delete_own" on public.work_days;
create policy "work_days_delete_own"
  on public.work_days for delete
  using (auth.uid() = user_id);
