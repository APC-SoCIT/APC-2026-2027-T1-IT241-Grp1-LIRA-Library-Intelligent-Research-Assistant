import { Element as XmlElement } from '@xmldom/xmldom';
import { EnrichmentMetadata } from './enrichment-metadata.js';
import { appendField, appendSubfield, fields, subfields, values } from './marc/marcxml-reader.js';
import { appendCategories } from './offline-categorize.js';
import { dateNote, editionDateCode } from './publication-map.js';
import { normalizeMime, resourceUrlKey, validatedSourceUrl } from './resource-mapping.js';
import { MarcField } from './marc/marc.types.js';

export interface ProposedChange { field: string; action: 'add-field' | 'add-subfield' | 'fill-fixed-date'; value: string; source: string; marcField?: MarcField }
export interface RecordEnrichment { element: XmlElement; proposedChanges: ProposedChange[]; conflicts: string[] }

export function enrichRecord(original: XmlElement, metadata: EnrichmentMetadata): RecordEnrichment {
  const element = original.cloneNode(true) as XmlElement;
  const proposedChanges: ProposedChange[] = [];
  const conflicts: string[] = [];
  for (const resource of metadata.resources) {
    const key = resourceUrlKey(resource.url);
    const matches = fields(element, '856').filter((field) => values(field, 'u').some((value) => urlKey(value) === key));
    if (matches.length === 0) {
      const generated = metadata.record.fields.find((field) => field.tag === '856' && field.subfields?.some((subfield) => subfield.code === 'u' && resourceUrlKey(subfield.value) === key));
      if (generated) {
        appendField(element, generated);
        proposedChanges.push({ field: '856', action: 'add-field', value: resource.url, source: resource.source, marcField: generated });
      }
      continue;
    }
    if (matches.length !== 1) { conflicts.push(`Multiple existing 856 fields for ${resource.url}; cannot safely annotate`); continue; }
    const field = matches[0];
    if (!field) continue;
    const urls = new Set(values(field, 'u').map(urlKey));
    if (urls.size !== 1 || urls.has(null)) { conflicts.push(`856 has multiple destinations for ${resource.url}; metadata association is ambiguous`); continue; }
    for (const [code, expected] of [['q', resource.mediaType], ['y', resource.label], ...(resource.role === 'cover' ? [['3', 'Cover image']] : [])]) {
      if (!code || !expected) continue;
      const existing = values(field, code);
      if (existing.length && existing.some((value) => (code === 'q' ? normalizeMime(value) : value.trim()) !== expected)) {
        conflicts.push(`Existing 856$${code} differs for ${resource.url}; preserved`);
        continue;
      }
      if (existing.length === 0) {
        appendSubfield(field, code, expected);
        proposedChanges.push({ field: `856$${code}`, action: 'add-subfield', value: expected, source: resource.source });
      }
    }
    if (resource.role === 'cover' && field.getAttribute('ind2') !== '2') conflicts.push(`Existing cover 856 relationship indicator differs for ${resource.url}; preserved`);
  }
  for (const category of appendCategories(element, metadata.categories)) proposedChanges.push({ field: '650 #4', action: 'add-field', value: category, source: 'Curated subjects in importer report' });
  enrichDates(element, metadata, proposedChanges, conflicts);
  if (fields(element, '035').every((field) => !values(field, 'a').some((value) => value.trim() === `(PG)${metadata.id}`))) {
    appendField(element, { tag: '035', ind1: ' ', ind2: ' ', subfields: [{ code: 'a', value: `(PG)${metadata.id}` }] });
    proposedChanges.push({ field: '035$a', action: 'add-field', value: `(PG)${metadata.id}`, source: 'Validated PG-prefixed 001 fallback' });
  }
  return { element: conflicts.length ? original : element, proposedChanges, conflicts };
}

function enrichDates(element: XmlElement, metadata: EnrichmentMetadata, changes: ProposedChange[], conflicts: string[]): void {
  const edition = metadata.dates.find((date) => date.meaning === 'edition-publication');
  if (edition) {
    const editionFields = [...fields(element, '260'), ...fields(element, '264').filter((field) => field.getAttribute('ind2') === '1')];
    const existingDates = editionFields.flatMap((field) => values(field, 'c')).filter((value) => value.trim());
    const fixed = fields(element, '008');
    const code = editionDateCode(edition.date);
    if (existingDates.some((value) => value.trim() !== edition.date)) conflicts.push('Existing 260/264 publication date differs in value or precision; preserved');
    if (fixed.length > 1 || fixed.some((field) => field.textContent?.length !== 40)) conflicts.push('Existing 008 is ambiguous or invalid; preserved');
    const fixedValue = fixed[0]?.textContent ?? '';
    const dateCode = fixedValue.slice(6, 15);
    const unknown = !fixedValue || /^[| ]{9}$/u.test(dateCode) || /^[n| ](?:[u| ]{4})(?:[u| ]{4})$/u.test(dateCode);
    if (!unknown && dateCode !== code) conflicts.push('Existing 008 dates differ in meaning, value, or precision; preserved');
    if (existingDates.length === 0) {
      if (editionFields.length > 1) conflicts.push('Multiple existing publication statements without dates; edition association is ambiguous');
      else if (editionFields[0]) {
        if (subfields(editionFields[0], 'c').length) conflicts.push('Existing empty publication date subfield requires manual review');
        else {
          appendSubfield(editionFields[0], 'c', edition.date);
          changes.push({ field: `${editionFields[0].getAttribute('tag')}$c`, action: 'add-subfield', value: edition.date, source: edition.source });
        }
      } else {
        appendField(element, { tag: '264', ind1: ' ', ind2: '1', subfields: [{ code: 'c', value: edition.date }] });
        changes.push({ field: '264 #1$c', action: 'add-field', value: edition.date, source: edition.source });
      }
    }
    if (unknown) {
      if (fixed[0]) fixed[0].textContent = fixedValue.slice(0, 6) + code + fixedValue.slice(15);
      else {
        const generated = metadata.record.fields.find((field) => field.tag === '008');
        if (generated) appendField(element, generated);
      }
      changes.push({ field: '008/06-14', action: 'fill-fixed-date', value: code, source: edition.source });
    }
  }
  for (const date of metadata.dates) {
    const note = dateNote(date);
    const existing = fields(element, '500').flatMap((field) => values(field, 'a'));
    const prefix = note.split(':', 1)[0] + ':';
    const sameMeaning = existing.filter((value) => value.startsWith(prefix));
    if (sameMeaning.some((value) => value !== note)) { conflicts.push(`Existing ${date.meaning} provenance note differs; preserved`); continue; }
    if (!sameMeaning.length) {
      appendField(element, { tag: '500', ind1: ' ', ind2: ' ', subfields: [{ code: 'a', value: note }] });
      changes.push({ field: '500$a', action: 'add-field', value: note, source: date.source });
    }
  }
}
function urlKey(value: string): string | null { const url = validatedSourceUrl(value); return url ? resourceUrlKey(url) : null; }
