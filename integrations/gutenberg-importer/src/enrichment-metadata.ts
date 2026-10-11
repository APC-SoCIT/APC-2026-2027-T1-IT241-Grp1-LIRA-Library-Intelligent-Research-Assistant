import { readFile } from 'node:fs/promises';
import { normalizeBook } from './gutendex/normalize-book.js';
import { toMarcRecord, MarcRecord } from './marc/marc.types.js';
import { PublicationDate, validatePublicationDates } from './publication-map.js';
import { mapResources, SourceResource } from './resource-mapping.js';
import { parseSubjectMap } from './subject-map.js';

export interface EnrichmentMetadata {
  id: number;
  resources: SourceResource[];
  dates: PublicationDate[];
  categories: string[];
  record: MarcRecord;
  signature: string;
}
export async function readEnrichmentMetadata(path: string): Promise<EnrichmentMetadata[]> {
  const root: unknown = JSON.parse(await readFile(path, 'utf8'));
  if (!object(root) || root.schemaVersion !== 1 || !Array.isArray(root.books) || !object(root.curatedSubjects)) throw new Error('Enrichment requires a schemaVersion: 1 importer report with books and curatedSubjects');
  return root.books.map((raw: unknown) => {
    if (!object(raw) || !Number.isSafeInteger(raw.id) || Number(raw.id) <= 0) throw new Error('Invalid book ID in enrichment report');
    const id = Number(raw.id);
    const book = normalizeBook(raw.source, id);
    if (!Array.isArray(raw.publicationDates)) throw new Error(`Missing publicationDates in enrichment report for PG${id}`);
    const dates = raw.publicationDates.length ? validatePublicationDates(raw.publicationDates) : [];
    const rawCategories = (root.curatedSubjects as Record<string, unknown>)[String(id)];
    if (!Array.isArray(rawCategories)) throw new Error(`Missing curatedSubjects in enrichment report for PG${id}`);
    const categories = rawCategories.length ? parseSubjectMap(JSON.stringify({ [id]: rawCategories })).get(id) ?? [] : [];
    const resources = mapResources(id, book.source).resources;
    const record = toMarcRecord(book, categories, dates);
    return { id, resources, dates, categories, record, signature: JSON.stringify(record) };
  });
}
function object(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value); }
