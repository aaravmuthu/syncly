create or replace function public.gen_invite_code()
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  candidate text;
  i int;
begin
  loop
    candidate := '';
    for i in 1..6 loop
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.groups g where g.invite_code = candidate);
  end loop;
  return candidate;
end;
$$;

alter table public.groups alter column invite_code set default public.gen_invite_code();

update public.groups set invite_code = public.gen_invite_code() where length(invite_code) <> 6;

create unique index if not exists groups_invite_code_key on public.groups (invite_code);