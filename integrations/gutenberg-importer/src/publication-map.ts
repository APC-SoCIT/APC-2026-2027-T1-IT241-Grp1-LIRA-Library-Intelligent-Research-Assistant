import { readFile } from 'node:fs/promises';
import { validatedSourceUrl } from './resource-mapping.js';

export const DATE_MEANINGS = ['edition-publication', 'original-work-publication', 'gutenberg-release', 'gutenberg-update'] as const;
export type DateMeaning = typeof DATE_MEANINGS[number];
export interface PublicationDate {
  meaning: DateMeaning;
  date: string;
  source: string;
  edition?: string;
}
export type PublicationMap = Map<number, PublicationDate[]>;

export async function readPublicationMap(path: string): Promise<PublicationMap> {
  return parsePublicationMap(await readFile(path, 'utf8'));
}
export function parsePublicationMap(contents: string): PublicationMap {
  const root: unknown = JSON.parse(contents);
  if (!isObject(root) || root.version !== 1 || !isObject(root.books)) throw new Error('Publication map requires version: 1 and a books object');
  rejectUnknown(root, ['version', 'books']);
  const map: PublicationMap = new Map();
  for (const [key, book] of Object.entries(root.books)) {
    const id = Number(key);
    if (!/^[1-9]\d*$/u.test(key) || !Number.isSafeInteger(id)) throw new Error(`Invalid publication-map Gutenberg ID: ${key}`);
    if (!isObject(book)) throw new Error(`Publication metadata for ${key} must contain dates`);
    rejectUnknown(book, ['dates']);
    map.set(id, validatePublicationDates(book.dates));
  }
  return map;
}
export function validatePublicationDates(value: unknown): PublicationDate[] {
  if (!Array.isArray(value) || value.length === 0) throw new Error('Publication dates must be a nonempty array');
  const meanings = new Set<string>();
  const dates = value.map((raw: unknown) => {
    if (!isObject(raw)) throw new Error('Each publication date must be an object');
    rejectUnknown(raw, ['meaning', 'date', 'source', 'edition']);
    if (!DATE_MEANINGS.includes(raw.meaning as DateMeaning)) throw new Error('Unsupported publication date meaning');
    const meaning = raw.meaning as DateMeaning;
    if (meanings.has(meaning)) throw new Error(`Duplicate or conflicting publication date meaning: ${meaning}`);
    meanings.add(meaning);
    if (typeof raw.date !== 'string' || !validDate(raw.date)) throw new Error('Publication date must be an exact YYYY, YYYY-MM, or YYYY-MM-DD date (CE 0001–9999)');
    const source = validatedSourceUrl(raw.source);
    if (!source) throw new Error('Publication date requires a valid HTTP(S) source reference without credentials');
    if (raw.edition !== undefined && (typeof raw.edition !== 'string' || !raw.edition.trim())) throw new Error('Edition description must be a nonempty string');
    if (meaning === 'edition-publication' && (typeof raw.edition !== 'string' || !raw.edition.trim())) throw new Error('Edition publication requires identification of the cataloged edition');
    if (meaning !== 'edition-publication' && raw.edition !== undefined) throw new Error('Edition description applies only to edition-publication');
    return { meaning, date: raw.date, source, ...(meaning === 'edition-publication' ? { edition: (raw.edition as string).trim() } : {}) };
  }).sort((a, b) => DATE_MEANINGS.indexOf(a.meaning) - DATE_MEANINGS.indexOf(b.meaning));
  for (const [earlier, later] of [['original-work-publication', 'edition-publication'], ['gutenberg-release', 'gutenberg-update']]) {
    const first = dates.find((date) => date.meaning === earlier);
    const second = dates.find((date) => date.meaning === later);
    // Compare only nonoverlapping precision ranges; do not invent finer dates.
    if (first && second && lowerBound(first.date) > upperBound(second.date)) {
      throw new Error(`Conflicting date chronology: ${earlier} is later than ${later}`);
    }
  }
  return dates;
}
export function editionDateCode(date: string): string {
  const [year, month, day] = date.split('-');
  return month ? `e${year}${month}${day ?? '  '}` : `s${year}    `;
}
export function dateNote(date: PublicationDate): string {
  const label: Record<DateMeaning, string> = {
    'edition-publication': 'Cataloged edition publication', 'original-work-publication': 'Original work publication',
    'gutenberg-release': 'Project Gutenberg release', 'gutenberg-update': 'Project Gutenberg update',
  };
  return `${label[date.meaning]}: ${date.date}${date.edition ? ` (${date.edition})` : ''}. Source: ${date.source}`;
}
function validDate(value: string): boolean {
  if (!/^(?!0000)\d{4}(?:-(?:0[1-9]|1[0-2])(?:-(?:0[1-9]|[12]\d|3[01]))?)?$/u.test(value)) return false;
  const [year = '', month, day] = value.split('-');
  if (!day || !month) return true;
  const leap = Number(year) % 4 === 0 && (Number(year) % 100 !== 0 || Number(year) % 400 === 0);
  const max = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][Number(month) - 1] ?? 0;
  return Number(day) <= max;
}
// Internal bounds for validation only; the recorded precision is never changed.
function lowerBound(date: string): string { return date.length === 4 ? `${date}-01-01` : date.length === 7 ? `${date}-01` : date; }
function upperBound(date: string): string { return date.length === 4 ? `${date}-12-31` : date.length === 7 ? `${date}-31` : date; }
function isObject(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function rejectUnknown(value: Record<string, unknown>, allowed: string[]): void {
  for (const key of Object.keys(value)) if (!allowed.includes(key)) throw new Error(`Unknown publication metadata property: ${key}`);
}
