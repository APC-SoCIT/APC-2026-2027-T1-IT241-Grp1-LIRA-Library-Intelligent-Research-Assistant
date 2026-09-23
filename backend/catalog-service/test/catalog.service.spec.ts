import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { CatalogService } from '../src/catalog/catalog.service';
import { KohaClient } from '../src/koha/koha.client';
import { KohaIntegrationError } from '../src/koha/koha.exceptions';

describe('CatalogService', () => {
  const koha = {
    getBiblios: jest.fn(),
    getBiblio: jest.fn(),
    searchBiblios: jest.fn(),
  } as unknown as KohaClient;
  let service: CatalogService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CatalogService(koha);
  });

  it('normalizes Koha records without inventing missing metadata', async () => {
    koha.getBiblios = jest.fn().mockResolvedValue([{ biblio_id: 1, title: 'Title', author: null, publication_year: '2024', item_type: 'BK' }]);

    await expect(service.listBooks(1, 20)).resolves.toEqual({
      items: [{ id: 1, title: 'Title', subtitle: null, author: null, isbn: null, issn: null, publisher: null, publicationYear: 2024, publicationPlace: null, edition: null, language: null, description: null, itemType: 'BK', url: null }],
      pagination: { page: 1, limit: 20 },
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
});
