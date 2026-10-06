import { ImportResult } from './importer.js';

export function toReport(ids: number[], result: ImportResult): object {
  return {
    ids,
    generatedRecords: result.records.length,
    duplicateIds: result.duplicateIds,
    errors: result.errors,
    curatedSubjects: result.curatedSubjects,
    books: result.books.map((book) => ({ id: book.id, title: book.title, source: book.source })),
  };
}