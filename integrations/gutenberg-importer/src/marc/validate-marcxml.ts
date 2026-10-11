import { Element as XmlElement } from '@xmldom/xmldom';
import { MARC_NAMESPACE } from './marcxml-writer.js';
import { parseMarcXml } from './marcxml-reader.js';

export function validateMarcXml(xml: string, expectedRecords: number): void {
  const records = parseMarcXml(xml, 'Generated MARCXML');
  if (records.length !== expectedRecords) throw new Error(`Generated MARCXML contains ${records.length} records; expected ${expectedRecords}`);
  for (let index = 0; index < records.length; index += 1) validateRecord(records[index] ?? null, index);
}

function validateRecord(record: XmlElement | null, index: number): void {
  if (!record) throw new Error(`MARCXML record ${index + 1} is missing`);
  const leader = record.getElementsByTagNameNS(MARC_NAMESPACE, 'leader').item(0);
  if (!leader || leader.textContent?.length !== 24) throw new Error(`MARCXML record ${index + 1} has an invalid leader`);
  const control001 = [...Array.from(record.getElementsByTagNameNS(MARC_NAMESPACE, 'controlfield'))]
    .find((field) => field.getAttribute('tag') === '001');
  if (!control001?.textContent) throw new Error(`MARCXML record ${index + 1} is missing 001`);
  const datafields = Array.from(record.getElementsByTagNameNS(MARC_NAMESPACE, 'datafield'));
  const matchingField = datafields.find((field) => field.getAttribute('tag') === '035');
  const matchingValue = matchingField && Array.from(matchingField.getElementsByTagNameNS(MARC_NAMESPACE, 'subfield'))
    .find((subfield) => subfield.getAttribute('code') === 'a')?.textContent;
  if (!matchingValue?.startsWith('(PG)')) throw new Error(`MARCXML record ${index + 1} is missing the Gutenberg 035$a identifier`);
}
