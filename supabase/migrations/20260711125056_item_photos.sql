-- item photos: uploaded by visitors at booking time, visible on repair records
alter table public.repair_requests add column photos text[] not null default '{}';

-- storage bucket for repair item photos (public read, unguessable paths)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('repair-photos', 'repair-photos', true, 5242880,
        array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do nothing;

create policy "users upload own repair photos"
on storage.objects for insert to authenticated
with check (bucket_id = 'repair-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "public read repair photos"
on storage.objects for select to public
using (bucket_id = 'repair-photos');

create policy "users delete own repair photos"
on storage.objects for delete to authenticated
using (bucket_id = 'repair-photos' and (storage.foldername(name))[1] = auth.uid()::text);
