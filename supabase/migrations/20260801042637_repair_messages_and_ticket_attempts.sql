-- Conversation between a visitor and the team, threaded on the ticket number so
-- it carries across follow-up visits for the same item.
create table if not exists public.repair_messages (
  id uuid primary key default gen_random_uuid(),
  job_code text not null,
  request_id uuid references public.repair_requests(id) on delete set null,
  sender_id uuid references public.profiles(id) on delete set null,
  sender_kind text not null check (sender_kind in ('visitor', 'team')),
  sender_name text not null default '',
  body text not null check (length(btrim(body)) between 1 and 4000),
  created_at timestamptz not null default now(),
  read_by_visitor_at timestamptz,
  read_by_team_at timestamptz
);

create index if not exists repair_messages_job_code_idx on public.repair_messages (job_code, created_at);

alter table public.repair_messages enable row level security;

create or replace function public.can_see_job(p_job_code text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_volunteer() or exists (
    select 1 from public.repair_requests r
    where r.job_code = p_job_code and r.visitor_id = auth.uid()
  );
$$;

drop policy if exists "read messages on own jobs or any if volunteer" on public.repair_messages;
create policy "read messages on own jobs or any if volunteer"
  on public.repair_messages for select to authenticated
  using (public.can_see_job(job_code));

drop policy if exists "post messages on own jobs or any if volunteer" on public.repair_messages;
create policy "post messages on own jobs or any if volunteer"
  on public.repair_messages for insert to authenticated
  with check (
    public.can_see_job(job_code)
    and sender_id = auth.uid()
    and sender_kind = case when public.is_volunteer() then 'team' else 'visitor' end
  );

-- Read receipts go through here so nobody can edit message bodies after the fact.
create or replace function public.mark_thread_read(p_job_code text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.can_see_job(p_job_code) then
    raise exception 'Not permitted';
  end if;
  if public.is_volunteer() then
    update public.repair_messages set read_by_team_at = now()
     where job_code = p_job_code and sender_kind = 'visitor' and read_by_team_at is null;
  else
    update public.repair_messages set read_by_visitor_at = now()
     where job_code = p_job_code and sender_kind = 'team' and read_by_visitor_at is null;
  end if;
end;
$$;

-- Failed ticket entries, for rate limiting. No policies: service role only.
create table if not exists public.ticket_attempts (
  id bigserial primary key,
  ip_hash text not null,
  succeeded boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists ticket_attempts_ip_idx on public.ticket_attempts (ip_hash, created_at desc);
alter table public.ticket_attempts enable row level security;

alter publication supabase_realtime add table public.repair_messages;
