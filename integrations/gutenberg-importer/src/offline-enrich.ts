import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Element as XmlElement } from '@xmldom/xmldom';
import { readEnrichmentMetadata, EnrichmentMetadata } from './enrichment-metadata.js';
import { enrichRecord, ProposedChange } from './enrich-record.js';
import { fields, parseMarcXml, recordSignature, serializeRecords, values } from './marc/marcxml-reader.js';
import { checkNewOutputs, writeNewOutput } from './output-files.js';

export interface EnrichOptions { inputPaths: string[]; metadataPaths: string[]; outputPath: string; reportPath: string }
export interface EnrichmentAuditEntry {
  inputFile: string;
  recordNumber: number;
  koha001: string | null;
  gutenbergId: number | null;
  matchMethod: '035$a' | '001-fallback' | null;
  matched: boolean;
  status: 'enriched' | 'unchanged' | 'unmatched' | 'conflicting';
  proposedChanges: ProposedChange[];
  appliedChanges: ProposedChange[];
  conflicts: string[];
}
export interface EnrichmentAudit {
  inputFiles: string[];
  metadataFiles: string[];
  outputFile: string;
  inputRecordCount: number;
  outputRecordCount: number;
  counts: { matched: number; unmatched: number; enriched: number; unchanged: number; conflicting: number };
  duplicateExports: { inputFile: string; recordNumber: number; gutenbergId: number | null }[];
  duplicateMetadataIds: number[];
  unmatchedMetadataIds: number[];
  conflictingMetadataIds: number[];
  records: EnrichmentAuditEntry[];
  errors: string[];
}
interface ExportRecord { element: XmlElement; signature: string; audit: EnrichmentAuditEntry }

