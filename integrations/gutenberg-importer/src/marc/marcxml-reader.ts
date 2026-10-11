import { DOMParser, Element as XmlElement, XMLSerializer } from '@xmldom/xmldom';
import { MARC_NAMESPACE } from './marcxml-writer.js';
import { MarcField } from './marc.types.js';

export function parseMarcXml(xml: string, source = 'MARCXML'): XmlElement[] {
  if (/<!DOCTYPE|<!ENTITY/iu.test(xml)) throw new Error(`${source}: DTDs and entities are not supported`);
  const document = new DOMParser({ onError: (_level, message) => { throw new Error(`${source}: ${message}`); } }).parseFromString(xml, 'application/xml');
  const root = document.documentElement;
  if (!root || root.namespaceURI !== MARC_NAMESPACE || !['collection', 'record'].includes(root.localName ?? '')) throw new Error(`${source}: invalid MARCXML root`);
  const records = root.localName === 'record' ? [root] : children(root).filter((node) => node.localName === 'record' && node.namespaceURI === MARC_NAMESPACE);
  if (root.localName === 'collection' && children(root).length !== records.length) throw new Error(`${source}: unexpected collection elements`);
  for (const record of records) {
    const leaders = children(record).filter((element) => element.localName === 'leader');
    if (leaders.length !== 1 || leaders[0]?.textContent?.length !== 24) throw new Error(`${source}: invalid record leader`);
    if (children(record).some((element) => element.namespaceURI !== MARC_NAMESPACE)) throw new Error(`${source}: unexpected record namespace`);
  }
  return records;
}

export function fields(record: XmlElement, tag: string): XmlElement[] {
  return children(record).filter((element) => ['datafield', 'controlfield'].includes(element.localName ?? '') && element.getAttribute('tag') === tag);
}
export function subfields(field: XmlElement, code: string): XmlElement[] {
  return children(field).filter((element) => element.localName === 'subfield' && element.getAttribute('code') === code);
}
export function values(field: XmlElement, code: string): string[] {
  return subfields(field, code).map((element) => element.textContent ?? '');
}
export function appendSubfield(field: XmlElement, code: string, value: string): void {
  const document = field.ownerDocument;
  if (!document) throw new Error('MARC field has no owner document');
  const node = document.createElementNS(MARC_NAMESPACE, 'subfield');
  node.setAttribute('code', code);
  node.appendChild(document.createTextNode(value));
  field.appendChild(node);
}
export function appendField(record: XmlElement, field: MarcField): void {
  const document = record.ownerDocument;
  if (!document) throw new Error('MARC record has no owner document');
  const element = document.createElementNS(MARC_NAMESPACE, field.value === undefined ? 'datafield' : 'controlfield');
  element.setAttribute('tag', field.tag);
  if (field.value === undefined) {
    element.setAttribute('ind1', field.ind1 ?? ' ');
    element.setAttribute('ind2', field.ind2 ?? ' ');
    for (const subfield of field.subfields ?? []) appendSubfield(element, subfield.code, subfield.value);
  } else element.appendChild(document.createTextNode(field.value));
  // Control fields precede data fields. Existing field order is otherwise retained.
  const firstData = children(record).find((node) => node.localName === 'datafield');
  if (field.value !== undefined && firstData) record.insertBefore(element, firstData);
  else record.appendChild(element);
}
export function serializeRecords(records: XmlElement[]): string {
  const serializer = new XMLSerializer();
  return `<?xml version="1.0" encoding="UTF-8"?>\n<collection xmlns="${MARC_NAMESPACE}">${records.map((record) => serializer.serializeToString(record)).join('')}</collection>`;
}
/** Ignore formatting between fields, but retain every field, attribute, and value. */
export function recordSignature(record: XmlElement): string {
  function signature(element: XmlElement): unknown {
    const attributes = Array.from({ length: element.attributes.length }, (_, index) => element.attributes.item(index))
      .filter((attribute) => attribute && !attribute.name.startsWith('xmlns'))
      .map((attribute) => [attribute?.namespaceURI, attribute?.localName, attribute?.value]).sort();
    const nodes = children(element);
    return [element.namespaceURI, element.localName, attributes, nodes.length ? nodes.map(signature) : element.textContent];
  }
  return JSON.stringify(signature(record));
}
function children(element: XmlElement): XmlElement[] { return Array.from(element.childNodes).filter((node): node is XmlElement => node.nodeType === 1); }
