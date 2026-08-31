-- Footscray Repair Cafe — initial schema
create extension if not exists pgcrypto;

-- ============ enums ============
create type public.user_role as enum ('visitor', 'volunteer');
create type public.repair_status as enum ('pending', 'confirmed', 'assigned', 'in_progress', 'completed', 'cancelled');
create type public.repair_outcome as enum ('fixed', 'partially_fixed', 'not_repairable', 'advice_given');

-- ============ cafes (multi-cafe ready) ============
create table public.cafes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  suburb text,
  venue text,
  created_at timestamptz not null default now()
);

insert into public.cafes (id, name, suburb, venue)
values ('a0000000-0000-4000-8000-000000000001', 'Footscray Repair Cafe', 'Footscray', 'Angliss Neighbourhood House');

-- ============ profiles ============
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text not null default '',
  email text,
  phone text,
  postcode text,
  suburb text,
  role public.user_role,               -- null until chosen (Google sign-in flow)
  skills text[] not null default '{}', -- volunteer specialisations
  bio text,
  cafe_id uuid references public.cafes default 'a0000000-0000-4000-8000-000000000001',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- helper used by RLS policies (security definer avoids recursive profile lookups)
create or replace function public.is_volunteer()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'volunteer'
  );
$$;

-- auto-create a profile row on signup, reading role/name from signup metadata
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email,
    case
      when new.raw_user_meta_data->>'role' in ('visitor','volunteer')
        then (new.raw_user_meta_data->>'role')::public.user_role
      else null
    end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============ repair requests ============
create table public.repair_requests (
  id uuid primary key default gen_random_uuid(),
  cafe_id uuid not null references public.cafes default 'a0000000-0000-4000-8000-000000000001',
  visitor_id uuid references public.profiles on delete set null,

  -- contact (from booking form)
  visitor_name text not null,
  email text not null default '',
  phone text not null default '',
  postcode text,
  contact_methods text[] not null default '{}',
  languages text,

  -- item
  item text not null,
  category text not null,
  brand text,
  year_of_production text,
  model_serial text,
  problem_description text not null,
  parts_materials text,

  -- booking
  preferred_dates text[] not null default '{}',
  preferred_time text,
  session_date date,
  form_feedback text,

  -- workflow
  status public.repair_status not null default 'pending',
  assigned_repairer_id uuid references public.profiles on delete set null,
  assigned_repairer_name text,
  confirmed_at timestamptz,
  assigned_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,

  -- outcome (filled in by the repairer)
  diagnosis text,
  work_done text,
  repair_possible boolean,
  outcome public.repair_outcome,
  repairer_notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index repair_requests_status_idx on public.repair_requests (status);
create index repair_requests_visitor_idx on public.repair_requests (visitor_id);
create index repair_requests_repairer_idx on public.repair_requests (assigned_repairer_id);
create index repair_requests_created_idx on public.repair_requests (created_at desc);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger repair_requests_updated_at
  before update on public.repair_requests
  for each row execute function public.set_updated_at();

-- ============ volunteer applications ============
create table public.volunteer_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles on delete set null,
  name text not null,
  suburb text not null default '',
  email text not null default '',
  mobile text not null default '',
  skills text[] not null default '{}',
  availability text,
  donate_resources text,
  interested_repairs text[] not null default '{}',
  comments text,
  heard_about text[] not null default '{}',
  status text not null default 'new', -- new / contacted / onboarded
  created_at timestamptz not null default now()
);

-- ============ row level security ============
alter table public.cafes enable row level security;
alter table public.profiles enable row level security;
alter table public.repair_requests enable row level security;
alter table public.volunteer_applications enable row level security;

-- cafes: any signed-in user can read
create policy "cafes readable by authenticated"
  on public.cafes for select to authenticated using (true);

-- profiles
create policy "read own profile or any if volunteer"
  on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_volunteer());

create policy "insert own profile"
  on public.profiles for insert to authenticated
  with check (id = auth.uid());

create policy "update own profile"
  on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- repair requests
create policy "visitors create own requests, volunteers can log walk-ins"
  on public.repair_requests for insert to authenticated
  with check (visitor_id = auth.uid() or public.is_volunteer());

create policy "read own requests or any if volunteer"
  on public.repair_requests for select to authenticated
  using (visitor_id = auth.uid() or public.is_volunteer());

create policy "volunteers manage requests, owners can update their own"
  on public.repair_requests for update to authenticated
  using (visitor_id = auth.uid() or public.is_volunteer())
  with check (visitor_id = auth.uid() or public.is_volunteer());

-- volunteer applications
create policy "submit own application"
  on public.volunteer_applications for insert to authenticated
  with check (user_id = auth.uid());

create policy "read own application or any if volunteer"
  on public.volunteer_applications for select to authenticated
  using (user_id = auth.uid() or public.is_volunteer());

create policy "volunteers triage applications"
  on public.volunteer_applications for update to authenticated
  using (public.is_volunteer()) with check (public.is_volunteer());