export async function enrichMarcXmlFiles(options: EnrichOptions): Promise<EnrichmentAudit> {
  const inputFiles = options.inputPaths.map((path) => resolve(path));
  const metadataFiles = options.metadataPaths.map((path) => resolve(path));
  const outputFile = resolve(options.outputPath);
  const reportFile = resolve(options.reportPath);
  if (!inputFiles.length || !metadataFiles.length) throw new Error('Enrichment requires exported MARCXML and importer metadata reports');
  await checkNewOutputs([outputFile, reportFile]);
  const report: EnrichmentAudit = {
    inputFiles, metadataFiles, outputFile, inputRecordCount: 0, outputRecordCount: 0,
    counts: { matched: 0, unmatched: 0, enriched: 0, unchanged: 0, conflicting: 0 },
    duplicateExports: [], duplicateMetadataIds: [], unmatchedMetadataIds: [], conflictingMetadataIds: [], records: [], errors: [],
  };
  const metadata = new Map<number, EnrichmentMetadata>();
  const loaded: ExportRecord[] = [];
  try {
    for (const path of metadataFiles) for (const item of await readEnrichmentMetadata(path)) {
      const previous = metadata.get(item.id);
      if (previous) {
        if (!report.duplicateMetadataIds.includes(item.id)) report.duplicateMetadataIds.push(item.id);
        if (item.signature !== previous.signature && !report.conflictingMetadataIds.includes(item.id)) report.conflictingMetadataIds.push(item.id);
      } else metadata.set(item.id, item);
    }
    for (const path of inputFiles) {
      const records = parseMarcXml(await readFile(path, 'utf8'), path);
      for (const [index, element] of records.entries()) {
        report.inputRecordCount += 1;
        const audit: EnrichmentAuditEntry = {
          inputFile: path, recordNumber: index + 1, koha001: fields(element, '001')[0]?.textContent ?? null,
          gutenbergId: null, matchMethod: null, matched: false, status: 'unmatched', proposedChanges: [], appliedChanges: [], conflicts: [],
        };
        try { const identifier = gutenbergIdentifier(element); audit.gutenbergId = identifier.id; audit.matchMethod = identifier.method; }
        catch (error: unknown) { audit.status = 'conflicting'; audit.conflicts.push(error instanceof Error ? error.message : 'Invalid identifiers'); }
        loaded.push({ element, signature: recordSignature(element), audit });
      }
    }
  } catch (error: unknown) {
    report.errors.push(error instanceof Error ? error.message : 'Invalid enrichment input');
    await writeNewOutput(reportFile, JSON.stringify(report, null, 2));
    throw error;
  }

  const unique: ExportRecord[] = [];
  const seen = new Map<string, ExportRecord>();
  for (const record of loaded) {
    const existing = seen.get(record.signature);
    if (existing) report.duplicateExports.push({ inputFile: record.audit.inputFile, recordNumber: record.audit.recordNumber, gutenbergId: record.audit.gutenbergId });
    else { seen.set(record.signature, record); unique.push(record); }
  }
  // A Gutenberg ID must resolve to one entire exported record, including Koha identity.
  const groups = new Map<number, ExportRecord[]>();
  for (const record of unique) if (record.audit.gutenbergId !== null) {
    const group = groups.get(record.audit.gutenbergId) ?? [];
    group.push(record); groups.set(record.audit.gutenbergId, group);
  }
  const kohaIdentities = new Map<string, ExportRecord[]>();
  for (const record of unique) {
    const identities = [record.audit.koha001?.trim(), ...fields(record.element, '999').flatMap((field) => values(field, 'c').map((value) => `999$c:${value.trim()}`))].filter((value): value is string => !!value);
    for (const identity of new Set(identities)) {
      const group = kohaIdentities.get(identity) ?? [];
      group.push(record); kohaIdentities.set(identity, group);
    }
  }
  const ambiguousIdentity = new Set([...kohaIdentities.values()].filter((group) => group.length > 1).flat());
  const output: XmlElement[] = [];
  for (const record of unique) {
    const audit = record.audit;
    const id = audit.gutenbergId;
    if (id !== null && (groups.get(id)?.length ?? 0) > 1) audit.conflicts.push(`Ambiguous or materially conflicting exported records for PG${id}`);
    if (ambiguousIdentity.has(record)) audit.conflicts.push('Same Koha record identity occurs in materially different exports');
    if (id !== null && report.conflictingMetadataIds.includes(id)) audit.conflicts.push(`Materially conflicting generated metadata for PG${id}`);
    const source = id !== null ? metadata.get(id) : undefined;
    audit.matched = !!source && audit.conflicts.length === 0;
    if (audit.conflicts.length) audit.status = 'conflicting';
    else if (!source) audit.status = 'unmatched';
    else {
      const result = enrichRecord(record.element, source);
      audit.proposedChanges = result.proposedChanges;
      audit.conflicts.push(...result.conflicts);
      audit.status = result.conflicts.length ? 'conflicting' : result.proposedChanges.length ? 'enriched' : 'unchanged';
      if (!result.conflicts.length) { audit.appliedChanges = result.proposedChanges; output.push(result.element); }
    }
    report.records.push(audit);
    if (audit.matched) report.counts.matched += 1;
    report.counts[audit.status] += 1;
  }
  report.unmatchedMetadataIds = [...metadata.keys()].filter((id) => !groups.has(id)).sort((a, b) => a - b);
  report.duplicateMetadataIds.sort((a, b) => a - b);
  report.conflictingMetadataIds.sort((a, b) => a - b);
  if (report.counts.conflicting) report.errors.push(`${report.counts.conflicting} conflicting exported record(s) withheld from enrichment output`);
  if (report.conflictingMetadataIds.length) report.errors.push('Conflicting generated metadata IDs require manual resolution');
  report.outputRecordCount = output.length;
  const xml = serializeRecords(output);
  parseMarcXml(xml, 'enrichment output');
  await writeNewOutput(outputFile, xml);
  await writeNewOutput(reportFile, JSON.stringify(report, null, 2));
  return report;
}

function gutenbergIdentifier(record: XmlElement): { id: number | null; method: '035$a' | '001-fallback' | null } {
  const controls = fields(record, '001');
  if (controls.length > 1) throw new Error('Multiple 001 control numbers; record identity is ambiguous');
  const ids = new Set<number>();
  for (const value of fields(record, '035').flatMap((field) => values(field, 'a'))) {
    const trimmed = value.trim();
    if (/^\(PG\)/iu.test(trimmed)) ids.add(parseId(trimmed, /^\(PG\)([1-9]\d*)$/u));
  }
  if (ids.size > 1) throw new Error('Conflicting Gutenberg identifiers across repeated 035$a');
  const control = controls[0]?.textContent?.trim() ?? '';
  const fallback = /^PG/iu.test(control) ? parseId(control, /^PG([1-9]\d*)$/u) : null;
  const primary = [...ids][0] ?? null;
  if (primary !== null && fallback !== null && primary !== fallback) throw new Error('Conflicting 001 and 035$a Gutenberg identifiers');
  // Numeric Koha 001 and non-PG agency numbers are never interpreted as Gutenberg IDs.
  return primary !== null ? { id: primary, method: '035$a' } : { id: fallback, method: fallback !== null ? '001-fallback' : null };
}
function parseId(value: string, pattern: RegExp): number {
  const match = value.match(pattern);
  const id = Number(match?.[1]);
  if (!match || !Number.isSafeInteger(id) || id <= 0) throw new Error(`Invalid Gutenberg identifier: ${value}`);
  return id;
}
