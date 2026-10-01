import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { DOMParser, Element as XmlElement, XMLSerializer } from '@xmldom/xmldom';
import { MARC_NAMESPACE } from './marc/marcxml-writer.js';
import { validateMarcXml } from './marc/validate-marcxml.js';
import { readSubjectMap } from './subject-map.js';

export interface CategorizeOptions {
  inputPaths: string[];
  subjectMapPath: string;
  outputPath: string;
  reportPath: string;
}

export interface OfflineAuditReport {
  inputFiles: string[];
  inputRecordCount: number;
  uniqueOutputRecordCount: number;
  duplicateGutenbergIds: number[];
  conflictingDuplicateIds: number[];
  unmappedIds: number[];
  unusedMappingIds: number[];
  appliedCategories: Record<string, string[]>;
  addedCategories: Record<string, string[]>;
  categoryTotals: Record<string, number>;
  errors: string[];
}

interface LoadedRecord {
  id: number;
  element: XmlElement;
  signature: string;
}

export async function categorizeMarcXmlFiles(options: CategorizeOptions): Promise<OfflineAuditReport> {
  const subjectMap = await readSubjectMap(resolve(options.subjectMapPath));
  const inputPaths = options.inputPaths.map((inputPath) => resolve(inputPath));
  const outputPath = resolve(options.outputPath);
  if (inputPaths.includes(outputPath)) throw new Error('Output path must differ from every input MARCXML path');
  const loadedRecords: LoadedRecord[] = [];
  for (const inputPath of inputPaths) loadedRecords.push(...await readRecords(inputPath));

  const recordsById = new Map<number, LoadedRecord>();
  const duplicateIds = new Set<number>();
  const conflictingIds = new Set<number>();
  const errors: string[] = [];
  for (const record of loadedRecords) {
    const existing = recordsById.get(record.id);
    if (!existing) {
      recordsById.set(record.id, record);
      continue;
    }
    duplicateIds.add(record.id);
    if (existing.signature !== record.signature) conflictingIds.add(record.id);
  }

  const uniqueIds = [...recordsById.keys()].sort((left, right) => left - right);
  const unmappedIds = uniqueIds.filter((id) => !subjectMap.has(id));
  const unusedMappingIds = [...subjectMap.keys()].filter((id) => !recordsById.has(id)).sort((left, right) => left - right);
  if (conflictingIds.size > 0) errors.push(`Conflicting duplicate Gutenberg records: ${formatIds(conflictingIds)}`);
  if (unmappedIds.length > 0) errors.push(`Missing subject mappings for Gutenberg IDs: ${formatIds(unmappedIds)}`);
  const initialReport: OfflineAuditReport = {
    inputFiles: inputPaths,
    inputRecordCount: loadedRecords.length,
    uniqueOutputRecordCount: uniqueIds.length,
    duplicateGutenbergIds: [...duplicateIds].sort((left, right) => left - right),
    conflictingDuplicateIds: [...conflictingIds].sort((left, right) => left - right),
    unmappedIds,
    unusedMappingIds,
    appliedCategories: {},
    addedCategories: {},
    categoryTotals: {},
    errors,
  };
  if (errors.length > 0) {
    await mkdir(dirname(resolve(options.reportPath)), { recursive: true });
    await writeFile(resolve(options.reportPath), JSON.stringify(initialReport, null, 2), 'utf8');
    throw new Error(errors.join('; '));
  }

  const appliedCategories: Record<string, string[]> = {};
  const addedCategories: Record<string, string[]> = {};
  const categoryTotals: Record<string, number> = {};
  for (const id of uniqueIds) {
    const record = recordsById.get(id);
    const categories = subjectMap.get(id) ?? [];
    if (!record) continue;
    const added = appendCategories(record.element, categories);
    appliedCategories[String(id)] = categories;
    addedCategories[String(id)] = added;
    for (const category of categories) categoryTotals[category] = (categoryTotals[category] ?? 0) + 1;
  }

  const xml = serializeRecords(uniqueIds.map((id) => recordsById.get(id)?.element).filter((record): record is XmlElement => record !== undefined));
  validateMarcXml(xml, uniqueIds.length);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, xml, 'utf8');
  const report: OfflineAuditReport = {
    inputFiles: inputPaths,
    inputRecordCount: loadedRecords.length,
    uniqueOutputRecordCount: uniqueIds.length,
    duplicateGutenbergIds: [...duplicateIds].sort((left, right) => left - right),
    conflictingDuplicateIds: [...conflictingIds].sort((left, right) => left - right),
    unmappedIds,
    unusedMappingIds,
    appliedCategories,
    addedCategories,
    categoryTotals,
    errors,
  };
  await writeFile(resolve(options.reportPath), JSON.stringify(report, null, 2), 'utf8');
  return report;
}

