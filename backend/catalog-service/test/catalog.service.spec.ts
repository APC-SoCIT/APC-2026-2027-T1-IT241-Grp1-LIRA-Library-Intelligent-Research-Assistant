import { BadRequestException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { CatalogService } from '../src/catalog/catalog.service';
import { Book } from '../src/catalog/book.types';
import { KohaClient } from '../src/koha/koha.client';
import { KohaIntegrationError } from '../src/koha/koha.exceptions';
import { ResourceContentService } from '../src/catalog/resource-content.service';

describe('CatalogService', () => {
  const koha = {
    getBiblios: jest.fn(),
    getBiblio: jest.fn(),
    searchBiblios: jest.fn(),
  } as unknown as KohaClient;
  const semantic = {
    matchLimit: 500,
    search: jest.fn(),
    indexBooks: jest.fn(),
    authorizeIndexRequest: jest.fn(),
  } as unknown as import('../src/catalog/semantic-search.service').SemanticSearchService;
  let service: CatalogService;
  const resourceContent = {
    canRetrieve: jest.fn().mockReturnValue(true),
    retrieve: jest.fn(),
    openStream: jest.fn(),
    maxBytes: 4000000,
    readerMaxBytes: 4000000,
  } as unknown as ResourceContentService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CatalogService(koha, semantic, resourceContent);
  });

  it('normalizes Koha records without inventing missing metadata', async () => {
    koha.getBiblios = jest.fn().mockResolvedValue([{ biblio_id: 1, title: 'Title', author: null, publication_year: '2024', item_type: 'BK' }]);

    await expect(service.listBooks(1, 20)).resolves.toEqual({
      items: [{ id: 1, title: 'Title', subtitle: null, author: null, isbn: null, issn: null, publisher: null, publicationYear: 2024, publicationPlace: null, edition: null, language: null, description: null, itemType: 'BK', genres: [], subjects: [], categories: [], series: null, url: null, resources: [] }],
      pagination: { page: 1, limit: 20 },
    });
  });

  it('normalizes Koha genre, subject, and series metadata for catalog filters', async () => {
    koha.getBiblios = jest.fn().mockResolvedValue([{
      biblio_id: 2,
      title: 'Record',
      genre_form: ['Fiction', 'Historical fiction'],
      subject: [{ name: 'Women authors' }],
      categories: ['Literature'],
      collection_title: 'Library classics',
    }]);

    await expect(service.listBooks(1, 20)).resolves.toMatchObject({
      items: [{ genres: ['Fiction', 'Historical fiction'], subjects: ['Women authors'], categories: ['Literature'], series: 'Library classics' }],
    });
  });

  it('uses Koha abstract as the book summary when description is absent', async () => {
    koha.getBiblios = jest.fn().mockResolvedValue([{
      biblio_id: 3,
      title: 'Pride and Prejudice',
      abstract: 'Elizabeth Bennet and Mr. Darcy reconsider their first impressions.',
    }]);

    await expect(service.listBooks(1, 20)).resolves.toMatchObject({
      items: [{ description: 'Elizabeth Bennet and Mr. Darcy reconsider their first impressions.' }],
    });
  });

  it('maps Koha 404 to a public book-not-found error', async () => {
    koha.getBiblio = jest.fn().mockRejectedValue(new KohaIntegrationError('not-found', 'hidden'));
    await expect(service.getBook(1)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('maps Koha connectivity failures to a safe 503 error', async () => {
    koha.getBiblios = jest.fn().mockRejectedValue(new KohaIntegrationError('unavailable', 'hidden'));
    await expect(service.listBooks(1, 20)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('paginates semantic results returned by the vector index', async () => {
    const matches = [book(1), book(2)];
    semantic.search = jest.fn().mockResolvedValue(matches);

    await expect(service.searchBooks('books about courage', 2, 1, 'semantic')).resolves.toEqual({
      items: [matches[1]],
      pagination: { page: 2, limit: 1 },
    });
    expect(koha.searchBiblios).not.toHaveBeenCalled();
  });

  it('ranks books found by both keyword and semantic search first in hybrid mode', async () => {
    koha.searchBiblios = jest.fn().mockResolvedValue([
      { biblio_id: 1, title: 'Keyword match' },
      { biblio_id: 2, title: 'Shared match' },
    ]);
    semantic.search = jest.fn().mockResolvedValue([book(2, 'Shared match'), book(3, 'Semantic match')]);

    await expect(service.searchBooks('search', 1, 1, 'hybrid')).resolves.toMatchObject({
      items: [{ id: 2, title: 'Shared match' }],
      pagination: { page: 1, limit: 1 },
    });
  });

  it('preserves existing fields while adding resources and backend URLs', async () => {
    const url = 'https://www.gutenberg.org/book.html|https://www.gutenberg.org/book.txt';
    koha.getBiblio = jest.fn().mockResolvedValue({ biblio_id: 17, title: 'Title', url, categories: ['Literature'] });
    const result = await service.getBook(17);
    expect(result).toMatchObject({ url, categories: ['Literature'] });
    expect(result.resources).toHaveLength(2);
    expect(result.resources[0].contentUrl).toBe(`/api/catalog/books/17/resources/${result.resources[0].id}/content`);
    resourceContent.canRetrieve = jest.fn().mockReturnValue(false);
    expect((await service.getBook(17)).resources.every((resource) => resource.contentUrl === null)).toBe(true);
    resourceContent.canRetrieve = jest.fn().mockReturnValue(true);
  });

  it('selects a resource from the current book by a stable ID after metadata reordering', async () => {
    const resources = [
      { url: 'https://www.gutenberg.org/first.pdf', formats: ['PDF'], labels: ['First'] },
      { url: 'https://www.gutenberg.org/second.epub', formats: ['EPUB'], labels: ['Second'] },
    ];
    koha.getBiblio = jest.fn().mockResolvedValue({ biblio_id: 17, resources });
    const selected = (await service.getBook(17)).resources[1];
    koha.getBiblio = jest.fn().mockResolvedValue({ biblio_id: 17, resources: [...resources].reverse() });
    resourceContent.openStream = jest.fn().mockResolvedValue({ mediaType: 'application/epub+zip' });
    await service.getResourceContent(17, selected.id);
    expect(resourceContent.openStream).toHaveBeenCalledWith(expect.objectContaining({ id: selected.id, sourceUrl: resources[1].url }), null, undefined);
  });

  it('rejects malformed and book-mismatched resource IDs without retrieving content', async () => {
    koha.getBiblio = jest.fn().mockResolvedValue({ biblio_id: 17, url: 'https://www.gutenberg.org/book.pdf' });
    await expect(service.getResourceContent(17, 'https://evil.example/book.pdf')).rejects.toBeInstanceOf(BadRequestException);
    expect(koha.getBiblio).not.toHaveBeenCalled();
    await expect(service.getResourceContent(17, '0'.repeat(64))).rejects.toBeInstanceOf(NotFoundException);
    expect(resourceContent.retrieve).not.toHaveBeenCalled();
    expect(resourceContent.openStream).not.toHaveBeenCalled();
  });

  it('keeps the HTML reader JSON shape and legacy URL priority when binary links come first', async () => {
    const url = 'https://www.gutenberg.org/binary.pdf|https://www.gutenberg.org/first.html|https://www.gutenberg.org/second.txt';
    koha.getBiblio = jest.fn().mockResolvedValue({ biblio_id: 17, title: 'Title', url });
    const expected = { content: '<html>Text café</html>', sourceUrl: 'https://www.gutenberg.org/first.html', resolvedUrl: 'https://www.gutenberg.org/resolved.html' };
    resourceContent.retrieve = jest.fn().mockResolvedValue({ bytes: Buffer.from(expected.content), mediaType: 'text/html', ...expected });
    await expect(service.getBookContent(17)).resolves.toEqual(expected);
    expect(resourceContent.retrieve).toHaveBeenCalledWith(expect.objectContaining({ sourceUrl: expected.sourceUrl }), 'Title');
  });

  it('keeps plain text responses compatible and enforces the JSON response transfer limit', async () => {
    koha.getBiblio = jest.fn().mockResolvedValue({ biblio_id: 17, url: 'https://www.gutenberg.org/book.txt' });
    const expected = { content: 'Plain text\nSecond line', sourceUrl: 'https://www.gutenberg.org/book.txt', resolvedUrl: 'https://www.gutenberg.org/book.txt' };
    resourceContent.retrieve = jest.fn().mockResolvedValue({ bytes: Buffer.from(expected.content), mediaType: 'text/plain', ...expected });
    await expect(service.getBookContent(17)).resolves.toEqual(expected);
    resourceContent.retrieve = jest.fn().mockResolvedValue({ bytes: Buffer.alloc(800000, 0x01), mediaType: 'text/plain', ...expected });
    await expect(service.getBookContent(17)).rejects.toMatchObject({ status: 413 });
  });

  it('does not turn PDF/EPUB bytes into legacy reader text, and handles books with no resources', async () => {
    koha.getBiblio = jest.fn().mockResolvedValue({ biblio_id: 17, url: 'https://www.gutenberg.org/opaque' });
    resourceContent.retrieve = jest.fn().mockResolvedValue({ bytes: Buffer.from('%PDF-1.7'), mediaType: 'application/pdf' });
    await expect(service.getBookContent(17)).rejects.toBeInstanceOf(BadRequestException);
    koha.getBiblio = jest.fn().mockResolvedValue({ biblio_id: 17 });
    await expect(service.getBookContent(17)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('adds URL-derived resources to older semantic index rows without extra Koha requests', async () => {
    semantic.search = jest.fn().mockResolvedValue([{ ...book(17), resources: undefined, url: 'https://www.gutenberg.org/book.txt' }]);
    const result = await service.searchBooks('text', 1, 20, 'semantic');
    expect(result.items[0].resources[0]).toMatchObject({ format: 'text', sourceUrl: 'https://www.gutenberg.org/book.txt' });
    expect(koha.getBiblio).not.toHaveBeenCalled();
  });

  function book(id: number, title = `Book ${id}`): Book {
    return {
      id,
      title,
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
      resources: [],
    };
  }
});
