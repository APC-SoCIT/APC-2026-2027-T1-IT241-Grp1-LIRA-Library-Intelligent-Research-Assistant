import { GutendexError } from './gutendex.errors.js';
import { GutendexBook } from './gutendex.types.js';

export interface GutendexClientOptions {
  baseUrl?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export class GutendexClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly cache = new Map<number, Promise<GutendexBook>>();

  constructor(options: GutendexClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? 'https://gutendex.com').replace(/\/$/u, '');
    this.timeoutMs = options.timeoutMs ?? 10000;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  getBook(id: number): Promise<GutendexBook> {
    if (!Number.isSafeInteger(id) || id <= 0) return Promise.reject(new GutendexError('Gutenberg ID must be a positive integer', id, 'invalid'));
    const cached = this.cache.get(id);
    if (cached) return cached;
    const request = this.request(id);
    this.cache.set(id, request);
    return request;
  }

  async getBooks(ids: number[], batchSize = 10): Promise<Map<number, GutendexBook>> {
    if (!Number.isSafeInteger(batchSize) || batchSize <= 0) throw new Error('Batch size must be a positive integer');
    const books = new Map<number, GutendexBook>();
    for (let index = 0; index < ids.length; index += batchSize) {
      const batch = ids.slice(index, index + batchSize);
      const results = await Promise.all(batch.map(async (id) => [id, await this.getBook(id)] as const));
      for (const [id, book] of results) books.set(id, book);
    }
    return books;
  }

  private async request(id: number): Promise<GutendexBook> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(`${this.baseUrl}/books/${id}`, { headers: { Accept: 'application/json' }, signal: controller.signal });
      if (!response.ok) throw new GutendexError(`Gutendex returned HTTP ${response.status}`, id, 'http', response.status);
      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        throw new GutendexError('Gutendex returned malformed JSON', id, 'malformed');
      }
      if (!isRecord(payload)) throw new GutendexError('Gutendex returned a malformed book response', id, 'malformed');
      return payload as GutendexBook;
    } catch (error: unknown) {
      if (error instanceof GutendexError) throw error;
      if (error instanceof Error && error.name === 'AbortError') throw new GutendexError('Gutendex request timed out', id, 'timeout');
      throw new GutendexError('Gutendex request failed', id, 'network');
    } finally {
      clearTimeout(timer);
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}