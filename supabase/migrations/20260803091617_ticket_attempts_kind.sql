-- Separate rate-limit buckets: a visitor checking their details should never
-- eat into the allowance for actually booking.
alter table public.ticket_attempts
  add column if not exists kind text not null default 'signin';

create index if not exists ticket_attempts_kind_idx
  on public.ticket_attempts (ip_hash, kind, created_at desc);
