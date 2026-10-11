import { NormalizedBook } from '../gutendex/gutendex.types.js';
import { mapResources } from '../resource-mapping.js';
import { dateNote, editionDateCode, PublicationDate } from '../publication-map.js';

export interface MarcSubfield {
  code: string;
  value: string;
}

export interface MarcField {
  tag: string;
  value?: string;
  ind1?: string;
  ind2?: string;
  subfields?: MarcSubfield[];
}

export interface MarcRecord {
  leader: string;
  fields: MarcField[];
}

export function toMarcRecord(book: NormalizedBook, curatedSubjects: string[] = [], dates: PublicationDate[] = []): MarcRecord {
  const [primaryAuthor, ...additionalAuthors] = book.authors;
  const fields: MarcField[] = [
    { tag: '001', value: `PG${book.id}` },
    { tag: '035', ind1: ' ', ind2: ' ', subfields: [{ code: 'a', value: `(PG)${book.id}` }] },
    { tag: '245', ind1: primaryAuthor ? '1' : '0', ind2: nonFilingCharacterCount(book.title), subfields: [{ code: 'a', value: book.title }] },
  ];
  if (primaryAuthor) fields.splice(2, 0, { tag: '100', ind1: '1', ind2: ' ', subfields: [{ code: 'a', value: primaryAuthor.name }] });
  for (const author of additionalAuthors) fields.push({ tag: '700', ind1: ' ', ind2: ' ', subfields: [{ code: 'a', value: author.name }] });
  for (const language of book.languages) fields.push({ tag: '041', ind1: ' ', ind2: ' ', subfields: [{ code: 'a', value: marcLanguageCode(language) }] });
  for (const summary of book.summaries) fields.push({ tag: '520', ind1: ' ', ind2: ' ', subfields: [{ code: 'a', value: summary }] });
  for (const subject of book.subjects) fields.push({ tag: '650', ind1: ' ', ind2: '0', subfields: [{ code: 'a', value: subject }] });
  for (const subject of curatedSubjectsForRecord(curatedSubjects)) fields.push({ tag: '650', ind1: ' ', ind2: '4', subfields: [{ code: 'a', value: subject }] });
  for (const resource of mapResources(book.id, book.source).resources) fields.push({
    tag: '856', ind1: '4', ind2: resource.role === 'cover' ? '2' : '0', subfields: [
      ...(resource.role === 'cover' ? [{ code: '3', value: 'Cover image' }] : []),
      { code: 'u', value: resource.url }, { code: 'q', value: resource.mediaType }, { code: 'y', value: resource.label },
    ],
  });
  const edition = dates.find((date) => date.meaning === 'edition-publication');
  if (edition) {
    fields.splice(1, 0, { tag: '008', value: '||||||' + editionDateCode(edition.date) + 'xx ' + '|'.repeat(17) + '||| d' });
    fields.push({ tag: '264', ind1: ' ', ind2: '1', subfields: [{ code: 'c', value: edition.date }] });
  }
  for (const date of dates) fields.push({ tag: '500', ind1: ' ', ind2: ' ', subfields: [{ code: 'a', value: dateNote(date) }] });
  return { leader: '00000nam a2200000 i 4500', fields };
}

export function curatedSubjectsForRecord(curatedSubjects: string[]): string[] {
  const seen = new Set<string>();
  return curatedSubjects.flatMap((subject) => {
    const normalized = subject.trim();
    const key = normalized.toLowerCase();
    if (seen.has(key)) return [];
    seen.add(key);
    return [normalized];
  });
}

function nonFilingCharacterCount(title: string): string {
  if (/^the\s/iu.test(title)) return '4';
  if (/^(an|the)\s/iu.test(title)) return '3';
  if (/^a\s/iu.test(title)) return '2';
  return '0';
}

function marcLanguageCode(language: string): string {
  const codes: Record<string, string> = { ar: 'ara', zh: 'chi', de: 'ger', el: 'gre', en: 'eng', es: 'spa', fr: 'fre', it: 'ita', ja: 'jpn', la: 'lat', nl: 'dut', pt: 'por', ru: 'rus' };
  return codes[language.toLowerCase()] ?? language;
}
