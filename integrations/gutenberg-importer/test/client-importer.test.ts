/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';
import { GutendexClient } from '../src/gutendex/gutendex.client.js';
import { GutenbergImporter } from '../src/importer.js';

const response = (payload: unknown, status = 200): Response => new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } });

test('caches repeated requests and reports duplicate batch IDs', async () => {
  let calls = 0;
  const client = new GutendexClient({ fetchImpl: async () => { calls += 1; return response({ id: 84, title: 'Book' }); } });
  const importer = new GutenbergImporter(client);
  const result = await importer.import([84, 84], 2);
  assert.equal(calls, 1);
  assert.equal(result.records.length, 1);
  assert.deepEqual(result.duplicateIds, [84]);
  assert.equal(result.errors[0]?.kind, 'duplicate');
});

test('reports HTTP failures with the affected ID', async () => {
  const client = new GutendexClient({ fetchImpl: async () => response({ error: 'not found' }, 404) });
  const result = await new GutenbergImporter(client).import([999999], 1);
  assert.equal(result.records.length, 0);
  assert.deepEqual(result.errors[0], { id: 999999, message: 'Gutendex returned HTTP 404', kind: 'http' });
});

test('reports request timeouts', async () => {
  const fetchImpl = async (_input: string | URL | Request, init?: RequestInit): Promise<Response> => await new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
  });
  const client = new GutendexClient({ timeoutMs: 5, fetchImpl });
  const result = await new GutenbergImporter(client).import([11], 1);
  assert.equal(result.errors[0]?.kind, 'timeout');
});