/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeBook } from '../src/gutendex/normalize-book.js';
import { toMarcRecord } from '../src/marc/marc.types.js';
import { recordsToMarcXml } from '../src/marc/marcxml-writer.js';
import { validateMarcXml } from '../src/marc/validate-marcxml.js';

test('maps MARC indicators, matching identifier, repeated fields, and escaped Unicode', () => {
  const book = normalizeBook({
    id: 1342,
    title: 'The Pride & Prejudice',
    authors: [{ name: 'Austen, Jane' }, { name: 'Contributor' }],
    subjects: ['Love & society'],
    languages: ['en'],
    summaries: ['A <summary>'],
    formats: { 'text/html': 'https://example.test/a&b' },
  }, 1342);
  const record = toMarcRecord(book);
  const xml = recordsToMarcXml([record]);

  assert.equal(record.leader.length, 24);
  assert.deepEqual(record.fields.find((field) => field.tag === '035')?.subfields, [{ code: 'a', value: '(PG)1342' }]);
  assert.equal(record.fields.find((field) => field.tag === '245')?.ind1, '1');
  assert.equal(record.fields.find((field) => field.tag === '245')?.ind2, '4');
  assert.deepEqual(record.fields.find((field) => field.tag === '041')?.subfields, [{ code: 'a', value: 'eng' }]);
  assert.deepEqual(
    record.fields.find((field) => field.tag === '100')?.subfields,
    [{ code: 'a', value: 'Austen, Jane' }],
  );
  assert.deepEqual(
    record.fields.find((field) => field.tag === '700')?.subfields,
    [{ code: 'a', value: 'Contributor' }],
  );
  assert.deepEqual(
    record.fields.find((field) => field.tag === '520')?.subfields,
    [{ code: 'a', value: 'A <summary>' }],
  );
  assert.deepEqual(
    record.fields.find((field) => field.tag === '650')?.subfields,
    [{ code: 'a', value: 'Love & society' }],
  );
  assert.equal(
    record.fields.find((field) => field.tag === '650')?.ind2,
    '0',
  );
  assert.match(xml, /The Pride &amp; Prejudice/);
  assert.match(xml, /https:\/\/example\.test\/a&amp;b/);
  validateMarcXml(xml, 1);
});

  test('selects only plain text when HTML is missing', () => {
    const book = normalizeBook({ id: 84, title: 'No HTML', formats: { 'text/plain': 'https://example.test/book.txt', 'application/rdf+xml': 'https://example.test/book.rdf' } }, 84);
    const record = toMarcRecord(book);
    const resources = record.fields.filter((field) => field.tag === '856').flatMap((field) => field.subfields ?? []);
    assert.deepEqual(resources, [{ code: 'u', value: 'https://example.test/book.txt' }]);
    assert.deepEqual(record.fields.find((field) => field.tag === '035')?.subfields, [{ code: 'a', value: '(PG)84' }]);
  });

  test('omits 856 when neither HTML nor plain text is available', () => {
    const book = normalizeBook({ id: 11, title: 'No reading link', formats: { 'application/rdf+xml': 'https://example.test/book.rdf', 'application/zip': 'https://example.test/book.zip' } }, 11);
    assert.equal(toMarcRecord(book).fields.some((field) => field.tag === '856'), false);
  });