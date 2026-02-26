begin;

alter table public.simulators
  add column if not exists access_code_plaintext text;

alter table public.simulators
  drop constraint if exists simulators_access_code_plaintext_length_check;

alter table public.simulators
  add constraint simulators_access_code_plaintext_length_check
  check (
    access_code_plaintext is null
    or char_length(access_code_plaintext) between 4 and 64
  );

update public.simulators
set access_code_plaintext = null
where access_code_hash is null;

commit;
