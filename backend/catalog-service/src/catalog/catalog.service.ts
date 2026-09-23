import { BadRequestException, HttpException, HttpStatus, Injectable, Logger, NotFoundException, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { Book, BookListResponse } from './book.types';
import { KohaIntegrationError } from '../koha/koha.exceptions';
import { KohaClient } from '../koha/koha.client';
import { KohaBiblio } from '../koha/koha.types';

@Injectable()
export class CatalogService {
  private readonly logger = new Logger(CatalogService.name);

  constructor(private readonly koha: KohaClient) {}

  async listBooks(page: number, limit: number): Promise<BookListResponse> {
    try {
      const records = await this.koha.getBiblios(page, limit);
      return { items: records.map((record) => this.normalize(record)), pagination: { page, limit } };
    } catch (error: unknown) {
      throw this.mapKohaError(error);
    }
  }

  async getBook(id: number): Promise<Book> {
    try {
      return this.normalize(await this.koha.getBiblio(id));
    } catch (error: unknown) {
      throw this.mapKohaError(error);
    }
  }

  async searchBooks(query: string, page: number, limit: number): Promise<BookListResponse> {
    try {
      const records = await this.koha.searchBiblios(query.trim(), page, limit);
      return { items: records.map((record) => this.normalize(record)), pagination: { page, limit } };
    } catch (error: unknown) {
      throw this.mapKohaError(error);
    }
  }

  private normalize(record: KohaBiblio): Book {
    const id = record.biblio_id ?? record.id;
    if (typeof id !== 'number') {
      throw new ServiceUnavailableException('Catalog service received an invalid book record');
    }

    return {
      id,
      title: this.stringOrNull(record.title),
      subtitle: this.stringOrNull(record.subtitle),
      author: this.stringOrNull(record.author),
      isbn: this.stringOrNull(record.isbn),
      issn: this.stringOrNull(record.issn),
      publisher: this.stringOrNull(record.publisher),
      publicationYear: this.numberOrNull(record.publication_year),
      publicationPlace: this.stringOrNull(record.publication_place),
      edition: this.stringOrNull(record.edition),
      language: this.stringOrNull(record.language),
      description: this.stringOrNull(record.description),
      itemType: this.stringOrNull(record.item_type),
      url: this.stringOrNull(record.url),
    };
  }

  private mapKohaError(error: unknown): Error {
    if (!(error instanceof KohaIntegrationError)) {
      this.logger.error('Unexpected catalog integration error');
      return new ServiceUnavailableException('Catalog service temporarily unavailable');
    }

    switch (error.kind) {
      case 'not-found': return new NotFoundException('Book not found');
      case 'bad-request': return new BadRequestException('Catalog request was rejected');
      case 'unauthorized': return new UnauthorizedException('Catalog integration is not authorized');
      case 'forbidden': return new UnauthorizedException('Catalog integration is not authorized');
      case 'rate-limit': return new HttpException('Catalog service rate limit exceeded', HttpStatus.TOO_MANY_REQUESTS);
      default: return new ServiceUnavailableException('Catalog service temporarily unavailable');
    }
  }

  private stringOrNull(value: unknown): string | null {
    return typeof value === 'string' && value.length > 0 ? value : null;
  }

  private numberOrNull(value: unknown): number | null {
    if (typeof value === 'number' && Number.isInteger(value)) return value;
    if (typeof value === 'string' && /^-?\d+$/.test(value)) return Number(value);
    return null;
  }
}
