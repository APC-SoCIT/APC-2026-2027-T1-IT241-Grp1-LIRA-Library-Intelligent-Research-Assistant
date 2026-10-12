import { registerAs } from '@nestjs/config';
import { defaultOpacUrl, DEFAULT_RESOURCE_ORIGINS, DEFAULT_RESOURCE_BYTES, MAX_RESOURCE_BYTES, MAX_READER_BYTES } from '../catalog/resource-policy';

export interface AppConfiguration {
  port: number;
  corsOrigins: string[];
  koha: {
    baseUrl: string;
    uploadUrl: string;
    uploadCategory: string;
    uploadCookie: string;
    uploadCsrfToken: string;
    uploadUser: string;
    uploadPassword: string;
    user: string;
    password: string;
    timeoutMs: number;
    patronCategoryId: string;
    librarianPatronCategoryId: string;
    patronLibraryId: string;
  };
  semantic: {
    openRouterApiKey: string;
    openRouterEmbeddingModel: string;
    supabaseUrl: string;
    supabaseServiceRoleKey: string;
    indexApiKey: string;
    matchLimit: number;
  };
  resources: {
    opacBaseUrl: string;
    allowedOrigins: string[];
    timeoutMs: number;
    maxBytes: number;
    readerMaxBytes: number;
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
    uploadUrl: (process.env.KOHA_UPLOAD_URL ?? '').replace(/\/$/, ''),
    uploadCategory: process.env.KOHA_UPLOAD_CATEGORY ?? 'LIRA',
    uploadCookie: process.env.KOHA_UPLOAD_COOKIE ?? '',
    uploadCsrfToken: process.env.KOHA_UPLOAD_CSRF_TOKEN ?? '',
    uploadUser: process.env.KOHA_UPLOAD_USER ?? '',
    uploadPassword: process.env.KOHA_UPLOAD_PASSWORD ?? '',
    user: process.env.KOHA_API_USER ?? '',
    password: process.env.KOHA_API_PASSWORD ?? '',
    timeoutMs: Number(process.env.KOHA_TIMEOUT_MS ?? 5000),
    patronCategoryId: process.env.KOHA_STUDENT_CATEGORY_ID ?? 'ST',
    librarianPatronCategoryId: process.env.KOHA_LIBRARIAN_CATEGORY_ID || 'S',
    patronLibraryId: process.env.KOHA_STUDENT_LIBRARY_ID ?? 'APC',
  },
  semantic: {
    openRouterApiKey: process.env.OPENROUTER_API_KEY ?? '',
    openRouterEmbeddingModel: process.env.OPENROUTER_EMBEDDING_MODEL ?? 'openai/text-embedding-3-small',
    supabaseUrl: (process.env.SUPABASE_URL ?? '').replace(/\/$/, ''),
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    indexApiKey: process.env.SEMANTIC_INDEX_API_KEY ?? '',
    matchLimit: Number(process.env.SEMANTIC_MATCH_LIMIT ?? 500),
  },
  resources: {
    opacBaseUrl: process.env.KOHA_OPAC_BASE_URL || defaultOpacUrl(process.env.KOHA_BASE_URL ?? ''),
    allowedOrigins: process.env.EBOOK_ALLOWED_ORIGINS === undefined ? DEFAULT_RESOURCE_ORIGINS
      : process.env.EBOOK_ALLOWED_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean),
    timeoutMs: Number(process.env.EBOOK_TIMEOUT_MS ?? 60000),
    maxBytes: Number(process.env.EBOOK_MAX_BYTES ?? DEFAULT_RESOURCE_BYTES),
    readerMaxBytes: Number(process.env.EBOOK_READER_MAX_BYTES ?? MAX_READER_BYTES),
  },
}));

export function validateEnvironment(environment: Record<string, unknown>): Record<string, unknown> {
  const required = ['KOHA_BASE_URL', 'KOHA_API_USER', 'KOHA_API_PASSWORD'];
  const missing = required.filter((key) => !String(environment[key] ?? '').trim());

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  const origin = (key: string, value: string) => {
    let url: URL;
    try { url = new URL(value); } catch { throw new Error(`${key} must be an HTTP(S) origin`); }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password
      || url.pathname !== '/' || url.search || url.hash) throw new Error(`${key} must be an HTTP(S) origin`);
  };
  origin('KOHA_BASE_URL', String(environment.KOHA_BASE_URL));
  if (environment.KOHA_OPAC_BASE_URL) origin('KOHA_OPAC_BASE_URL', String(environment.KOHA_OPAC_BASE_URL));
  for (const value of String(environment.EBOOK_ALLOWED_ORIGINS ?? '').split(',').map((value) => value.trim()).filter(Boolean)) {
    origin('EBOOK_ALLOWED_ORIGINS', value);
  }
  const resourceTimeout = Number(environment.EBOOK_TIMEOUT_MS ?? 60000);
  if (!Number.isInteger(resourceTimeout) || resourceTimeout < 100 || resourceTimeout > 90000) {
    throw new Error('EBOOK_TIMEOUT_MS must be an integer between 100 and 90000');
  }
  const resourceMaxBytes = Number(environment.EBOOK_MAX_BYTES ?? DEFAULT_RESOURCE_BYTES);
  if (!Number.isInteger(resourceMaxBytes) || resourceMaxBytes < 100 || resourceMaxBytes > MAX_RESOURCE_BYTES) {
    throw new Error(`EBOOK_MAX_BYTES must be an integer between 100 and ${MAX_RESOURCE_BYTES}`);
  }
  const readerMaxBytes = Number(environment.EBOOK_READER_MAX_BYTES ?? MAX_READER_BYTES);
  if (!Number.isInteger(readerMaxBytes) || readerMaxBytes < 100 || readerMaxBytes > MAX_READER_BYTES) {
    throw new Error(`EBOOK_READER_MAX_BYTES must be an integer between 100 and ${MAX_READER_BYTES}`);
  }

  const timeout = Number(environment.KOHA_TIMEOUT_MS ?? 5000);
  if (!Number.isInteger(timeout) || timeout < 100 || timeout > 60000) {
    throw new Error('KOHA_TIMEOUT_MS must be an integer between 100 and 60000');
  }

  const useTailscale = String(environment.LIRA_USE_TAILSCALE ?? '0');
  if (!['0', '1'].includes(useTailscale)) {
    throw new Error('LIRA_USE_TAILSCALE must be 0 or 1');
  }
  if (useTailscale === '1' && !String(environment.TS_AUTHKEY ?? '').trim()) {
    throw new Error('TS_AUTHKEY is required when LIRA_USE_TAILSCALE=1');
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
