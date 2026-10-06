import { GutendexError } from './gutendex.errors.js';
import { GutendexBook, NormalizedAuthor, NormalizedBook, NormalizedFormat } from './gutendex.types.js';

export function normalizeBook(value: unknown, requestedId?: number): NormalizedBook {
  if (!isRecord(value)) throw invalid(requestedId ?? 0, 'response is not an object');
  const id = positiveInteger(value.id, requestedId);
  if (requestedId !== undefined && id !== requestedId) throw invalid(requestedId, `response id is ${id}, expected ${requestedId}`);
  const title = requiredText(value.title, id, 'title');
  return {
    id,
    title,
    authors: normalizeAuthors(value.authors),
    subjects: normalizeTextList(value.subjects),
    languages: normalizeTextList(value.languages),
    summaries: normalizeTextList(value.summaries),
    formats: normalizeFormats(value.formats),
    bookshelves: normalizeTextList(value.bookshelves),
    copyright: typeof value.copyright === 'boolean' ? value.copyright : null,
    mediaType: optionalText(value.media_type),
    source: value as GutendexBook,
  };
}

function normalizeAuthors(value: unknown): NormalizedAuthor[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((author): NormalizedAuthor[] => {
    if (!isRecord(author)) return [];
    const name = optionalText(author.name);
    return name === null ? [] : [{ name, birthYear: integerOrNull(author.birth_year), deathYear: integerOrNull(author.death_year) }];
  });
}

function normalizeFormats(value: unknown): NormalizedFormat[] {
  if (!isRecord(value)) return [];
  return Object.entries(value).flatMap(([mediaType, url]) => {
    if (typeof url !== 'string' || !/^https?:\/\//iu.test(url.trim())) return [];
    return [{ mediaType: normalizeText(mediaType), url: url.trim() }];
  });
}

function normalizeTextList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const text = optionalText(item);
    return text === null ? [] : [text];
  });
}

function requiredText(value: unknown, id: number, field: string): string {
  const text = optionalText(value);
  if (text === null) throw invalid(id, `missing required ${field}`);
  return text;
}

function optionalText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? normalizeText(value) : null;
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/gu, ' ');
}

function positiveInteger(value: unknown, fallback?: number): number {
  const candidate = value ?? fallback;
  if (typeof candidate !== 'number' || !Number.isSafeInteger(candidate) || candidate <= 0) throw invalid(fallback ?? 0, 'id must be a positive integer');
  return candidate;
}

function integerOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function invalid(id: number, message: string): GutendexError {
  return new GutendexError(`Invalid Gutendex record: ${message}`, id, 'invalid');
}