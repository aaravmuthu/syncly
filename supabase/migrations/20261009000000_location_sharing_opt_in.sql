-- New profiles start private. Existing users keep their chosen sharing state.
ALTER TABLE public.profiles ALTER COLUMN location_sharing_enabled SET DEFAULT false;
