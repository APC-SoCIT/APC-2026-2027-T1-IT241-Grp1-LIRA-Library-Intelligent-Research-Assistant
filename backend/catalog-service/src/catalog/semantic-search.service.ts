import { randomUUID, timingSafeEqual } from 'node:crypto';
import { Injectable, Logger, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Book } from './book.types';

interface SemanticConfiguration {
  openRouterApiKey: string;
  openRouterEmbeddingModel: string;
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  indexApiKey: string;
  matchLimit: number;
}

interface CatalogEmbeddingRow {
  book_id: number;
  searchable_text: string;
  embedding: string;
  book_data: Book;
  updated_at: string;
  index_run_id: string;
}

interface SemanticMatchRow {
  book_data: unknown;
}

@Injectable()
export class SemanticSearchService {
  private readonly logger = new Logger(SemanticSearchService.name);
  private readonly config: SemanticConfiguration;
  private readonly searchCache = new Map<string, { expiresAt: number; books: Book[] }>();

  constructor(config: ConfigService) {
    this.config = config.getOrThrow<SemanticConfiguration>('app.semantic');
  }

  get matchLimit(): number {
    return this.config.matchLimit;
  }

  authorizeIndexRequest(suppliedKey: string | undefined): void {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException('Semantic search is not configured');
    }

