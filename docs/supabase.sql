create extension if not exists pgcrypto;

create table if not exists public.work_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  work_date date not null,
  start_time timestamptz not null,
  end_time timestamptz not null,
  drive_seconds integer not null default 0,
  start_km numeric(10,1) not null,
  end_km numeric(10,1) not null,
  gross_amount numeric(10,2) not null default 0,
  fuel_amount numeric(10,2) not null default 0,
  ride_count integer not null default 0,
  refueled boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

 drop trigger if exists trg_work_days_updated_at on public.work_days;
 create trigger trg_work_days_updated_at
 before update on public.work_days
 for each row execute function public.set_updated_at();

alter table public.work_days enable row level security;

create policy "users_select_own_work_days"
on public.work_days
for select
using (auth.uid() = user_id);

create policy "users_insert_own_work_days"
on public.work_days
for insert
with check (auth.uid() = user_id);

create policy "users_update_own_work_days"
on public.work_days
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "users_delete_own_work_days"
on public.work_days
for delete
using (auth.uid() = user_id);
