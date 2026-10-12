import { BadRequestException, HttpException, HttpStatus, Injectable, Logger, NotFoundException, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { Book, BookListResponse } from './book.types';
import { KohaIntegrationError } from '../koha/koha.exceptions';
import { KohaClient } from '../koha/koha.client';
import { KohaBiblio } from '../koha/koha.types';
import { SemanticSearchService } from './semantic-search.service';
import { CatalogWriteDto } from './dto/catalog-write.dto';
import { buildBookResources } from './book-resources';
import { ResourceContentService } from './resource-content.service';
import { ResourceStream } from './resource.types';
import { ConfigService } from '@nestjs/config';
import { defaultOpacUrl } from './resource-policy';

@Injectable()
export class CatalogService {
  private readonly logger = new Logger(CatalogService.name);
  private readonly hybridCache = new Map<string, { expiresAt: number; books: Book[] }>();

  constructor(
    private readonly koha: KohaClient,
    private readonly semantic: SemanticSearchService,
    private readonly resourceContent: ResourceContentService,
    private readonly config?: ConfigService,
  ) {}

  async listBooks(page: number, limit: number): Promise<BookListResponse> {
    try {
      const records = await this.koha.getBiblios(page, limit);
      return { items: records.map((record) => this.normalize(record)), pagination: { page, limit } };
    } catch (error: unknown) {
      throw this.mapKohaError(error);
    }
  }

  async listNewArrivals(page: number, limit: number): Promise<BookListResponse> {
    try {
      // Koha biblionumbers increase as bibliographic records are created.
      const records = await this.koha.getBiblios(page, limit, '-biblio_id');
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
    // Retain legacy URL order for reader consumers, skipping known binaries.
    const legacy = buildBookResources([], book.url);
    const ordered = [...legacy.map((entry) => book.resources.find((resource) => resource.id === entry.id))
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry)), ...book.resources];
    const resource = ordered.find((entry) => entry.format === 'html' || entry.format === 'text')
      ?? ordered.find((entry) => entry.format === 'unknown');
    if (!resource) throw new NotFoundException('Book has no online reading resource');
    const response = await this.resourceContent.retrieve(resource, book.title);
    if (!['text/html', 'text/plain'].includes(response.mediaType)) {
      throw new BadRequestException('Use the resource content endpoint for binary attachments');
    }
    const result = { content: response.bytes.toString('utf8'), sourceUrl: response.sourceUrl, resolvedUrl: response.resolvedUrl };
    if (Buffer.byteLength(JSON.stringify(result)) > this.resourceContent.readerMaxBytes) {
      throw new HttpException('Reading content exceeds the transfer limit', HttpStatus.PAYLOAD_TOO_LARGE);
    }
    return result;
  }

  async getResourceContent(id: number, resourceId: string, signal?: AbortSignal): Promise<ResourceStream> {
    if (!/^[a-f0-9]{64}$/.test(resourceId)) throw new BadRequestException('Invalid resource ID');
    const book = await this.getBook(id);
    const resource = book.resources.find((entry) => entry.id === resourceId);
    if (!resource) throw new NotFoundException('Book resource not found');
    return this.resourceContent.openStream(resource, book.title, signal);
  }

  async uploadResource(id: number, file: { buffer: Buffer; originalname: string; mimetype: string }): Promise<{ url: string; format: 'pdf' | 'epub'; mediaType: string; label: string }> {
    try {
      await this.getBook(id);
      if (!file?.buffer?.length) throw new BadRequestException('A PDF or EPUB file is required');
      if (file.buffer.length > this.resourceContent.maxBytes) throw new HttpException('File exceeds the transfer limit', HttpStatus.PAYLOAD_TOO_LARGE);
      const format = this.binaryFormat(file.buffer);
      if (format === 'unknown') throw new BadRequestException('The uploaded file is not a valid PDF or EPUB');
      const mediaType = format === 'pdf' ? 'application/pdf' : 'application/epub+zip';
      const hash = await this.koha.uploadFile(file.buffer, file.originalname || `resource.${format}`, mediaType);
      const opacBase = this.config?.get<string>('app.resources.opacBaseUrl')
        ?? defaultOpacUrl(this.config?.get<string>('app.koha.baseUrl') ?? 'http://localhost:8081');
      const url = new URL('/cgi-bin/koha/opac-retrieve-file.pl', opacBase);
      url.searchParams.set('id', hash);
      const stem = (file.originalname || format.toUpperCase()).replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9 ._-]/g, '_').trim();
      return { url: url.href, format, mediaType, label: stem || `${format.toUpperCase()} resource` };
    } catch (error: unknown) {
      if (error instanceof HttpException) throw error;
      throw this.mapKohaError(error);
    }
  }

  async uploadCover(id: number, file: { buffer: Buffer; originalname: string; mimetype: string }): Promise<{ url: string; mediaType: string; label: string }> {
    try {
      await this.getBook(id);
      const mediaType = this.imageType(file.buffer);
      if (!mediaType) throw new BadRequestException('The uploaded cover must be a valid JPEG, PNG, or WebP image');
      const hash = await this.koha.uploadFile(file.buffer, file.originalname || 'cover', mediaType);
      const opacBase = this.config?.get<string>('app.resources.opacBaseUrl') ?? defaultOpacUrl(this.config?.get<string>('app.koha.baseUrl') ?? 'http://localhost:8081');
      const url = new URL('/cgi-bin/koha/opac-retrieve-file.pl', opacBase); url.searchParams.set('id', hash);
      return { url: url.href, mediaType, label: 'Cover image' };
    } catch (error: unknown) {
      if (error instanceof HttpException) throw error;
      throw this.mapKohaError(error);
    }
  }

  async createBook(record: CatalogWriteDto): Promise<Book> {
    try {
      return this.normalize(await this.koha.createBiblio(this.toKohaRecord(record)));
    } catch (error: unknown) {
      throw this.mapKohaError(error);
    }
  }

  async updateBook(id: number, record: CatalogWriteDto): Promise<Book> {
    try {
      await this.koha.updateBiblio(id, this.toKohaRecord(record));
      // Koha's write response may omit MARC 856 fields. Re-read the record so
      // newly attached PDF/EPUB/cover URLs are immediately reflected in LIRA.
      return this.normalize(await this.koha.getBiblio(id));
    } catch (error: unknown) {
      throw this.mapKohaError(error);
    }
  }

  async deleteBook(id: number): Promise<void> {
    try {
      await this.koha.deleteBiblio(id);
    } catch (error: unknown) {
      throw this.mapKohaError(error);
    }
  }

  async searchBooks(
    query: string,
    page: number,
    limit: number,
    mode: 'keyword' | 'semantic' | 'hybrid' = 'keyword',
  ): Promise<BookListResponse> {
    if (mode === 'semantic') {
      const matches = await this.semantic.search(query.trim(), this.semantic.matchLimit);
      const start = (page - 1) * limit;
      return { items: matches.slice(start, start + limit).map((book) => this.withResources(book)), pagination: { page, limit } };
    }

    if (mode === 'hybrid') {
      return this.searchHybrid(query.trim(), page, limit);
    }

    try {
      const records = await this.koha.searchBiblios(query.trim(), page, limit);
      return { items: records.map((record) => this.normalize(record)), pagination: { page, limit } };
    } catch (error: unknown) {
      throw this.mapKohaError(error);
    }
  }

  async reindexSemanticCatalog(indexKey: string | undefined): Promise<{ indexed: number }> {
    this.semantic.authorizeIndexRequest(indexKey);
    const records: KohaBiblio[] = [];
    const pageSize = 100;

    try {
      for (let page = 1; ; page++) {
        const batch = await this.koha.getBiblios(page, pageSize);
        records.push(...batch);
        if (batch.length < pageSize) break;
      }
    } catch (error: unknown) {
      throw this.mapKohaError(error);
    }

    const indexed = await this.semantic.indexBooks(records.map((record) => this.normalize(record)));
    this.hybridCache.clear();
    return { indexed };
  }

  private async searchHybrid(query: string, page: number, limit: number): Promise<BookListResponse> {
    const cached = this.hybridCache.get(query);
    let results = cached && cached.expiresAt > Date.now() ? cached.books : undefined;
    if (!results) {
      const [keywordBooks, semanticBooks] = await Promise.all([
        this.getAllKeywordMatches(query),
        this.semantic.search(query, this.semantic.matchLimit),
      ]);
      const ranked = new Map<number, { book: Book; score: number }>();

      for (const books of [keywordBooks, semanticBooks]) {
        books.forEach((book, index) => {
          const existing = ranked.get(book.id);
          const score = 1 / (60 + index + 1);
          ranked.set(book.id, { book, score: (existing?.score ?? 0) + score });
        });
      }

      results = [...ranked.values()]
        .sort((left, right) => right.score - left.score || (left.book.title ?? '').localeCompare(right.book.title ?? ''))
        .map(({ book }) => this.withResources(book));
      if (this.hybridCache.size >= 100) {
        const oldestKey = this.hybridCache.keys().next().value;
        if (oldestKey) this.hybridCache.delete(oldestKey);
      }
      this.hybridCache.set(query, { expiresAt: Date.now() + 30000, books: results });
    }

    const start = (page - 1) * limit;
    return { items: results.slice(start, start + limit), pagination: { page, limit } };
  }

  private async getAllKeywordMatches(query: string): Promise<Book[]> {
    const records: KohaBiblio[] = [];
    const pageSize = 100;

    try {
      for (let page = 1; ; page++) {
        const batch = await this.koha.searchBiblios(query, page, pageSize);
        records.push(...batch);
        if (batch.length < pageSize) break;
      }
    } catch (error: unknown) {
      throw this.mapKohaError(error);
    }

    return records.map((record) => this.normalize(record));
  }

  private normalize(record: KohaBiblio): Book {
    const id = record.biblio_id ?? record.id;
    if (typeof id !== 'number') {
      throw new ServiceUnavailableException('Catalog service received an invalid book record');
    }

    const resources = this.publicResources(id, buildBookResources(record.resources, record.url));
    const coverSource = this.stringOrNull(record.cover_url);
    const coverResource = coverSource ? resources.find((resource) => resource.sourceUrl === coverSource) : undefined;
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
      description: this.stringOrNull(record.description ?? record.abstract),
      itemType: this.stringOrNull(record.item_type),
      genres: this.stringList(record.genres ?? record.genre ?? record.genre_forms ?? record.genre_form),
      subjects: this.stringList(record.subjects ?? record.subject ?? record.subject_headings ?? record.subject_heading),
      categories: this.stringList(record.categories),
      series: this.stringOrNull(record.series_title ?? record.collection_title),
      url: this.stringOrNull(record.url),
      resources,
      ...(coverSource ? { coverUrl: coverResource?.contentUrl ?? coverSource } : {}),
      ...(coverSource ? { coverSourceUrl: coverSource } : {}),
    };
  }

  private withResources(book: Book): Book {
    // Older semantic index rows have only the pipe-separated url. Derive a
    // fallback without another Koha/MARC request; detail retrieval is authoritative.
    return { ...book, resources: this.publicResources(book.id, book.resources ?? buildBookResources([], book.url)) };
  }

  private publicResources(id: number, resources: Book['resources']): Book['resources'] {
    return resources.map((resource) => ({ ...resource,
      contentUrl: this.resourceContent.canRetrieve(resource.sourceUrl, resource.mediaType)
        ? `/api/catalog/books/${id}/resources/${resource.id}/content` : null,
    }));
  }

  private toKohaRecord(record: CatalogWriteDto): Record<string, unknown> {
    const fields: Array<Record<string, unknown>> = [
      { '245': { ind1: '0', ind2: '0', subfields: [{ a: record.title }] } },
    ];

    this.addField(fields, '100', record.author, '1', ' ');
    this.addField(fields, '020', record.isbn, ' ', ' ');
    this.addField(fields, '264', [record.publicationPlace, record.publisher, record.publicationYear]
      .filter((value) => value !== undefined && value !== '')
      .join(' : '), ' ', '1');
    this.addField(fields, '041', record.language, '0', ' ');
    this.addField(fields, '520', record.description, ' ', ' ');
    const resources = record.resources?.length ? record.resources : (record.url ? [{ url: record.url }] : []);
    for (const resource of resources) {
      const field: Record<string, unknown> = { ind1: '4', ind2: '0', subfields: [{ u: resource.url }] };
      if ('format' in resource && resource.format) (field.subfields as Array<Record<string, string>>).push({ q: resource.format });
      if ('label' in resource && resource.label) (field.subfields as Array<Record<string, string>>).push({ y: resource.label });
      fields.push({ '856': field });
    }
    if (record.coverUrl) fields.push({ '856': { ind1: '4', ind2: '2', subfields: [{ '3': 'Cover image' }, { u: record.coverUrl }, { y: 'Cover image' }] } });
    this.addField(fields, '942', record.itemType, ' ', ' ', 'c');

    for (const category of record.categories ?? []) this.addField(fields, '650', category, ' ', '4');
    for (const genre of record.genres ?? []) this.addField(fields, '655', genre, ' ', '7');

    return {
      leader: '00000nam a2200000 i 4500',
      fields,
    };
  }

  private binaryFormat(bytes: Buffer): 'pdf' | 'epub' | 'unknown' {
    if (bytes.subarray(0, 5).equals(Buffer.from('%PDF-'))) return 'pdf';
    if (bytes.length >= 58 && bytes.readUInt32LE(0) === 0x04034b50 && bytes.readUInt16LE(8) === 0
      && (bytes.readUInt16LE(6) & 1) === 0 && bytes.readUInt32LE(18) === 20 && bytes.readUInt32LE(22) === 20
      && bytes.readUInt16LE(26) === 8 && bytes.readUInt16LE(28) === 0
      && bytes.subarray(30, 38).toString('ascii') === 'mimetype'
      && bytes.subarray(38, 58).toString('ascii') === 'application/epub+zip') return 'epub';
    return 'unknown';
  }

  private imageType(bytes: Buffer): string | null {
    if (bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return 'image/jpeg';
    if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
    if (bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
    return null;
  }

  private addField(
    fields: Array<Record<string, unknown>>,
    tag: string,
    value: string | number | undefined,
    ind1: string,
    ind2: string,
    code = 'a',
  ): void {
    if (value === undefined || value === null || String(value).trim() === '') return;
    fields.push({ [tag]: { ind1, ind2, subfields: [{ [code]: String(value) }] } });
  }

  private mapKohaError(error: unknown): Error {
    if (!(error instanceof KohaIntegrationError)) {
      this.logger.error('Unexpected catalog integration error');
      return new ServiceUnavailableException('Catalog service temporarily unavailable');
    }

    switch (error.kind) {
      case 'not-found': return new NotFoundException('Book not found');
      case 'bad-request': return new BadRequestException(error.message);
      case 'unauthorized': return new UnauthorizedException(error.message);
      case 'forbidden': return new UnauthorizedException(error.message);
      case 'rate-limit': return new HttpException('Catalog service rate limit exceeded', HttpStatus.TOO_MANY_REQUESTS);
      case 'unavailable': return new ServiceUnavailableException(error.message);
      default: return new ServiceUnavailableException(error.message || 'Catalog service temporarily unavailable');
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
