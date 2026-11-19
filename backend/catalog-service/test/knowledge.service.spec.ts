import { ConflictException, ExecutionContext, ForbiddenException, NotFoundException, ServiceUnavailableException, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { KnowledgeUpdateDto, KnowledgeWriteDto } from '../src/knowledge/knowledge.dto';
import { KnowledgeService } from '../src/knowledge/knowledge.service';
import { LibrarianGuard, LibrarianRequest } from '../src/shared/librarian.guard';

describe('Knowledge storage, validation and authorization (in process; mocked Supabase)', () => {
  const id = '3a9a8696-06a4-49f4-9f8a-94e94de737bb';
  const userId = '8f7abcf2-04f0-4ab1-a32a-e98a25cf5b5b';
  const input: KnowledgeWriteDto = { kind: 'faq', category: 'hours', title: 'Hours?', content: 'Approved information', sourceUrl: null };
  const row = { id, kind: input.kind, category: input.category, title: input.title, content: input.content,
    source_url: null, created_at: '2026-11-19T10:00:00.123456+00:00', updated_at: '2026-11-19T10:00:00.123456+00:00' };
  const settings: Record<string, string> = {
    'app.semantic.supabaseUrl': 'https://supabase.example.test',
    'app.semantic.supabaseServiceRoleKey': 'test-service-key',
  };
  let service: KnowledgeService;
  let guard: LibrarianGuard;
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    const config = { get: (key: string, fallback: string) => settings[key] ?? fallback } as ConfigService;
    service = new KnowledgeService(config);
    guard = new LibrarianGuard(config);
    fetchSpy = jest.spyOn(globalThis, 'fetch');
  });
  afterEach(() => fetchSpy.mockRestore());

  it('maps private storage rows and paginates without exposing actor IDs', async () => {
    fetchSpy.mockResolvedValueOnce(response(200, [{ ...row, created_by: userId }]));
    const result = await service.list(2, 10);
    expect(result).toEqual({ items: [{ id, ...input, createdAt: row.created_at, updatedAt: row.updated_at }], pagination: { page: 2, limit: 10 } });
    const url = new URL(fetchSpy.mock.calls[0][0]);
    expect(url.searchParams.get('offset')).toBe('10');
    expect(url.searchParams.get('limit')).toBe('10');
  });

  it('stores content and librarian attribution with the server credential', async () => {
    fetchSpy.mockResolvedValueOnce(response(201, [row]));
    await service.create(input, userId);
    const options = fetchSpy.mock.calls[0][1];
    expect(options.method).toBe('POST');
    expect(options.headers).toMatchObject({ apikey: 'test-service-key', Authorization: 'Bearer test-service-key', Prefer: 'return=representation' });
    expect(JSON.parse(options.body)).toEqual({ kind: 'faq', category: 'hours', title: input.title,
      content: input.content, source_url: null, created_by: userId, updated_by: userId });
  });

  it('filters updates by the exact database timestamp, including microseconds', async () => {
    fetchSpy.mockResolvedValueOnce(response(200, [row]));
    await service.update(id, { ...input, expectedUpdatedAt: row.updated_at }, userId);
    const url = new URL(fetchSpy.mock.calls[0][0]);
    expect(url.searchParams.get('id')).toBe(`eq.${id}`);
    expect(url.searchParams.get('updated_at')).toBe(`eq.${row.updated_at}`);
    expect(JSON.parse(fetchSpy.mock.calls[0][1].body)).toMatchObject({ updated_by: userId });
    expect(JSON.parse(fetchSpy.mock.calls[0][1].body)).not.toHaveProperty('expectedUpdatedAt');
  });

  it('does not retry a conflicting write against a newer version', async () => {
    fetchSpy.mockResolvedValueOnce(response(200, [])).mockResolvedValueOnce(response(200, [row]));
    await expect(service.update(id, { ...input, expectedUpdatedAt: row.updated_at }, userId)).rejects.toBeInstanceOf(ConflictException);
    expect(fetchSpy.mock.calls.filter(([, options]) => options.method === 'PATCH')).toHaveLength(1);
  });

  it('distinguishes a missing entry from a stale version', async () => {
    fetchSpy.mockResolvedValueOnce(response(200, [])).mockResolvedValueOnce(response(200, []));
    await expect(service.update(id, { ...input, expectedUpdatedAt: row.updated_at }, userId)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('does not report a successful creation without a persisted row', async () => {
    fetchSpy.mockResolvedValueOnce(response(200, []));
    await expect(service.create(input, userId)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it.each(['http', 'network', 'malformed'])('hides internal details for %s failures', async (kind) => {
    if (kind === 'http') fetchSpy.mockResolvedValueOnce(response(500, { message: 'Internal database details' }));
    if (kind === 'network') fetchSpy.mockRejectedValueOnce(new Error('Internal connection details'));
    if (kind === 'malformed') fetchSpy.mockResolvedValueOnce(response(200, {}));
    await expect(service.list(1, 20)).rejects.toMatchObject({ status: 503,
      message: 'Knowledge storage is unavailable. Check the connection and required database migrations, then try again.' });
  });

  it('rejects unconfigured storage before making requests', async () => {
    const unconfigured = new KnowledgeService({ get: () => '' } as unknown as ConfigService);
    await expect(unconfigured.list(1, 20)).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('trims whitespace and clears an omitted source link through actual DTO validation', async () => {
    const pipe = new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true });
    const result = await pipe.transform({ ...input, title: '  Hours? ', content: ' Approved information ', sourceUrl: ' ' }, { type: 'body', metatype: KnowledgeWriteDto });
    expect(result).toMatchObject(input);
  });

  it('accepts policy content, a source URL and a database timestamp', async () => {
    const pipe = new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true });
    await expect(pipe.transform({ ...input, kind: 'policy', category: 'rules', sourceUrl: 'https://library.example.test/rules', expectedUpdatedAt: row.updated_at }, { type: 'body', metatype: KnowledgeUpdateDto })).resolves.toMatchObject({ kind: 'policy', expectedUpdatedAt: row.updated_at });
  });

  it.each([
    { title: '   ' }, { content: '\n ' }, { content: 'a'.repeat(10001) }, { title: 'a'.repeat(201) },
    { kind: 'prompt' }, { category: 'unknown' }, { sourceUrl: 'javascript:alert(1)' },
    { sourceUrl: 'https://user:password@example.test/policy' }, { created_by: userId }, { published: true },
  ])('rejects invalid or unauthorized body fields, case %#', async (invalid) => {
    const pipe = new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true });
    await expect(pipe.transform({ ...input, ...invalid }, { type: 'body', metatype: KnowledgeWriteDto })).rejects.toMatchObject({ status: 400 });
  });

  it('requires optimistic concurrency metadata when editing', async () => {
    const pipe = new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true });
    await expect(pipe.transform(input, { type: 'body', metatype: KnowledgeUpdateDto })).rejects.toMatchObject({ status: 400 });
  });

  it('denies requests without a bearer token before any external call', async () => {
    await expect(guard.canActivate(context({ headers: {} }))).rejects.toBeInstanceOf(UnauthorizedException);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('denies invalid sessions before reading profile roles', async () => {
    fetchSpy.mockResolvedValueOnce(response(401, {}));
    await expect(guard.canActivate(context({ headers: { authorization: 'Bearer expired-token' } }))).rejects.toBeInstanceOf(UnauthorizedException);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('denies students even with a valid session', async () => {
    fetchSpy.mockResolvedValueOnce(response(200, { id: userId })).mockResolvedValueOnce(response(200, [{ role: 'student' }]));
    await expect(guard.canActivate(context({ headers: { authorization: 'Bearer student-token' } }))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('attaches only a verified librarian identity for server-side authorship', async () => {
    fetchSpy.mockResolvedValueOnce(response(200, { id: userId })).mockResolvedValueOnce(response(200, [{ role: 'librarian' }]));
    const req = { headers: { authorization: 'Bearer librarian-token' } } as LibrarianRequest;
    await expect(guard.canActivate(context(req))).resolves.toBe(true);
    expect(req.librarianUser).toEqual({ id: userId });
  });

  function context(req: unknown): ExecutionContext {
    return { switchToHttp: () => ({ getRequest: () => req }) } as ExecutionContext;
  }
  function response(status: number, body: unknown): Response {
    return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
  }
});
