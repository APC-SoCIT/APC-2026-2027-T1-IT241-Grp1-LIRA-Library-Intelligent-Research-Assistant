/// <reference types="node" />

export interface ImportConfig {
  baseUrl: string;
  timeoutMs: number;
  outputDir: string;
  batchSize: number;
  maxAttempts: number;
  retryInitialDelayMs: number;
  retryMaxDelayMs: number;
}

export function readConfig(environment: NodeJS.ProcessEnv = process.env): ImportConfig {
  return {
    baseUrl: environment.GUTENDEX_BASE_URL ?? 'https://gutendex.com',
    timeoutMs: positiveInteger(environment.GUTENDEX_TIMEOUT_MS, 30000),
    outputDir: environment.GUTENBERG_OUTPUT_DIR ?? './output',
    batchSize: positiveInteger(environment.GUTENBERG_BATCH_SIZE, 10),
    maxAttempts: positiveInteger(environment.GUTENDEX_MAX_ATTEMPTS, 3),
    retryInitialDelayMs: positiveInteger(environment.GUTENDEX_RETRY_INITIAL_DELAY_MS, 250),
    retryMaxDelayMs: positiveInteger(environment.GUTENDEX_RETRY_MAX_DELAY_MS, 2000),
  };
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = value === undefined ? fallback : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error('Configuration values must be positive integers');
  return parsed;
}