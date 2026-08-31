-- Ticket numbers: six digits identify the visitor, two letters identify the job.
-- "482137KM" is displayed as 482137-KM. Follow-up visits keep the same job code
-- and increment visit_number, so a case is every row sharing a job_code.

alter table public.profiles
  add column if not exists person_code text;

alter table public.repair_requests
  add column if not exists job_code text,
  add column if not exists visit_number int,
  add column if not exists follow_up_of uuid references public.repair_requests(id) on delete set null;

-- Six random digits, no leading zero so nobody drops it when writing it down.
create or replace function public.new_person_code()
returns text language plpgsql security definer set search_path = public as $$
declare candidate text; tries int := 0;
begin
  loop
    candidate := (100000 + floor(random() * 900000)::int)::text;
    tries := tries + 1;
    exit when not exists (select 1 from public.profiles p where p.person_code = candidate);
    if tries > 200 then raise exception 'Could not allocate a visitor code'; end if;
  end loop;
  return candidate;
end;
$$;

-- Two letters, skipping I and O (confused with 1 and 0 when handwritten or read
-- aloud) and a short list of pairs we would rather not print on a card.
create or replace function public.new_job_letters(p_prefix text)
returns text language plpgsql security definer set search_path = public as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  blocked constant text[] := array['AS','BJ','BS','FK','FU','KK','PN','PP','SS','WC','XX'];
  letters text; tries int := 0;
begin
  loop
    letters := substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1)
            || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    tries := tries + 1;
    exit when not (letters = any(blocked))
      and not exists (select 1 from public.repair_requests r where r.job_code = p_prefix || letters);
    if tries > 300 then raise exception 'Could not allocate a ticket number for %', p_prefix; end if;
  end loop;
  return letters;
end;
$$;

create or replace function public.assign_person_code()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.person_code is null then new.person_code := public.new_person_code(); end if;
  return new;
end;
$$;

drop trigger if exists profiles_assign_person_code on public.profiles;
create trigger profiles_assign_person_code
  before insert on public.profiles
  for each row execute function public.assign_person_code();

-- A new booking gets a fresh ticket; a follow-up supplies an existing job_code
-- and is numbered as the next visit in that case.
create or replace function public.assign_job_code()
returns trigger language plpgsql security definer set search_path = public as $$
declare prefix text;
begin
  if new.job_code is not null then
    if not public.is_volunteer() and not exists (
      select 1 from public.repair_requests r
      where r.job_code = new.job_code and r.visitor_id = auth.uid()
    ) then
      raise exception 'That ticket number does not belong to this visitor';
    end if;
    select coalesce(max(r.visit_number), 0) + 1 into new.visit_number
      from public.repair_requests r where r.job_code = new.job_code;
    return new;
  end if;

  if new.visitor_id is not null then
    select p.person_code into prefix from public.profiles p where p.id = new.visitor_id;
  end if;
  if prefix is null then prefix := public.new_person_code(); end if;

  new.job_code := prefix || public.new_job_letters(prefix);
  new.visit_number := 1;
  return new;
end;
$$;

drop trigger if exists repair_requests_assign_job_code on public.repair_requests;
create trigger repair_requests_assign_job_code
  before insert on public.repair_requests
  for each row execute function public.assign_job_code();

-- Backfill: every existing profile gets a code, every existing repair a ticket.
update public.profiles set person_code = public.new_person_code() where person_code is null;

do $$
declare r record; prefix text;
begin
  for r in select id, visitor_id from public.repair_requests where job_code is null order by created_at loop
    select p.person_code into prefix from public.profiles p where p.id = r.visitor_id;
    if prefix is null then prefix := public.new_person_code(); end if;
    update public.repair_requests
       set job_code = prefix || public.new_job_letters(prefix), visit_number = 1
     where id = r.id;
  end loop;
end $$;

alter table public.profiles alter column person_code set not null;
alter table public.repair_requests alter column job_code set not null;
alter table public.repair_requests alter column visit_number set not null;

create unique index if not exists profiles_person_code_key on public.profiles (person_code);
create unique index if not exists repair_requests_job_visit_key on public.repair_requests (job_code, visit_number);
create index if not exists repair_requests_job_code_idx on public.repair_requests (job_code);
create index if not exists profiles_phone_idx on public.profiles (phone);

-- Visitors can edit their own rows, so keep the ticket number itself off limits.
-- Created after the backfill so it cannot interfere with it.
create or replace function public.freeze_job_code()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.job_code is not null and not public.is_volunteer() then
    new.job_code := old.job_code;
    new.visit_number := old.visit_number;
  end if;
  return new;
end;
$$;

drop trigger if exists repair_requests_freeze_job_code on public.repair_requests;
create trigger repair_requests_freeze_job_code
  before update on public.repair_requests
  for each row execute function public.freeze_job_code();
