-- =============================================================================
-- Syncly — avatars storage bucket + policies
-- =============================================================================
-- Fixes "Bucket not found" on profile-photo (and every other image/voice-note)
-- upload. Confirmed live against the linked project, read-only:
--   select id, name, public, created_at from storage.buckets;  -> 0 rows
-- storage.buckets is a separate resource from the schema/table migrations
-- already applied tonight — `supabase db push` never creates buckets, and
-- this project's remix (nuysorvwpqbqafxfiltr -> ulaxukzdwvwuhuvxlbww) never
-- had one provisioned.
--
-- Every call site in src/ was traced (chat.functions.ts, dm.functions.ts,
-- group.functions.ts, plan.functions.ts) — all four upload functions target
-- the single bucket name "avatars", all scope their object path as
-- `${userId}/...` (own folder), and all use supabaseAdmin (service role) for
-- both the upload and a 10-year createSignedUrl — never a public URL, never
-- the user-scoped client:
--   uploadAvatar      (plan.functions.ts)  -> ${userId}/{ts}.{ext}         profile photo
--   uploadGroupImage  (group.functions.ts) -> ${userId}/groups/{ts}.{ext}  group cover photo
--   uploadChatImage   (chat.functions.ts)  -> ${userId}/chat/{ts}.{ext}    squad-chat image
--   uploadVoiceNote   (dm.functions.ts)    -> ${userId}/voice/{ts}.{ext}   DM voice note (audio)
--
-- Bucket is created PRIVATE, not public. It's named "avatars" but also
-- carries DM voice notes and chat images — meaningfully more sensitive than
-- a profile photo — and every read already goes through a signed URL, so a
-- private bucket costs nothing functionally while closing off unsigned/
-- guessable direct access to that content.
--
-- file_size_limit is 8MB (the loosest cap already enforced in code, by the
-- voice-note path; images are separately capped at 5MB in the app layer).
-- allowed_mime_types matches exactly what the four functions already
-- validate before upload.
--
-- The three policies below are defense-in-depth, not the fix for the
-- reported bug — every current call site uses supabaseAdmin, which bypasses
-- storage RLS entirely. They only matter if a future feature ever reads or
-- writes Storage from the browser's user-scoped client directly, and follow
-- the same "own folder only" shape as every table policy applied tonight.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  false,
  8388608, -- 8 MB
  array['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'audio/webm', 'audio/mp4']
)
on conflict (id) do nothing;

create policy avatars_select_own
  on storage.objects for select
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy avatars_insert_own
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy avatars_update_own
  on storage.objects for update
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
