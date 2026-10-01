import { registerAs } from '@nestjs/config';

export interface AppConfiguration {
  port: number;
  corsOrigins: string[];
  koha: {
    baseUrl: string;
    user: string;
    password: string;
    timeoutMs: number;
  };
  semantic: {
    openRouterApiKey: string;
    openRouterEmbeddingModel: string;
    supabaseUrl: string;
    supabaseServiceRoleKey: string;
    indexApiKey: string;
    matchLimit: number;
  };
}

export const configuration = registerAs('app', (): AppConfiguration => ({
  port: Number(process.env.PORT ?? 3001),
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  koha: {
    baseUrl: (process.env.KOHA_BASE_URL ?? '').replace(/\/$/, ''),
    user: process.env.KOHA_API_USER ?? '',
    password: process.env.KOHA_API_PASSWORD ?? '',
    timeoutMs: Number(process.env.KOHA_TIMEOUT_MS ?? 5000),
  },
  semantic: {
    openRouterApiKey: process.env.OPENROUTER_API_KEY ?? '',
    openRouterEmbeddingModel: process.env.OPENROUTER_EMBEDDING_MODEL ?? 'openai/text-embedding-3-small',
    supabaseUrl: (process.env.SUPABASE_URL ?? '').replace(/\/$/, ''),
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    indexApiKey: process.env.SEMANTIC_INDEX_API_KEY ?? '',
    matchLimit: Number(process.env.SEMANTIC_MATCH_LIMIT ?? 500),
  },
}));

export function validateEnvironment(environment: Record<string, unknown>): Record<string, unknown> {
  const required = ['KOHA_BASE_URL', 'KOHA_API_USER', 'KOHA_API_PASSWORD'];
  const missing = required.filter((key) => !String(environment[key] ?? '').trim());

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  const timeout = Number(environment.KOHA_TIMEOUT_MS ?? 5000);
  if (!Number.isInteger(timeout) || timeout < 100 || timeout > 60000) {
    throw new Error('KOHA_TIMEOUT_MS must be an integer between 100 and 60000');
  }

  const semanticKeys = [
    'OPENROUTER_API_KEY',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'SEMANTIC_INDEX_API_KEY',
  ];
  const semanticConfigured = semanticKeys.filter((key) => String(environment[key] ?? '').trim());
  if (semanticConfigured.length > 0 && semanticConfigured.length < semanticKeys.length) {
    const missingSemanticKeys = semanticKeys.filter((key) => !String(environment[key] ?? '').trim());
    throw new Error(`Semantic search requires these environment variables: ${missingSemanticKeys.join(', ')}`);
  }

  const matchLimit = Number(environment.SEMANTIC_MATCH_LIMIT ?? 500);
  if (!Number.isInteger(matchLimit) || matchLimit < 1 || matchLimit > 1000) {
    throw new Error('SEMANTIC_MATCH_LIMIT must be an integer between 1 and 1000');
  }

  const supabaseUrl = String(environment.SUPABASE_URL ?? '');
  if (supabaseUrl) {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(supabaseUrl);
    } catch {
      throw new Error('SUPABASE_URL must be a valid URL');
    }
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error('SUPABASE_URL must use HTTP or HTTPS');
    }
  }

  if (environment.OPENROUTER_EMBEDDING_MODEL !== undefined && !String(environment.OPENROUTER_EMBEDDING_MODEL).trim()) {
    throw new Error('OPENROUTER_EMBEDDING_MODEL must not be empty');
  }

  return environment;
}
