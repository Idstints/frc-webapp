-- Coordinators, and a guard on the columns that grant access.
--
-- 1. Profile guard. The "update own profile" policy lets a signed-in user
--    write any column of their own row, so anyone holding a ticket could set
--    role = 'volunteer', approved = true on themselves and read every
--    visitor's contact details. RLS can't restrict columns, so a trigger does:
--    calls straight from the browser can no longer change approved or
--    is_coordinator, and can change role only in the two ways the app does.
--    Privileged paths run as other database roles and are unaffected:
--    handle_new_user (supabase_auth_admin), the security definer functions
--    below (their owner), edge functions (service_role), scripts and Studio
--    (postgres).
--
-- 2. Coordinators. An approved volunteer who can also set a new password for
--    another volunteer, and make or remove other coordinators. There can be
--    any number, but never zero once there is one: the last coordinator can't
--    be removed from inside the app.
--
-- 3. password_resets. A record of every password a coordinator sets.

-- ===== Coordinator flag =====
alter table public.profiles add column is_coordinator boolean not null default false;

create or replace function public.is_coordinator()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'volunteer' and approved = true and is_coordinator = true
  );
$$;

revoke execute on function public.is_coordinator() from anon, public;
grant execute on function public.is_coordinator() to authenticated;

-- ===== Profile guard =====
-- Deliberately not security definer: current_user must be the caller's role.
create or replace function public.guard_profile_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.approved := false;
    new.is_coordinator := false;
    return new;
  end if;

  if new.approved is distinct from old.approved then
    raise exception 'Approval can only be changed by the repair team';
  end if;
  if new.is_coordinator is distinct from old.is_coordinator then
    raise exception 'Coordinators can only be changed by a coordinator';
  end if;

  if new.role is distinct from old.role then
    -- Choosing a role for the first time (RoleSelectPage), or an unapproved
    -- volunteer switching to a visitor account (PendingApprovalPage).
    if not (
      (old.role is null and new.role in ('visitor', 'volunteer'))
      or (old.role = 'volunteer' and old.approved = false and new.role = 'visitor')
    ) then
      raise exception 'That account type change is not allowed';
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function public.guard_profile_columns() from anon, authenticated, public;

drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard
  before insert or update on public.profiles
  for each row execute function public.guard_profile_columns();

-- ===== Approvals only touch pending volunteers =====
-- Unchanged in purpose, but declining now applies only to someone still
-- waiting for approval. Before, any approved volunteer could call this
-- directly and turn any team member, coordinators included, into a visitor.
create or replace function public.set_volunteer_approval(target_id uuid, make_approved boolean)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not public.is_volunteer() then
    raise exception 'Only approved volunteers can manage the team';
  end if;
  if make_approved then
    update public.profiles set approved = true
     where id = target_id and role = 'volunteer' and approved = false;
  else
    update public.profiles set role = 'visitor', approved = false, is_coordinator = false
     where id = target_id and role = 'volunteer' and approved = false;
  end if;
end;
$$;

revoke execute on function public.set_volunteer_approval(uuid, boolean) from anon, public;
grant execute on function public.set_volunteer_approval(uuid, boolean) to authenticated;

-- ===== Making and removing coordinators =====
create or replace function public.set_coordinator(target_id uuid, make_coordinator boolean)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not public.is_coordinator() then
    raise exception 'Only coordinators can change who is a coordinator';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = target_id and role = 'volunteer' and approved = true
  ) then
    raise exception 'Only approved repairers can be coordinators';
  end if;

  if make_coordinator then
    update public.profiles set is_coordinator = true where id = target_id;
  else
    -- serialise removals so two coordinators can't remove each other at once
    perform pg_advisory_xact_lock(hashtext('frc-coordinators'));
    if not exists (
      select 1 from public.profiles
      where is_coordinator = true and role = 'volunteer' and approved = true and id <> target_id
    ) then
      raise exception 'This is the last coordinator. Make someone else a coordinator first.';
    end if;
    update public.profiles set is_coordinator = false where id = target_id;
  end if;
end;
$$;

revoke execute on function public.set_coordinator(uuid, boolean) from anon, public;
grant execute on function public.set_coordinator(uuid, boolean) to authenticated;

-- ===== The first volunteer is also the first coordinator =====
-- Same as 20261002000000_first_volunteer_auto_approved.sql, plus is_coordinator.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  want_role public.user_role;
  make_first boolean := false;
begin
  want_role := case
    when new.raw_user_meta_data->>'role' in ('visitor','volunteer')
      then (new.raw_user_meta_data->>'role')::public.user_role
    else null
  end;

  if want_role = 'volunteer' then
    -- serialise simultaneous sign-ups so only one can become the first
    perform pg_advisory_xact_lock(hashtext('frc-first-volunteer'));
    make_first := not exists (
      select 1 from public.profiles where role = 'volunteer' and approved = true
    );
  end if;

  insert into public.profiles (id, full_name, email, role, approved, is_coordinator)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email,
    want_role,
    make_first,
    make_first
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from anon, authenticated, public;
grant execute on function public.handle_new_user() to supabase_auth_admin;

-- ===== Password reset log =====
-- Written only by the admin-set-password edge function (service role).
create table public.password_resets (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles on delete set null,
  target_id uuid references public.profiles on delete set null,
  created_at timestamptz not null default now()
);

alter table public.password_resets enable row level security;

create policy "coordinators read password resets"
  on public.password_resets for select to authenticated
  using (public.is_coordinator());

revoke all on public.password_resets from anon;
revoke insert, update, delete on public.password_resets from authenticated;
