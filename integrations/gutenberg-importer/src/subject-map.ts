import { readFile } from 'node:fs/promises';

export type SubjectMap = Map<number, string[]>;

export const CONTROLLED_CATEGORIES = [
  'Psychology',
  'Engineering',
  'Computer Science',
  'Literature',
  'Photography',
  'Accounting',
  'Architecture',
  'Business & Economics',
  'History',
] as const;

const categoryByKey = new Map(CONTROLLED_CATEGORIES.map((category) => [category.toLowerCase(), category]));

export async function readSubjectMap(filePath: string): Promise<SubjectMap> {
  let contents: string;
  try {
    contents = await readFile(filePath, 'utf8');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'unknown file error';
    throw new Error(`Unable to read subject map "${filePath}": ${message}`);
  }
  return parseSubjectMap(contents, filePath);
}

export function parseSubjectMap(contents: string, source = 'subject map'): SubjectMap {
  let value: unknown;
  try {
    value = JSON.parse(contents) as unknown;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'invalid JSON';
    throw new Error(`Invalid subject map "${source}": malformed JSON (${message})`);
  }
  if (!isRecord(value) || Array.isArray(value)) throw new Error(`Invalid subject map "${source}": expected a JSON object keyed by Gutenberg ID`);

  const subjectMap: SubjectMap = new Map();
  for (const [key, rawSubjects] of Object.entries(value)) {
    const id = Number(key);
    if (!Number.isSafeInteger(id) || id <= 0) throw new Error(`Invalid subject map "${source}": key "${key}" must be a positive Gutenberg ID`);
    if (!Array.isArray(rawSubjects) || rawSubjects.length === 0) throw new Error(`Invalid subject map "${source}": value for ID ${key} must be a nonempty array of subject strings`);

    const subjects: string[] = [];
    const seen = new Set<string>();
    for (const rawSubject of rawSubjects) {
      if (typeof rawSubject !== 'string' || rawSubject.trim() === '') throw new Error(`Invalid subject map "${source}": subject for ID ${key} must be a nonempty string`);
      const subject = rawSubject.trim();
      const category = categoryByKey.get(subject.toLowerCase());
      if (!category) throw new Error(`Invalid subject map "${source}": unsupported category "${subject}" for ID ${key}`);
      const categoryKey = category.toLowerCase();
      if (!seen.has(categoryKey)) {
        seen.add(categoryKey);
        subjects.push(category);
      }
    }
    subjectMap.set(id, subjects);
  }
  return subjectMap;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}