import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { KnowledgeModule } from '../src/knowledge/knowledge.module';

describe('Librarian knowledge API (HTTP, actual guard and service; mocked Supabase)', () => {
  let app: INestApplication;
  let fetchSpy: jest.SpyInstance;
  let role: string;
  const storage = jest.fn();
  const userId = '8f7abcf2-04f0-4ab1-a32a-e98a25cf5b5b';
  const id = '3a9a8696-06a4-49f4-9f8a-94e94de737bb';
  const payload = { kind: 'faq', category: 'hours', title: 'Library hours?', content: 'Use the approved hours.', sourceUrl: null };
  const row = { id, ...payload, source_url: null, created_at: '2026-11-19T10:00:00.123456+00:00', updated_at: '2026-11-19T10:00:00.123456+00:00' };
  const endpoint = '/api/knowledge/entries';
  const auth = 'Bearer test-librarian-token';

  beforeAll(async () => {
    const config = { get: (key: string, fallback: string) => ({
      'app.semantic.supabaseUrl': 'https://supabase.example.test',
      'app.semantic.supabaseServiceRoleKey': 'test-service-key',
    }[key] ?? fallback) };
    const module = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), KnowledgeModule],
    }).overrideProvider(ConfigService).useValue(config).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await app.init();
  });

  beforeEach(() => {
    role = 'librarian';
    storage.mockReset().mockResolvedValue(response(200, [row]));
    fetchSpy = jest.spyOn(globalThis, 'fetch').mockImplementation(async (input, options) => {
      const url = String(input);
      if (url.endsWith('/auth/v1/user')) return response(200, { id: userId });
      if (url.includes('/rest/v1/profiles?')) return response(200, [{ role }]);
      if (url.includes('/rest/v1/librarian_knowledge_entries?')) return storage(url, options);
      throw new Error('Unexpected external request');
    });
  });

  afterEach(() => fetchSpy.mockRestore());
  afterAll(async () => app.close());

  it.each(['get', 'post', 'put'] as const)('blocks unauthenticated %s before storage access', async (method) => {
    const path = method === 'put' ? `${endpoint}/${id}` : endpoint;
    await request(app.getHttpServer())[method](path).send(payload).expect(401);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it.each(['get', 'post', 'put'] as const)('blocks student %s even when called outside the UI', async (method) => {
    role = 'student';
    const path = method === 'put' ? `${endpoint}/${id}` : endpoint;
    await request(app.getHttpServer())[method](path).set('Authorization', auth).send(payload).expect(403);
    expect(storage).not.toHaveBeenCalled();
  });

  it('rejects expired sessions without checking profile or knowledge storage', async () => {
    fetchSpy.mockResolvedValueOnce(response(401, {}));
    await request(app.getHttpServer()).get(endpoint).set('Authorization', auth).expect(401);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(storage).not.toHaveBeenCalled();
  });

  it('lists private entries with validated pagination and no-store caching', async () => {
    const result = await request(app.getHttpServer()).get(`${endpoint}?page=2&limit=10`).set('Authorization', auth).expect(200);
    expect(result.headers['cache-control']).toBe('no-store');
    expect(result.body).toMatchObject({ items: [{ id, sourceUrl: null, updatedAt: row.updated_at }], pagination: { page: 2, limit: 10 } });
    const url = new URL(storage.mock.calls[0][0]);
    expect(url.searchParams.get('offset')).toBe('10');
    expect(url.searchParams.get('limit')).toBe('10');
    expect(result.body.items[0]).not.toHaveProperty('created_by');
  });

  it('creates a trimmed FAQ and derives authorship from the verified session', async () => {
    const result = await request(app.getHttpServer()).post(endpoint).set('Authorization', auth)
      .send({ ...payload, title: '  Library hours?  ', content: '  Use the approved hours.  ', sourceUrl: '   ' }).expect(201);
    expect(result.body.id).toBe(id);
    const options = storage.mock.calls[0][1] as RequestInit;
    expect(options.method).toBe('POST');
    expect(JSON.parse(String(options.body))).toEqual({ kind: 'faq', category: 'hours', title: payload.title,
      content: payload.content, source_url: null, created_by: userId, updated_by: userId });
    expect(options.headers).toMatchObject({ Authorization: 'Bearer test-service-key' });
  });

  it('also accepts policy entries and HTTP(S) source attribution', async () => {
    await request(app.getHttpServer()).post(endpoint).set('Authorization', auth)
      .send({ ...payload, kind: 'policy', category: 'rules', sourceUrl: 'https://library.example.test/policy' }).expect(201);
    expect(JSON.parse(String(storage.mock.calls[0][1].body))).toMatchObject({ kind: 'policy', category: 'rules', source_url: 'https://library.example.test/policy' });
  });

  it.each([
    { title: '   ' }, { content: ' \n ' }, { content: 'a'.repeat(10001) },
    { kind: 'system-prompt' }, { category: 'other' }, { sourceUrl: 'javascript:alert(1)' },
    { sourceUrl: 'https://user:password@example.test/policy' }, { created_by: userId }, { published: true },
  ])('rejects invalid or out-of-scope input case %# before writing storage', async (invalid) => {
    await request(app.getHttpServer()).post(endpoint).set('Authorization', auth).send({ ...payload, ...invalid }).expect(400);
    expect(storage).not.toHaveBeenCalled();
  });

  it.each(['?limit=101', '?page=0', '?page=invalid'])('rejects unsafe pagination %s', async (query) => {
    await request(app.getHttpServer()).get(endpoint + query).set('Authorization', auth).expect(400);
    expect(storage).not.toHaveBeenCalled();
  });

  it('updates against the exact saved timestamp and attributes the current librarian', async () => {
    await request(app.getHttpServer()).put(`${endpoint}/${id}`).set('Authorization', auth)
      .send({ ...payload, content: 'Updated answer', expectedUpdatedAt: row.updated_at }).expect(200);
    const url = new URL(storage.mock.calls[0][0]);
    expect(url.searchParams.get('id')).toBe(`eq.${id}`);
    expect(url.searchParams.get('updated_at')).toBe(`eq.${row.updated_at}`);
    expect(storage.mock.calls[0][1].method).toBe('PATCH');
    expect(JSON.parse(String(storage.mock.calls[0][1].body))).toEqual({ kind: 'faq', category: 'hours',
      title: payload.title, content: 'Updated answer', source_url: null, updated_by: userId });
  });

  it('reports a conflict rather than overwriting another librarian’s edits', async () => {
    storage.mockResolvedValueOnce(response(200, [])).mockResolvedValueOnce(response(200, [row]));
    await request(app.getHttpServer()).put(`${endpoint}/${id}`).set('Authorization', auth)
      .send({ ...payload, expectedUpdatedAt: '2026-11-18T00:00:00Z' }).expect(409);
    expect(storage.mock.calls.filter(([, options]) => options?.method === 'PATCH')).toHaveLength(1);
  });

  it('reports a missing entry separately from a concurrent edit', async () => {
    storage.mockResolvedValueOnce(response(200, [])).mockResolvedValueOnce(response(200, []));
    await request(app.getHttpServer()).put(`${endpoint}/${id}`).set('Authorization', auth)
      .send({ ...payload, expectedUpdatedAt: row.updated_at }).expect(404);
  });

  it('requires a timestamp on updates and a UUID in the path', async () => {
    await request(app.getHttpServer()).put(`${endpoint}/${id}`).set('Authorization', auth).send(payload).expect(400);
    await request(app.getHttpServer()).put(`${endpoint}/not-a-uuid`).set('Authorization', auth)
      .send({ ...payload, expectedUpdatedAt: row.updated_at }).expect(400);
    expect(storage).not.toHaveBeenCalled();
  });

  it.each(['http', 'network', 'malformed'])('reports %s storage failures without exposing upstream details', async (failure) => {
    if (failure === 'http') storage.mockResolvedValueOnce(response(404, { message: 'Internal database details' }));
    if (failure === 'network') storage.mockRejectedValueOnce(new Error('Internal connection details'));
    if (failure === 'malformed') storage.mockResolvedValueOnce(response(200, {}));
    const result = await request(app.getHttpServer()).get(endpoint).set('Authorization', auth).expect(503);
    expect(result.body.message).toContain('database migrations');
    expect(JSON.stringify(result.body)).not.toContain('Internal');
    expect(JSON.stringify(result.body)).not.toContain('test-service-key');
  });

  function response(status: number, body: unknown): Response {
    return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
  }
});