async function readRecords(filePath: string): Promise<LoadedRecord[]> {
  const xml = await readFile(filePath, 'utf8');
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  const collection = document.documentElement;
  if (!collection || collection.localName !== 'collection' || collection.namespaceURI !== MARC_NAMESPACE) throw new Error(`Invalid MARCXML collection in ${filePath}`);
  return Array.from(collection.getElementsByTagNameNS(MARC_NAMESPACE, 'record')).map((record) => ({
    id: readGutenbergId(record, filePath),
    element: record,
    signature: recordSignature(record),
  }));
}

function readGutenbergId(record: XmlElement, filePath: string): number {
  const control001 = findField(record, '001');
  const matching035 = findField(record, '035');
  const id001 = parseIdentifier(control001?.textContent?.trim(), /^PG(\d+)$/u, '001', filePath);
  const id035 = parseIdentifier(findSubfield(matching035, 'a'), /^\(PG\)(\d+)$/u, '035$a', filePath);
  if (id001 === undefined && id035 === undefined) throw new Error(`MARCXML record in ${filePath} lacks a Gutenberg 001 or 035$a identifier`);
  if (id001 !== undefined && id035 !== undefined && id001 !== id035) throw new Error(`MARCXML record in ${filePath} has conflicting 001 and 035$a identifiers`);
  return id001 ?? id035 ?? 0;
}

function parseIdentifier(value: string | undefined, pattern: RegExp, label: string, filePath: string): number | undefined {
  if (value === undefined) return undefined;
  const match = value?.match(pattern);
  if (!match?.[1]) throw new Error(`MARCXML record in ${filePath} has an invalid ${label} Gutenberg identifier "${value}"`);
  const id = Number(match[1]);
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error(`Invalid Gutenberg identifier "${value}"`);
  return id;
}

function findField(record: XmlElement, tag: string): XmlElement | undefined {
  return Array.from(record.getElementsByTagNameNS(MARC_NAMESPACE, 'controlfield')).find((field) => field.getAttribute('tag') === tag)
    ?? Array.from(record.getElementsByTagNameNS(MARC_NAMESPACE, 'datafield')).find((field) => field.getAttribute('tag') === tag);
}

function findSubfield(field: XmlElement | undefined, code: string): string | undefined {
  return field ? Array.from(field.getElementsByTagNameNS(MARC_NAMESPACE, 'subfield')).find((subfield) => subfield.getAttribute('code') === code)?.textContent?.trim() : undefined;
}

function appendCategories(record: XmlElement, categories: string[]): string[] {
  const existingSubjects = Array.from(record.getElementsByTagNameNS(MARC_NAMESPACE, 'datafield'))
    .filter((field) => field.getAttribute('tag') === '650' && field.getAttribute('ind2') === '4')
    .map((field) => findSubfield(field, 'a')?.toLowerCase())
    .filter((subject): subject is string => subject !== undefined);
  const seen = new Set(existingSubjects);
  const applied: string[] = [];
  const document = record.ownerDocument;
  if (!document) throw new Error('MARCXML record has no owner document');
  for (const category of categories) {
    const key = category.trim().toLowerCase();
    if (seen.has(key)) continue;
    const field = document.createElementNS(MARC_NAMESPACE, 'datafield');
    field.setAttribute('tag', '650');
    field.setAttribute('ind1', ' ');
    field.setAttribute('ind2', '4');
    const subfield = document.createElementNS(MARC_NAMESPACE, 'subfield');
    subfield.setAttribute('code', 'a');
    subfield.appendChild(document.createTextNode(category.trim()));
    field.appendChild(subfield);
    record.appendChild(field);
    seen.add(key);
    applied.push(category.trim());
  }
  return applied;
}

function serializeRecords(records: XmlElement[]): string {
  const serializer = new XMLSerializer();
  return `<?xml version="1.0" encoding="UTF-8"?>\n<collection xmlns="${MARC_NAMESPACE}">${records.map((record) => serializer.serializeToString(record)).join('')}</collection>`;
}

function recordSignature(record: XmlElement): string {
  return elementSignature(record, true);
}

function elementSignature(element: XmlElement, isRecord = false): string {
  const attributes = Array.from({ length: element.attributes.length }, (_, index) => element.attributes.item(index))
    .filter((attribute): attribute is NonNullable<typeof attribute> => attribute !== null)
    .filter((attribute) => !isRecord || attribute.name !== 'xmlns')
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((attribute) => `${attribute.name}=${JSON.stringify(attribute.value)}`)
    .join('|');
  const children = Array.from(element.childNodes).map((child) => {
    if (child.nodeType === 1) {
      const childElement = child as XmlElement;
      if (isRecord && childElement.localName === 'datafield' && childElement.getAttribute('tag') === '650' && childElement.getAttribute('ind2') === '4') return '';
      return elementSignature(childElement);
    }
    return child.nodeType === 3 ? JSON.stringify(child.nodeValue?.replace(/\s+/gu, ' ').trim()) : '';
  }).join('');
  return `<${element.localName}|${attributes}>${children}</${element.localName}>`;
}

function formatIds(ids: Iterable<number>): string {
  return [...ids].sort((left, right) => left - right).map((id) => `PG${id}`).join(', ');
}

