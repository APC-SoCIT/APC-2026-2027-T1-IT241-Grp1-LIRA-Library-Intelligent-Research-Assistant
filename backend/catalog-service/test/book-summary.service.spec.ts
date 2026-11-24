import { ConfigService } from '@nestjs/config';
import { BookSummaryService } from '../src/catalog/book-summary.service';
import { BookSummaryExtractor } from '../src/catalog/book-summary-extractor';
import { CatalogService } from '../src/catalog/catalog.service';
import { ResourceContentService } from '../src/catalog/resource-content.service';

describe('BookSummaryService', () => {
  const originalFetch = global.fetch;
  const config = {
    get: (key: string) => ({
      'app.semantic.supabaseUrl': 'https://project.supabase.co',
      'app.semantic.supabaseServiceRoleKey': 'service-role-key',
    }[key]),
  } as unknown as ConfigService;
  const service = new BookSummaryService(
    config,
    {} as CatalogService,
    {} as ResourceContentService,
    {} as BookSummaryExtractor,
  );

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('filters review records by status and returns their catalog and resource identifiers', async () => {
    const row = {
      id: 'summary-uid',
      book_id: 42,
      resource_id: 'a'.repeat(64),
      source_hash: 'b'.repeat(64),
      book_title: 'Catalog Book',
      source_language: 'eng',
      summary: 'A generated summary.',
      status: 'approved',
      generation_token: 'generation-token',
      generated_by: 'user-id',
      generated_at: '2026-11-24T10:00:00.000Z',
      generation_started_at: '2026-11-24T10:00:00.000Z',
      reviewed_by: 'librarian-id',
      reviewed_at: '2026-11-24T11:00:00.000Z',
      reviewer_note: null,
      created_at: '2026-11-24T10:00:00.000Z',
      updated_at: '2026-11-24T11:00:00.000Z',
    };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify([row]),
    }) as jest.Mock;

    const summaries = await service.listSummaries('approved');

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('status=eq.approved'),
      expect.objectContaining({ headers: expect.objectContaining({ apikey: 'service-role-key' }) }),
    );
    expect(summaries[0]).toMatchObject({
      id: 'summary-uid',
      bookId: 42,
      resourceId: 'a'.repeat(64),
      status: 'approved',
    });
  });
});
