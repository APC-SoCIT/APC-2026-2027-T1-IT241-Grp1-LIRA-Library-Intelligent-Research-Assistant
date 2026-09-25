/// <reference types="node" />

export interface ImportConfig {
  baseUrl: string;
  timeoutMs: number;
  outputDir: string;
  batchSize: number;
}

export function readConfig(environment: NodeJS.ProcessEnv = process.env): ImportConfig {
  return {
    baseUrl: environment.GUTENDEX_BASE_URL ?? 'https://gutendex.com',
    timeoutMs: positiveInteger(environment.GUTENDEX_TIMEOUT_MS, 10000),
    outputDir: environment.GUTENBERG_OUTPUT_DIR ?? './output',
    batchSize: positiveInteger(environment.GUTENBERG_BATCH_SIZE, 10),
  };
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = value === undefined ? fallback : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error('Configuration values must be positive integers');
  return parsed;
}