import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.js';

const env = { OPENAI_API_KEY: 'test-only', SUPABASE_URL: 'https://example.invalid',
  SUPABASE_PUBLISHABLE_KEY: 'test-only', AI_RATE_LIMITER: { limit: async () => ({ success: true }) } };
const request = (token, body = '{}') => new Request('https://example.invalid/api/ai', {
  method: 'POST', headers: token ? { Authorization: 'Bearer ' + token } : {}, body
});

test('AI gates provider access on verified Supabase authentication and rate limits', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => Response.json({}, { status: 401 }));
  assert.equal((await worker.fetch(request(), env)).status, 401);
  assert.equal(fetch.mock.callCount(), 0);
  assert.equal((await worker.fetch(request('expired'), env)).status, 401);
  assert.equal(fetch.mock.callCount(), 1);
  fetch.mock.mockImplementation(async () => Response.json({ id: 'test-user' }));
  const denied = { ...env, AI_RATE_LIMITER: { limit: async () => ({ success: false }) } };
  assert.equal((await worker.fetch(request('verified'), denied)).status, 429);
  assert.equal(fetch.mock.callCount(), 2);
  assert.equal((await worker.fetch(request('verified', 'x'.repeat(18001)), env)).status, 413);
  assert.equal((await worker.fetch(request('verified', 'null'), env)).status, 400);
  assert.equal(fetch.mock.callCount(), 4);
});
