import test from 'node:test';
import assert from 'node:assert/strict';
import { kitchenStorageKey, writeCloudSnapshot } from '../cloud-sync.mjs';

const params = { endpoint: 'https://example.invalid', userId: 'user-a',
  headers: { Authorization: 'Bearer test' }, snapshot: { pantry: [] },
  now: Date.parse('2026-11-20T00:00:00Z') };

test('the initial save never overwrites a row created by another device', async () => {
  const result = await writeCloudSnapshot({ ...params, observedRevision: null, send: async (url, request) => {
    assert.equal(request.method, 'POST');
    assert.equal(url.searchParams.get('on_conflict'), 'user_id');
    assert.equal(request.headers.Prefer, 'resolution=ignore-duplicates,return=representation');
    assert.equal(JSON.parse(request.body).user_id, 'user-a');
    return Response.json([]);
  } });
  assert.equal(result, null);
});

test('an update matches the observed revision even if the device clock is behind', async () => {
  const observedRevision = '2026-11-21T00:00:00.123456+00:00';
  const result = await writeCloudSnapshot({ ...params, observedRevision, send: async (url, request) => {
    assert.equal(request.method, 'PATCH');
    assert.equal(url.searchParams.get('user_id'), 'eq.user-a');
    assert.equal(url.searchParams.get('updated_at'), 'eq.' + observedRevision);
    const revision = JSON.parse(request.body).updated_at;
    assert.ok(Date.parse(revision) > Date.parse(observedRevision));
    return Response.json([{ updated_at: revision }]);
  } });
  assert.equal(result, '2026-11-21T00:00:00.124Z');
});

test('a stale revision is reported as a conflict', async () => {
  const result = await writeCloudSnapshot({ ...params, observedRevision: '2026-11-20T00:00:00Z',
    send: async () => Response.json([]) });
  assert.equal(result, null);
});

test('local Kitchen copies are scoped by both account and Supabase project', () => {
  const base = 'lifeos-kitchen-state-v2';
  const project = 'https://example.supabase.co';
  const alice = kitchenStorageKey(base, project, 'alice');
  const bob = kitchenStorageKey(base, project, 'bob');
  assert.notEqual(alice, bob);
  assert.notEqual(alice, kitchenStorageKey(base, 'https://other.supabase.co', 'alice'));
  assert.equal(alice, kitchenStorageKey(base, project + '/', 'alice'));
  assert.equal(kitchenStorageKey(base, project, null), base);
  const storage = new Map([[base, 'legacy pantry'], [alice, 'alice pantry']]);
  assert.equal(storage.get(bob), undefined);
  assert.equal(storage.get(base), 'legacy pantry');
  assert.equal(storage.get(alice), 'alice pantry');
});
