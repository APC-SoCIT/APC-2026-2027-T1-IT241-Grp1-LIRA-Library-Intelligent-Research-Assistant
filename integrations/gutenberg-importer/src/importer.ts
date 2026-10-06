import { GutendexClient } from './gutendex/gutendex.client.js';
import { normalizeBook } from './gutendex/normalize-book.js';
import { GutendexError } from './gutendex/gutendex.errors.js';
import { NormalizedBook } from './gutendex/gutendex.types.js';
import { curatedSubjectsForRecord, toMarcRecord, MarcRecord } from './marc/marc.types.js';
import { SubjectMap } from './subject-map.js';

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
  curatedSubjects: Record<string, string[]>;
}

export class GutenbergImporter {
  constructor(private readonly client: GutendexClient, private readonly subjectMap: SubjectMap = new Map()) {}

  async import(ids: number[], batchSize: number): Promise<ImportResult> {
    const duplicateIds = findDuplicates(ids);
    const uniqueIds = [...new Set(ids)];
    const books: NormalizedBook[] = [];
    const errors: ImportError[] = duplicateIds.map((id) => ({ id, message: 'Duplicate Gutenberg ID in batch; generated once', kind: 'duplicate' }));
    const curatedSubjects: Record<string, string[]> = {};

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
          const book = normalizeBook(result.value, id);
          curatedSubjects[String(id)] = curatedSubjectsForRecord(this.subjectMap.get(id) ?? []);
          books.push(book);
        } catch (error: unknown) {
          errors.push(toImportError(id, error));
        }
      }
    }
    return {
      books,
      records: books.map((book) => toMarcRecord(book, curatedSubjects[String(book.id)] ?? [])),
      errors,
      duplicateIds,
      curatedSubjects,
    };
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