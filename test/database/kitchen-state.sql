set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';

insert into public.kitchen_state (user_id, data, updated_at)
values (auth.uid(), '{"pantry":["rice"],"meals":["rice bowl"]}', '2026-11-20T00:00:00Z');

do $$
declare affected integer;
begin
  insert into public.kitchen_state (user_id, data)
  values (auth.uid(), '{"pantry":[]}')
  on conflict (user_id) do nothing;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'First-save retry overwrote a snapshot'; end if;

  update public.kitchen_state
  set data = data || '{"cooked":true}', updated_at = '2026-11-20T00:00:01Z'
  where user_id = auth.uid() and updated_at = '2026-11-20T00:00:00Z';
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'Current revision could not be updated'; end if;

  update public.kitchen_state set data = '{}'
  where user_id = auth.uid() and updated_at = '2026-11-20T00:00:00Z';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Stale revision overwrote a snapshot'; end if;
end $$;

set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
do $$
declare affected integer;
begin
  if exists (select from public.kitchen_state) then
    raise exception 'Second account could read first account data';
  end if;

  update public.kitchen_state set data = '{}';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Second account could update first account data'; end if;

  delete from public.kitchen_state;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Second account could delete first account data'; end if;

  begin
    insert into public.kitchen_state (user_id, data)
    values ('00000000-0000-0000-0000-000000000001', '{}');
    raise exception 'Second account could insert as first account';
  exception when insufficient_privilege then
    null;
  end;
end $$;

insert into public.kitchen_state (user_id, data) values (auth.uid(), '{"pantry":["oats"]}');
reset role;
