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
