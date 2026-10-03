-- Replace guessable 6-char md5(random()) invite codes with 12-char CSPRNG codes.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
ALTER TABLE public.groups
  ALTER COLUMN invite_code SET DEFAULT upper(substr(encode(gen_random_bytes(9), 'hex'), 1, 12));
UPDATE public.groups
  SET invite_code = upper(substr(encode(gen_random_bytes(9), 'hex'), 1, 12))
  WHERE length(invite_code) < 12;
-- Revoke location shares left behind by guardian links that no longer exist.
DELETE FROM public.location_shares ls
WHERE ls.mode = 'indefinite' AND NOT EXISTS (
  SELECT 1 FROM public.guardian_links gl
  WHERE gl.teen_profile_id = ls.owner_profile_id AND gl.guardian_profile_id = ls.viewer_profile_id
) AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = ls.viewer_profile_id AND p.role = 'parent');
