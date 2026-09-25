import { create } from 'xmlbuilder2';
import { MarcField, MarcRecord } from './marc.types.js';

export const MARC_NAMESPACE = 'http://www.loc.gov/MARC21/slim';

export function recordToMarcXml(record: MarcRecord): string {
  return recordsToMarcXml([record]);
}

export function recordsToMarcXml(records: MarcRecord[]): string {
  const collection = create({ version: '1.0', encoding: 'UTF-8' }).ele('collection', { xmlns: MARC_NAMESPACE });
  for (const record of records) {
    const recordNode = collection.ele('record').ele('leader').txt(record.leader).up();
    for (const field of record.fields) appendField(recordNode, field);
    recordNode.up();
  }
  return collection.end({ prettyPrint: true });
}

function appendField(parent: ReturnType<ReturnType<typeof create>['ele']>, field: MarcField): void {
  if (field.value !== undefined) {
    parent.ele('controlfield', { tag: field.tag }).txt(field.value).up();
    return;
  }
  const node = parent.ele('datafield', { tag: field.tag, ind1: field.ind1 ?? ' ', ind2: field.ind2 ?? ' ' });
  for (const subfield of field.subfields ?? []) node.ele('subfield', { code: subfield.code }).txt(subfield.value).up();
  node.up();
}