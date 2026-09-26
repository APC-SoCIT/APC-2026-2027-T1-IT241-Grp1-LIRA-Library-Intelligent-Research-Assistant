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

const retryOptions = { maxAttempts: 3, retryInitialDelayMs: 0, retryMaxDelayMs: 0, randomImpl: () => 0, sleepImpl: async () => undefined };

test('retries a timeout and eventually succeeds', async () => {
  let calls = 0;
  const client = new GutendexClient({ ...retryOptions, fetchImpl: async () => {
    calls += 1;
    if (calls === 1) throw Object.assign(new Error('timed out'), { name: 'AbortError' });
    return response({ id: 11, title: 'Book' });
  } });
  await assert.doesNotReject(client.getBook(11));
  assert.equal(calls, 2);
});

test('retries a network error and eventually succeeds', async () => {
  let calls = 0;
  const client = new GutendexClient({ ...retryOptions, fetchImpl: async () => {
    calls += 1;
    if (calls < 3) throw new Error('network unavailable');
    return response({ id: 84, title: 'Book' });
  } });
  await assert.doesNotReject(client.getBook(84));
  assert.equal(calls, 3);
});

test('retries HTTP 429 and selected 5xx responses', async () => {
  let calls = 0;
  const client = new GutendexClient({ ...retryOptions, fetchImpl: async () => {
    calls += 1;
    if (calls === 1) return response({}, 429);
    if (calls === 2) return response({}, 503);
    return response({ id: 1342, title: 'Book' });
  } });
  await assert.doesNotReject(client.getBook(1342));
  assert.equal(calls, 3);
});

test('honors Retry-After for temporary HTTP failures', async () => {
  const delays: number[] = [];
  let calls = 0;
  const client = new GutendexClient({ ...retryOptions, retryMaxDelayMs: 5000, sleepImpl: async (delayMs) => { delays.push(delayMs); }, fetchImpl: async () => {
    calls += 1;
    if (calls === 1) return new Response('{}', { status: 429, headers: { 'Retry-After': '1' } });
    return response({ id: 11, title: 'Book' });
  } });
  await assert.doesNotReject(client.getBook(11));
  assert.deepEqual(delays, [1000]);
});

test('does not retry permanent HTTP errors', async () => {
  let calls = 0;
  const client = new GutendexClient({ ...retryOptions, fetchImpl: async () => {
    calls += 1;
    return response({}, 404);
  } });
  await assert.rejects(client.getBook(999999), /HTTP 404/);
  assert.equal(calls, 1);
});

test('removes failed requests from cache so a later call can retry', async () => {
  let calls = 0;
  const client = new GutendexClient({ ...retryOptions, fetchImpl: async () => {
    calls += 1;
    throw new Error('network unavailable');
  } });
  await assert.rejects(client.getBook(84));
  await assert.rejects(client.getBook(84));
  assert.equal(calls, 6);
});

test('keeps successful requests cached and deduplicates concurrent calls', async () => {
  let calls = 0;
  const client = new GutendexClient({ fetchImpl: async () => {
    calls += 1;
    return response({ id: 11, title: 'Book' });
  } });
  const first = client.getBook(11);
  const second = client.getBook(11);
  await Promise.all([first, second, client.getBook(11)]);
  assert.equal(calls, 1);
});

test('preserves successful records when another ID fails', async () => {
  const client = new GutendexClient({ ...retryOptions, fetchImpl: async (input) => {
    if (String(input).endsWith('/84')) return response({ id: 84, title: 'Success' });
    return response({}, 404);
  } });
  const result = await new GutenbergImporter(client).import([84, 999999], 2);
  assert.deepEqual(result.books.map((book) => book.id), [84]);
  assert.deepEqual(result.errors.map((error) => error.id), [999999]);
});