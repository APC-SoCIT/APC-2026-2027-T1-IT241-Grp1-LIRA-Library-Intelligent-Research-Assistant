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

  it('allows the OpenRouter key to enable the FAQ chatbot without semantic search settings', () => {
    const environment = { ...baseEnvironment, OPENROUTER_API_KEY: 'test-openrouter-api-key' };
    expect(validateEnvironment(environment)).toEqual(environment);
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

  it('rejects an empty OpenRouter chat model override', () => {
    expect(() => validateEnvironment({
      ...baseEnvironment,
      OPENROUTER_CHAT_MODEL: ' ',
    })).toThrow('OPENROUTER_CHAT_MODEL must not be empty');
  });

  it('validates origins and separate streaming/reader limits with finite deadlines', () => {
    expect(validateEnvironment({ ...baseEnvironment, KOHA_OPAC_BASE_URL: 'http://100.118.244.66:8080', EBOOK_TIMEOUT_MS: '15000', EBOOK_MAX_BYTES: '4000000' })).toMatchObject(baseEnvironment);
    for (const EBOOK_ALLOWED_ORIGINS of ['file:///tmp', 'https://user:password@example.com', 'https://example.com/private']) {
      expect(() => validateEnvironment({ ...baseEnvironment, EBOOK_ALLOWED_ORIGINS })).toThrow('HTTP(S) origin');
    }
    for (const EBOOK_MAX_BYTES of ['0', '512000001', 'NaN']) {
      expect(() => validateEnvironment({ ...baseEnvironment, EBOOK_MAX_BYTES })).toThrow('EBOOK_MAX_BYTES');
    }
    expect(validateEnvironment({ ...baseEnvironment, EBOOK_MAX_BYTES: '64000000', EBOOK_TIMEOUT_MS: '60000' })).toMatchObject(baseEnvironment);
    expect(() => validateEnvironment({ ...baseEnvironment, EBOOK_TIMEOUT_MS: '90001' })).toThrow('EBOOK_TIMEOUT_MS');
    expect(() => validateEnvironment({ ...baseEnvironment, EBOOK_READER_MAX_BYTES: '4000001' })).toThrow('EBOOK_READER_MAX_BYTES');
  });
});
