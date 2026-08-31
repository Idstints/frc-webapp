-- Matching now scores name, phone and email independently and needs at least
-- two of the three to agree. Two matching details are enough to open the
-- existing record, so this is an access check, not just a duplicate hint.
alter table public.profiles
  add column if not exists last_claimed_at timestamptz;

drop function if exists public.find_visitor_match(text, text, text);

create function public.find_visitor_match(p_name text, p_phone text, p_email text)
returns table (visitor_id uuid, repairs bigint, match_score int)
language sql stable security definer set search_path = public as $$
  with norm as (
    select
      regexp_replace(lower(coalesce(p_name, '')), '[^a-z]', '', 'g') as name,
      right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 9) as phone,
      lower(btrim(coalesce(p_email, ''))) as email
  ),
  scored as (
    select
      p.id,
        (case when n.name <> ''
              and regexp_replace(lower(coalesce(p.full_name, '')), '[^a-z]', '', 'g') = n.name
              then 1 else 0 end)
      + (case when n.phone <> ''
              and right(regexp_replace(coalesce(p.phone, ''), '\D', '', 'g'), 9) = n.phone
              then 1 else 0 end)
      + (case when n.email <> ''
              and lower(btrim(coalesce(p.email, ''))) = n.email
              then 1 else 0 end) as score
    from public.profiles p, norm n
    where p.role = 'visitor' and p.is_active
  )
  select s.id,
         (select count(*) from public.repair_requests r where r.visitor_id = s.id),
         s.score
  from scored s
  where s.score >= 2
  order by s.score desc,
           (select count(*) from public.repair_requests r where r.visitor_id = s.id) desc
  limit 1;
$$;

revoke all on function public.find_visitor_match(text, text, text) from public;
revoke all on function public.find_visitor_match(text, text, text) from anon;
revoke all on function public.find_visitor_match(text, text, text) from authenticated;
