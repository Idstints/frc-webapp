-- ===== Volunteer approval gate =====
-- New volunteer accounts see nothing until a current team member approves them.
alter table public.profiles add column approved boolean not null default false;

-- current team members stay approved
update public.profiles set approved = true where role = 'volunteer';

-- team privileges now require approval
create or replace function public.is_volunteer()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'volunteer' and approved = true
  );
$$;

-- column-safe approval action: approve a pending volunteer, or decline them
-- (declining converts the account to a visitor account)
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
    update public.profiles set approved = true where id = target_id and role = 'volunteer';
  else
    update public.profiles set role = 'visitor', approved = false where id = target_id;
  end if;
end;
$$;

revoke execute on function public.set_volunteer_approval(uuid, boolean) from anon, public;
grant execute on function public.set_volunteer_approval(uuid, boolean) to authenticated;

-- ===== Appointment slot availability =====
-- Privacy-preserving aggregate: visitors see only how many bookings each slot
-- holds for upcoming sessions — never whose they are.
create or replace function public.slot_availability(from_date date)
returns table (session_date date, preferred_time text, bookings bigint)
language sql stable security definer
set search_path = public
as $$
  select r.session_date, r.preferred_time, count(*)::bigint
  from public.repair_requests r
  where r.session_date >= from_date
    and r.status <> 'cancelled'
    and r.preferred_time is not null
  group by r.session_date, r.preferred_time;
$$;

revoke execute on function public.slot_availability(date) from anon, public;
grant execute on function public.slot_availability(date) to authenticated;
