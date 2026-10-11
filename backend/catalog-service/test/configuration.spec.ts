import { validateEnvironment } from '../src/config/configuration';

describe('validateEnvironment', () => {
  const baseEnvironment = {
    KOHA_BASE_URL: 'http://koha.example.test',
    KOHA_API_USER: 'catalog-reader',
    KOHA_API_PASSWORD: 'test-password',
  };

  it('keeps semantic search optional for existing deployments', () => {
    expect(validateEnvironment(baseEnvironment)).toEqual(baseEnvironment);
  });

  it('requires a Tailscale key only when the deployment integration is enabled', () => {
    expect(() => validateEnvironment({
      ...baseEnvironment,
      LIRA_USE_TAILSCALE: '1',
      TS_AUTHKEY: '   ',
    })).toThrow('TS_AUTHKEY is required');
    expect(validateEnvironment({
      ...baseEnvironment,
      LIRA_USE_TAILSCALE: '0',
    })).toMatchObject(baseEnvironment);
  });

  it('accepts a configured Tailscale deployment', () => {
    expect(validateEnvironment({
      ...baseEnvironment,
      LIRA_USE_TAILSCALE: '1',
      TS_AUTHKEY: 'test-auth-key',
    })).toMatchObject(baseEnvironment);
  });

  it('rejects a flag typo instead of silently bypassing Tailscale', () => {
    expect(() => validateEnvironment({
      ...baseEnvironment,
      LIRA_USE_TAILSCALE: 'true',
    })).toThrow('LIRA_USE_TAILSCALE must be 0 or 1');
  });

  it('requires all semantic secrets together when enabling the feature', () => {
    expect(() => validateEnvironment({
      ...baseEnvironment,
      OPENROUTER_API_KEY: 'test-openrouter-api-key',
      SUPABASE_URL: 'https://example.supabase.co',
    })).toThrow('Semantic search requires these environment variables');
  });

  it('accepts a complete semantic configuration', () => {
    const environment = {
      ...baseEnvironment,
      OPENROUTER_API_KEY: 'test-openrouter-api-key',
      OPENROUTER_EMBEDDING_MODEL: 'openai/text-embedding-3-small',
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
      SEMANTIC_INDEX_API_KEY: 'test-index-key',
    };

    expect(validateEnvironment(environment)).toEqual(environment);
  });
});
