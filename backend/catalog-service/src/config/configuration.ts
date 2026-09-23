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

  return environment;
}