    const expected = Buffer.from(this.config.indexApiKey);
    const supplied = Buffer.from(suppliedKey ?? '');
    if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
      throw new UnauthorizedException('Semantic catalog indexing is not authorized');
    }
  }

  isConfigured(): boolean {
    return Boolean(
      this.config.openRouterApiKey
      && this.config.openRouterEmbeddingModel
      && this.config.supabaseUrl
      && this.config.supabaseServiceRoleKey
      && this.config.indexApiKey,
    );
  }

  async search(query: string, limit: number): Promise<Book[]> {
    this.requireConfiguration();
    const cached = this.searchCache.get(query);
    if (cached && cached.expiresAt > Date.now()) return cached.books;

    const [embedding] = await this.createEmbeddings([query]);
    const rows = await this.supabaseRequest<SemanticMatchRow[]>('/rest/v1/rpc/match_catalog_books', {
      method: 'POST',
      body: JSON.stringify({
        query_embedding: this.vectorLiteral(embedding),
        match_count: limit,
      }),
    });

    if (!Array.isArray(rows)) {
      throw new ServiceUnavailableException('Supabase returned invalid semantic search results');
    }
    const books = rows.map(({ book_data }) => {
      if (!this.isBook(book_data)) {
        throw new ServiceUnavailableException('Supabase returned invalid semantic search results');
      }
      return book_data;
    });
    if (this.searchCache.size >= 100) {
      const oldestKey = this.searchCache.keys().next().value;
      if (oldestKey) this.searchCache.delete(oldestKey);
    }
    this.searchCache.set(query, { expiresAt: Date.now() + 30000, books });
    return books;
  }

  async indexBooks(books: Book[]): Promise<number> {
    this.requireConfiguration();
    const batchSize = 32;
    const indexRunId = randomUUID();
    const indexStartedAt = new Date().toISOString();
    let indexed = 0;

    for (let start = 0; start < books.length; start += batchSize) {
      const batch = books.slice(start, start + batchSize);
      const searchableTexts = batch.map((book) => this.searchableText(book));
      const embeddings = await this.createEmbeddings(searchableTexts);
      const rows: CatalogEmbeddingRow[] = batch.map((book, index) => ({
        book_id: book.id,
        searchable_text: searchableTexts[index],
        embedding: this.vectorLiteral(embeddings[index]),
        book_data: book,
        updated_at: indexStartedAt,
        index_run_id: indexRunId,
      }));

      await this.supabaseRequest<null>('/rest/v1/catalog_embeddings?on_conflict=book_id', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(rows),
      });
      indexed += batch.length;
    }

    await this.supabaseRequest<null>('/rest/v1/rpc/delete_stale_catalog_embeddings', {
      method: 'POST',
      body: JSON.stringify({ active_index_run: indexRunId }),
    });
    this.searchCache.clear();
    return indexed;
  }

  private async createEmbeddings(inputs: string[]): Promise<number[][]> {
    const response = await this.fetchJson<{ data?: Array<{ embedding: number[] }> }>(
      'https://openrouter.ai/api/v1/embeddings',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.config.openRouterApiKey}` },
        body: JSON.stringify({ model: this.config.openRouterEmbeddingModel, input: inputs }),
      },
      'OpenRouter embedding service',
      120000,
    );

    if (!Array.isArray(response.data) || response.data.length !== inputs.length) {
      throw new ServiceUnavailableException('OpenRouter returned an invalid embedding response');
    }

    const embeddings = response.data.map(({ embedding }) => embedding);
    if (embeddings.some((embedding) =>
      !Array.isArray(embedding)
      || embedding.length !== 1536
      || embedding.some((value) => !Number.isFinite(value)))) {
      throw new ServiceUnavailableException('OpenRouter model must return 1536-dimensional vectors for the configured index');
    }
    return embeddings;
  }

  private async supabaseRequest<T>(
    path: string,
    options: { method: string; headers?: Record<string, string>; body: string },
  ): Promise<T> {
    return this.fetchJson<T>(
      `${this.config.supabaseUrl}${path}`,
      {
        ...options,
        headers: {
          apikey: this.config.supabaseServiceRoleKey,
          Authorization: `Bearer ${this.config.supabaseServiceRoleKey}`,
          'Content-Type': 'application/json',
          ...options.headers,
        },
      },
      'Supabase semantic index',
    );
  }

  private async fetchJson<T>(
    url: string,
    options: { method: string; headers?: Record<string, string>; body: string },
    integrationName: string,
    timeoutMs = 30000,
  ): Promise<T> {
    let response: Response;
    try {
      response = await fetch(url, { ...options, signal: AbortSignal.timeout(timeoutMs) });
    } catch {
      this.logger.error(`${integrationName} request could not reach its service`);
      throw new ServiceUnavailableException(`${integrationName} is unavailable`);
    }

    if (!response.ok) {
      this.logger.error(`${integrationName} request failed with HTTP ${response.status}`);
      throw new ServiceUnavailableException(`${integrationName} request failed`);
    }

    if (response.status === 204) return null as T;
    try {
      return await response.json() as T;
    } catch {
      this.logger.error(`${integrationName} returned an invalid response`);
      throw new ServiceUnavailableException(`${integrationName} returned an invalid response`);
    }
  }

  private searchableText(book: Book): string {
    return [
      book.title && `Title: ${book.title}`,
      book.subtitle && `Subtitle: ${book.subtitle}`,
      book.author && `Author: ${book.author}`,
      book.description && `Description: ${book.description}`,
      book.genres.length > 0 && `Genres: ${book.genres.join(', ')}`,
      book.subjects.length > 0 && `Subjects: ${book.subjects.join(', ')}`,
      book.categories?.length && `Categories: ${book.categories.join(', ')}`,
      book.series && `Series: ${book.series}`,
      book.publisher && `Publisher: ${book.publisher}`,
      book.publicationPlace && `Publication place: ${book.publicationPlace}`,
      book.publicationYear && `Publication year: ${book.publicationYear}`,
      book.itemType && `Item type: ${book.itemType}`,
      book.language && `Language: ${book.language}`,
    ].filter((field): field is string => Boolean(field)).join('\n').slice(0, 6000) || `Catalog record ${book.id}`;
  }

  private vectorLiteral(embedding: number[]): string {
    return `[${embedding.join(',')}]`;
  }

  private isBook(value: unknown): value is Book {
    if (!value || typeof value !== 'object') return false;
    const book = value as Partial<Book>;
    return typeof book.id === 'number'
      && (typeof book.title === 'string' || book.title === null)
      && (typeof book.subtitle === 'string' || book.subtitle === null)
      && (typeof book.author === 'string' || book.author === null)
      && (typeof book.isbn === 'string' || book.isbn === null)
      && (typeof book.issn === 'string' || book.issn === null)
      && (typeof book.publisher === 'string' || book.publisher === null)
      && (typeof book.publicationYear === 'number' || book.publicationYear === null)
      && (typeof book.publicationPlace === 'string' || book.publicationPlace === null)
      && (typeof book.edition === 'string' || book.edition === null)
      && (typeof book.language === 'string' || book.language === null)
      && (typeof book.description === 'string' || book.description === null)
      && (typeof book.itemType === 'string' || book.itemType === null)
      && Array.isArray(book.genres)
      && Array.isArray(book.subjects)
      && (book.categories === undefined || Array.isArray(book.categories))
      && (typeof book.series === 'string' || book.series === null)
      && (typeof book.url === 'string' || book.url === null);
  }

  private requireConfiguration(): void {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException('Semantic search is not configured');
    }
  }
}
