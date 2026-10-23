-- Images and small files in the conversation on a ticket.
--
-- Files go in a PRIVATE bucket, one folder per ticket number:
--   message-files/482137KM/<uuid>-<name>
-- Unlike item photos (public, unguessable paths), people send whatever they
-- like here — receipts, manuals, photos of their home — so nothing is public.
-- The app shows them through short-lived signed URLs, and storage allows
-- reading and uploading only for someone who can already see that ticket's
-- conversation (can_see_job). Files can't be changed or deleted from the app,
-- the same as message text.
--
-- Each message lists its files in repair_messages.attachments:
--   [{ "path": "482137KM/…", "name": "receipt.pdf", "type": "application/pdf", "size": 48213 }]

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('message-files', 'message-files', false, 5242880, array[
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif',
  'application/pdf', 'text/plain', 'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
])
on conflict (id) do nothing;

create policy "upload message files on own jobs or any if volunteer"
on storage.objects for insert to authenticated
with check (bucket_id = 'message-files' and public.can_see_job((storage.foldername(name))[1]));

create policy "read message files on own jobs or any if volunteer"
on storage.objects for select to authenticated
using (bucket_id = 'message-files' and public.can_see_job((storage.foldername(name))[1]));

-- ===== attachments on messages =====
alter table public.repair_messages
  add column attachments jsonb not null default '[]'::jsonb;

alter table public.repair_messages
  add constraint repair_messages_attachments_shape
  check (jsonb_typeof(attachments) = 'array' and jsonb_array_length(attachments) <= 5);

-- A message can now be just a file, with no text.
alter table public.repair_messages drop constraint if exists repair_messages_body_check;
alter table public.repair_messages
  add constraint repair_messages_body_check
  check (
    length(body) <= 4000
    and (length(btrim(body)) >= 1 or jsonb_array_length(attachments) >= 1)
  );

-- Same rules as before, plus: every attached file must sit in this ticket's
-- folder, so nobody can point a message at someone else's file.
drop policy if exists "post messages on own jobs or any if volunteer" on public.repair_messages;
create policy "post messages on own jobs or any if volunteer"
  on public.repair_messages for insert to authenticated
  with check (
    public.can_see_job(job_code)
    and sender_id = auth.uid()
    and sender_kind = case when public.is_volunteer() then 'team' else 'visitor' end
    and not exists (
      select 1 from jsonb_array_elements(attachments) a
      where coalesce(a->>'path', '') not like job_code || '/%'
    )
  );
