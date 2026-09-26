/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';
import { readConfig } from '../src/config.js';

test('uses a 30 second default timeout and three attempts', () => {
  const config = readConfig({});
  assert.equal(config.timeoutMs, 30000);
  assert.equal(config.maxAttempts, 3);
});

test('preserves custom timeout and retry configuration', () => {
  const config = readConfig({
    GUTENDEX_TIMEOUT_MS: '45000',
    GUTENDEX_MAX_ATTEMPTS: '2',
    GUTENDEX_RETRY_INITIAL_DELAY_MS: '100',
    GUTENDEX_RETRY_MAX_DELAY_MS: '500',
  });
  assert.equal(config.timeoutMs, 45000);
  assert.equal(config.maxAttempts, 2);
  assert.equal(config.retryInitialDelayMs, 100);
  assert.equal(config.retryMaxDelayMs, 500);
});

test('rejects invalid timeout configuration', () => {
  assert.throws(() => readConfig({ GUTENDEX_TIMEOUT_MS: '0' }), /positive integers/);
});