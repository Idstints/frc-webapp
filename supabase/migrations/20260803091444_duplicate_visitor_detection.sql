-- When someone books again from scratch — usually because they lost their card —
-- we want to notice that we already have them, without letting a name and a
-- phone number act as a way into an existing record.

alter table public.profiles
  add column if not exists possible_duplicate_of uuid references public.profiles(id) on delete set null;

create index if not exists profiles_possible_duplicate_idx
  on public.profiles (possible_duplicate_of) where possible_duplicate_of is not null;

-- Matches on the name plus either contact detail. Phones compare on the last
-- nine digits so +61 4… and 04… are the same number, and names ignore case,
-- spacing and punctuation.
create or replace function public.find_visitor_match(p_name text, p_phone text, p_email text)
returns table (visitor_id uuid, repairs bigint)
language sql stable security definer set search_path = public as $$
  with norm as (
    select
      regexp_replace(lower(coalesce(p_name, '')), '[^a-z]', '', 'g') as name,
      right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 9) as phone,
      lower(btrim(coalesce(p_email, ''))) as email
  )
  select p.id,
         (select count(*) from public.repair_requests r where r.visitor_id = p.id)
  from public.profiles p, norm n
  where p.role = 'visitor'
    and p.is_active
    and n.name <> ''
    and regexp_replace(lower(coalesce(p.full_name, '')), '[^a-z]', '', 'g') = n.name
    and (
      (n.phone <> '' and right(regexp_replace(coalesce(p.phone, ''), '\D', '', 'g'), 9) = n.phone)
      or (n.email <> '' and lower(btrim(coalesce(p.email, ''))) = n.email)
    )
  order by (select count(*) from public.repair_requests r where r.visitor_id = p.id) desc
  limit 1;
$$;

-- Only ever called by the visitor-access function with the service role. Left
-- callable from the browser it would be a way to test whether a given person
-- is registered with the cafe.
revoke all on function public.find_visitor_match(text, text, text) from public;
revoke all on function public.find_visitor_match(text, text, text) from anon;
revoke all on function public.find_visitor_match(text, text, text) from authenticated;
