import { NormalizedBook } from '../gutendex/gutendex.types.js';

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

export function toMarcRecord(book: NormalizedBook): MarcRecord {
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
    for (const format of selectResourceFormats(book.formats)) fields.push({ tag: '856', ind1: '4', ind2: '0', subfields: [{ code: 'u', value: format.url }] });
  return { leader: '00000nam a2200000 i 4500', fields };
}

  function selectResourceFormats(formats: NormalizedBook['formats']): NormalizedBook['formats'] {
    const html = formats.find((format) => format.mediaType.toLowerCase().split(';', 1)[0] === 'text/html');
    const plainText = formats.find((format) => format.mediaType.toLowerCase().split(';', 1)[0] === 'text/plain');
    return [html, plainText].filter((format): format is NormalizedBook['formats'][number] => format !== undefined);
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