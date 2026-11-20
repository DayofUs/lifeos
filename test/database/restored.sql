set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
do $$
begin
  if (select count(*) from public.kitchen_state) <> 1
    or not exists (
      select from public.kitchen_state
      where data = '{"pantry":["rice"],"meals":["rice bowl"],"cooked":true}'
        and updated_at = '2026-11-20T00:00:01Z'
    ) then
    raise exception 'First account snapshot, revision or permissions did not survive restore';
  end if;
end $$;

set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
do $$
begin
  if (select count(*) from public.kitchen_state) <> 1
    or not exists (select from public.kitchen_state where data = '{"pantry":["oats"]}') then
    raise exception 'Second account snapshot or permissions did not survive restore';
  end if;
end $$;

reset role;
set role anon;
reset request.jwt.claim.sub;
do $$
begin
  if exists (select from public.kitchen_state) then
    raise exception 'Signed-out user could read restored Kitchen data';
  end if;
end $$;
reset role;
