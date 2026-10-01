import { ConfigService } from '@nestjs/config';
import { SemanticSearchService } from '../src/catalog/semantic-search.service';

describe('SemanticSearchService', () => {
  const config = {
    openRouterApiKey: 'test-openrouter-api-key',
    openRouterEmbeddingModel: 'openai/text-embedding-3-small',
    supabaseUrl: 'https://example.supabase.co',
    supabaseServiceRoleKey: 'test-service-role-key',
    indexApiKey: 'test-index-key',
    matchLimit: 100,
  };
  let service: SemanticSearchService;
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    const configService = {
      getOrThrow: jest.fn().mockReturnValue(config),
    } as unknown as ConfigService;
    service = new SemanticSearchService(configService);
    fetchSpy = jest.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('embeds a query with OpenRouter and calls the private Supabase vector search RPC', async () => {
    const book = {
      id: 7,
      title: 'Courage in Literature',
      subtitle: null,
      author: null,
      isbn: null,
      issn: null,
      publisher: null,
      publicationYear: null,
      publicationPlace: null,
      edition: null,
      language: null,
      description: null,
      itemType: null,
      genres: [],
      subjects: [],
      categories: [],
      series: null,
      url: null,
    };
    const embedding = Array.from({ length: 1536 }, () => 0.1);
    fetchSpy
      .mockResolvedValueOnce(response(200, { data: [{ embedding }] }))
      .mockResolvedValueOnce(response(200, [{ book_data: book }]));

    await expect(service.search('books about courage', 25)).resolves.toEqual([book]);

    expect(fetchSpy).toHaveBeenNthCalledWith(
      1,
      'https://openrouter.ai/api/v1/embeddings',
      expect.objectContaining({
        method: 'POST',
        headers: { Authorization: 'Bearer test-openrouter-api-key' },
        body: JSON.stringify({ model: 'openai/text-embedding-3-small', input: ['books about courage'] }),
      }),
    );
    const rpcRequest = fetchSpy.mock.calls[1][1] as RequestInit;
    expect(fetchSpy.mock.calls[1][0]).toBe('https://example.supabase.co/rest/v1/rpc/match_catalog_books');
    expect(rpcRequest.headers).toMatchObject({
      apikey: 'test-service-role-key',
      Authorization: 'Bearer test-service-role-key',
    });
    expect(JSON.parse(String(rpcRequest.body)).match_count).toBe(25);
  });

  it('indexes books in Supabase and removes stale records after a complete reindex', async () => {
    const embedding = Array.from({ length: 1536 }, () => 0.2);
    fetchSpy
      .mockResolvedValueOnce(response(200, { data: [{ embedding }] }))
      .mockResolvedValueOnce(response(204, null))
      .mockResolvedValueOnce(response(204, null));

    await expect(service.indexBooks([createBook()])).resolves.toBe(1);

    expect(fetchSpy.mock.calls[1][0]).toBe(
      'https://example.supabase.co/rest/v1/catalog_embeddings?on_conflict=book_id',
    );
    const indexRequest = fetchSpy.mock.calls[1][1] as RequestInit;
    const [indexedRecord] = JSON.parse(String(indexRequest.body));
    expect(indexedRecord.book_id).toBe(7);
    expect(indexedRecord.embedding).toMatch(/^\[0\.2,/);
    expect(indexedRecord.index_run_id).toMatch(/^[0-9a-f-]{36}$/i);

    expect(fetchSpy.mock.calls[2][0]).toBe(
      'https://example.supabase.co/rest/v1/rpc/delete_stale_catalog_embeddings',
    );
    const cleanupRequest = fetchSpy.mock.calls[2][1] as RequestInit;
    expect(cleanupRequest.method).toBe('POST');
    expect(JSON.parse(String(cleanupRequest.body)).active_index_run).toBe(indexedRecord.index_run_id);
  });

  function createBook() {
    return {
      id: 7,
      title: 'Courage in Literature',
      subtitle: null,
      author: null,
      isbn: null,
      issn: null,
      publisher: null,
      publicationYear: null,
      publicationPlace: null,
      edition: null,
      language: null,
      description: null,
      itemType: null,
      genres: [],
      subjects: [],
      categories: [],
      series: null,
      url: null,
    };
  }

  function response(status: number, body: unknown): Response {
    return {
      ok: status >= 200 && status < 300,
      status,
      json: jest.fn().mockResolvedValue(body),
    } as unknown as Response;
  }
});
