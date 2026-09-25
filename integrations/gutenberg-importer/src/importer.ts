import { GutendexClient } from './gutendex/gutendex.client.js';
import { normalizeBook } from './gutendex/normalize-book.js';
import { GutendexError } from './gutendex/gutendex.errors.js';
import { NormalizedBook } from './gutendex/gutendex.types.js';
import { toMarcRecord, MarcRecord } from './marc/marc.types.js';

export interface ImportError {
  id: number;
  message: string;
  kind: string;
}

export interface ImportResult {
  books: NormalizedBook[];
  records: MarcRecord[];
  errors: ImportError[];
  duplicateIds: number[];
}

export class GutenbergImporter {
  constructor(private readonly client: GutendexClient) {}

  async import(ids: number[], batchSize: number): Promise<ImportResult> {
    const duplicateIds = findDuplicates(ids);
    const uniqueIds = [...new Set(ids)];
    const books: NormalizedBook[] = [];
    const errors: ImportError[] = duplicateIds.map((id) => ({ id, message: 'Duplicate Gutenberg ID in batch; generated once', kind: 'duplicate' }));

    for (let index = 0; index < uniqueIds.length; index += batchSize) {
      const batch = uniqueIds.slice(index, index + batchSize);
      const results = await Promise.allSettled(batch.map((id) => this.client.getBook(id)));
      for (let resultIndex = 0; resultIndex < results.length; resultIndex += 1) {
        const id = batch[resultIndex];
        const result = results[resultIndex];
        if (!id || !result) continue;
        if (result.status === 'rejected') {
          errors.push(toImportError(id, result.reason));
          continue;
        }
        try {
          books.push(normalizeBook(result.value, id));
        } catch (error: unknown) {
          errors.push(toImportError(id, error));
        }
      }
    }
    return { books, records: books.map(toMarcRecord), errors, duplicateIds };
  }
}

function findDuplicates(ids: number[]): number[] {
  const seen = new Set<number>();
  const duplicates = new Set<number>();
  for (const id of ids) {
    if (seen.has(id)) duplicates.add(id);
    seen.add(id);
  }
  return [...duplicates];
}

function toImportError(id: number, error: unknown): ImportError {
  if (error instanceof GutendexError) return { id, message: error.message, kind: error.kind };
  return { id, message: error instanceof Error ? error.message : 'Unknown importer error', kind: 'unknown' };
}