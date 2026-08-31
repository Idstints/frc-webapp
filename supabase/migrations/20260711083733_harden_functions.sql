-- lock down trigger/helper functions per security advisor
alter function public.set_updated_at() set search_path = public;

revoke execute on function public.handle_new_user() from anon, authenticated, public;
grant execute on function public.handle_new_user() to supabase_auth_admin;

-- is_volunteer stays executable by authenticated (used inside RLS policies)
revoke execute on function public.is_volunteer() from anon, public;
