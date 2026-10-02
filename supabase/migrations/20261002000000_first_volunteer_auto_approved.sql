-- First team member approves themselves.
--
-- Volunteer accounts start unapproved and see nothing until an existing
-- repairer approves them. On a fresh install there is no repairer, so nobody
-- could ever be approved. This makes the first volunteer sign-up while no
-- approved volunteer exists become an approved volunteer automatically.
--
-- After that, the normal rule applies and approvals happen in the app
-- (Repair board > Repairers).
--
-- Trade-off: until the first account exists, whoever signs up first as a
-- volunteer becomes the first repairer. Create it before the site is put on
-- the internet.

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

  insert into public.profiles (id, full_name, email, role, approved)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email,
    want_role,
    make_first
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from anon, authenticated, public;
grant execute on function public.handle_new_user() to supabase_auth_admin;
