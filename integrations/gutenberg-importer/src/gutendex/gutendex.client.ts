import { GutendexError } from './gutendex.errors.js';
import { GutendexBook } from './gutendex.types.js';

export interface GutendexClientOptions {
  baseUrl?: string;
  timeoutMs?: number;
  maxAttempts?: number;
  retryInitialDelayMs?: number;
  retryMaxDelayMs?: number;
  fetchImpl?: typeof fetch;
  sleepImpl?: (delayMs: number) => Promise<void>;
  randomImpl?: () => number;
}

export class GutendexClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly maxAttempts: number;
  private readonly retryInitialDelayMs: number;
  private readonly retryMaxDelayMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly sleepImpl: (delayMs: number) => Promise<void>;
  private readonly randomImpl: () => number;
  private readonly cache = new Map<number, Promise<GutendexBook>>();

  constructor(options: GutendexClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? 'https://gutendex.com').replace(/\/$/u, '');
    this.timeoutMs = options.timeoutMs ?? 30000;
    this.maxAttempts = options.maxAttempts ?? 3;
    this.retryInitialDelayMs = options.retryInitialDelayMs ?? 250;
    this.retryMaxDelayMs = options.retryMaxDelayMs ?? 2000;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.sleepImpl = options.sleepImpl ?? ((delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs)));
    this.randomImpl = options.randomImpl ?? Math.random;
  }

  getBook(id: number): Promise<GutendexBook> {
    if (!Number.isSafeInteger(id) || id <= 0) return Promise.reject(new GutendexError('Gutenberg ID must be a positive integer', id, 'invalid'));
    const cached = this.cache.get(id);
    if (cached) return cached;
    const request = this.requestWithRetries(id);
    this.cache.set(id, request);
    void request.catch(() => {
      if (this.cache.get(id) === request) this.cache.delete(id);
    });
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

  private async requestWithRetries(id: number): Promise<GutendexBook> {
    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      try {
        return await this.requestOnce(id);
      } catch (error: unknown) {
        if (!(error instanceof GutendexError) || !this.isRetryable(error) || attempt === this.maxAttempts) throw error;
        await this.sleepImpl(this.retryDelay(attempt, error.retryAfterMs));
      }
    }
    throw new Error('Gutendex request attempts exhausted');
  }

  private async requestOnce(id: number): Promise<GutendexBook> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(`${this.baseUrl}/books/${id}`, { headers: { Accept: 'application/json' }, signal: controller.signal });
      if (!response.ok) throw new GutendexError(`Gutendex returned HTTP ${response.status}`, id, 'http', response.status, this.retryAfterMs(response.headers.get('retry-after')));
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

  private isRetryable(error: GutendexError): boolean {
    return error.kind === 'timeout' || error.kind === 'network' || (error.kind === 'http' && (error.status === 429 || [500, 502, 503, 504].includes(error.status ?? 0)));
  }

  private retryDelay(attempt: number, retryAfterMs?: number): number {
    if (retryAfterMs !== undefined) return Math.min(this.retryMaxDelayMs, retryAfterMs);
    const exponential = Math.min(this.retryMaxDelayMs, this.retryInitialDelayMs * 2 ** (attempt - 1));
    return Math.min(this.retryMaxDelayMs, exponential + Math.floor(exponential * 0.25 * this.randomImpl()));
  }

  private retryAfterMs(value: string | null): number | undefined {
    if (!value) return undefined;
    const seconds = Number(value);
    if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
    const timestamp = Date.parse(value);
    return Number.isNaN(timestamp) ? undefined : Math.max(0, timestamp - Date.now());
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}