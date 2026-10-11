import { ImportResult } from './importer.js';
import { DATE_MEANINGS } from './publication-map.js';
import { mapResources } from './resource-mapping.js';

export function toReport(ids: number[], result: ImportResult): object {
  return {
    schemaVersion: 1,
    ids,
    generatedRecords: result.records.length,
    duplicateIds: result.duplicateIds,
    errors: result.errors,
    curatedSubjects: result.curatedSubjects,
    books: result.books.map((book) => {
      const resources = mapResources(book.id, book.source);
      const dates = result.publicationDates[String(book.id)] ?? [];
      return { id: book.id, title: book.title, source: book.source, ...resources, publicationDates: dates,
        missingMetadata: [...(!resources.resources.some((resource) => resource.role === 'cover') ? ['cover'] : []),
          ...DATE_MEANINGS.filter((meaning) => !dates.some((date) => date.meaning === meaning))] };
    }),
  };
}
