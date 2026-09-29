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

  async getBookContent(id: number): Promise<{ content: string; sourceUrl: string; resolvedUrl: string }> {
    const book = await this.getBook(id);
    const sourceUrl = book.url?.split('|')[0]?.trim();
    if (!sourceUrl) throw new NotFoundException('Book has no online reading resource');

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(sourceUrl);
    } catch {
      throw new BadRequestException('Book has an invalid online reading resource');
    }

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new BadRequestException('Online reading resource is not supported');
    }

    try {
      const response = await fetch(parsedUrl);
      if (!response.ok) throw new Error(`Reading resource returned HTTP ${response.status}`);
      return { content: await response.text(), sourceUrl, resolvedUrl: response.url };
    } catch (error: unknown) {
      this.logger.warn(`Could not fetch reading resource for book ${id}`);
      throw new ServiceUnavailableException('Online reading resource is unavailable');
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
      genres: this.stringList(record.genres ?? record.genre ?? record.genre_forms ?? record.genre_form),
      subjects: this.stringList(record.subjects ?? record.subject ?? record.subject_headings ?? record.subject_heading),
      series: this.stringOrNull(record.series_title ?? record.collection_title),
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

  private stringList(value: unknown): string[] {
    if (typeof value === 'string') return value.split('|').map((entry) => entry.trim()).filter(Boolean);
    if (!Array.isArray(value)) return [];
    return value.flatMap((entry) => {
      if (typeof entry === 'string') return entry.split('|').map((item) => item.trim()).filter(Boolean);
      if (typeof entry === 'object' && entry !== null && 'name' in entry && typeof entry.name === 'string') {
        return [entry.name];
      }
      return [];
    });
  }

  private numberOrNull(value: unknown): number | null {
    if (typeof value === 'number' && Number.isInteger(value)) return value;
    if (typeof value === 'string' && /^-?\d+$/.test(value)) return Number(value);
    return null;
  }
}
