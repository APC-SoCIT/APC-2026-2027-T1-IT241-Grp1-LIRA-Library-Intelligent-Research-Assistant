import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { CatalogService } from '../src/catalog/catalog.service';
import { Book } from '../src/catalog/book.types';
import { KohaClient } from '../src/koha/koha.client';
import { KohaIntegrationError } from '../src/koha/koha.exceptions';

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

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CatalogService(koha, semantic);
  });

  it('normalizes Koha records without inventing missing metadata', async () => {
    koha.getBiblios = jest.fn().mockResolvedValue([{ biblio_id: 1, title: 'Title', author: null, publication_year: '2024', item_type: 'BK' }]);

    await expect(service.listBooks(1, 20)).resolves.toEqual({
      items: [{ id: 1, title: 'Title', subtitle: null, author: null, isbn: null, issn: null, publisher: null, publicationYear: 2024, publicationPlace: null, edition: null, language: null, description: null, itemType: 'BK', genres: [], subjects: [], series: null, url: null }],
      pagination: { page: 1, limit: 20 },
    });
  });

  it('normalizes Koha genre, subject, and series metadata for catalog filters', async () => {
    koha.getBiblios = jest.fn().mockResolvedValue([{
      biblio_id: 2,
      title: 'Record',
      genre_form: ['Fiction', 'Historical fiction'],
      subject: [{ name: 'Women authors' }],
      collection_title: 'Library classics',
    }]);

    await expect(service.listBooks(1, 20)).resolves.toMatchObject({
      items: [{ genres: ['Fiction', 'Historical fiction'], subjects: ['Women authors'], series: 'Library classics' }],
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
      series: null,
      url: null,
    };
  }
});
