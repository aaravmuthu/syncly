-- Replace guessable 6-char md5(random()) invite codes with 12-char CSPRNG codes.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
ALTER TABLE public.groups
  ALTER COLUMN invite_code SET DEFAULT upper(substr(encode(gen_random_bytes(9), 'hex'), 1, 12));
UPDATE public.groups
  SET invite_code = upper(substr(encode(gen_random_bytes(9), 'hex'), 1, 12))
  WHERE length(invite_code) < 12;
