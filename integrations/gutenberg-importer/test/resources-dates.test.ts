import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeBook } from '../src/gutendex/normalize-book.js';
import { toMarcRecord } from '../src/marc/marc.types.js';
import { recordsToMarcXml } from '../src/marc/marcxml-writer.js';
import { parseMarcXml } from '../src/marc/marcxml-reader.js';
import { mapResources, validatedSourceUrl } from '../src/resource-mapping.js';
import { parsePublicationMap, validatePublicationDates } from '../src/publication-map.js';
import { GutenbergImporter } from '../src/importer.js';
import { GutendexClient } from '../src/gutendex/gutendex.client.js';
import { toReport } from '../src/report.js';

test('normalizes MIME parameters, deduplicates URLs, and orders all actual reading formats HTML first', () => {
  const formats = {
    'application/pdf': 'https://example.test/opaque-pdf',
    'application/epub+zip': 'https://example.test/opaque-epub',
    'text/plain; charset=us-ascii': 'https://example.test/text',
    'text/html; charset=UTF-8': 'https://example.test/html',
    ' TEXT/HTML ; charset=us-ascii': 'https://example.test/html#chapter',
    'text/plain; charset=utf-8': 'https://example.test/text-utf8',
    'application/x-mobipocket-ebook': 'https://example.test/kindle',
  };
  const book = normalizeBook({ id: 84, title: 'Book', formats });
  const resources = mapResources(84, book.source);
  assert.deepEqual(resources.resources.map((r) => [r.mediaType, r.label]), [
    ['text/html', 'Read online'], ['text/plain', 'Plain text'], ['text/plain', 'Plain text'], ['application/epub+zip', 'EPUB'], ['application/pdf', 'PDF'],
  ]);
  const marc = toMarcRecord(book).fields.filter((field) => field.tag === '856');
  assert.equal(marc.length, 5);
  assert.ok(marc.every((field) => field.ind1 === '4' && field.ind2 === '0' && field.subfields?.map((s) => s.code).join('') === 'uqy'));
  assert.equal(resources.omittedFormats[0]?.sourceMediaType, 'application/x-mobipocket-ebook');
  assert.deepEqual(mapResources(84, { formats: Object.fromEntries(Object.entries(formats).reverse()) }), resources);
});

test('rejects unsafe or malformed URLs and never infers supported MIME from filenames or opaque URLs', () => {
  for (const url of ['javascript:alert(1)', 'https://', 'https://user:password@example.test/book', 'https://example.test/a b', 'https://example.test/\\evil', 'https://example.test/\nfile']) assert.equal(validatedSourceUrl(url), null);
  const mapping = mapResources(84, { formats: {
    'application/octet-stream': 'https://example.test/book.epub',
    'application/pdf': 'https://example.test/same',
    'text/html': 'https://example.test/same#anchor',
    'nonsense': 'https://example.test/book.pdf',
    'text/plain': 'https://secret:token@example.test/book',
  } });
  assert.equal(mapping.resources.length, 0);
  assert.equal(mapping.omittedFormats.length, 5);
  assert.match(mapping.warnings.join(' '), /Conflicting MIME/);
});

test('carries only source-supplied Gutenberg cache covers with separate role and MARC convention', () => {
  const cover = 'https://www.gutenberg.org/cache/epub/84/pg84.cover.medium.jpg';
  const book = normalizeBook({ id: 84, title: 'Cover', formats: { 'image/jpeg; profile=test': cover } });
  const mapping = mapResources(84, book.source);
  assert.deepEqual(mapping.resources[0], { url: cover, mediaType: 'image/jpeg', label: 'Cover image', role: 'cover', source: 'Gutendex formats["image/jpeg; profile=test"]', sourceMediaType: 'image/jpeg; profile=test' });
  const field = toMarcRecord(book).fields.find((f) => f.tag === '856');
  assert.equal(field?.ind2, '2');
  assert.equal(field?.subfields?.[0]?.value, 'Cover image');
  for (const url of ['https://example.test/cover.jpg', 'https://www.gutenberg.org/cache/epub/11/pg11.cover.medium.jpg', 'https://www.gutenberg.org/cache/epub/84/illustration.jpg', cover + '?x=1']) {
    assert.equal(mapResources(84, { formats: { 'image/jpeg': url } }).resources.length, 0);
  }
  assert.ok(mapResources(84, {}).warnings.includes('No confirmed cover supplied'));
});

const edition = { meaning: 'edition-publication', date: '1901', source: 'https://example.test/title-page', edition: 'Verified cataloged edition' };
test('requires date meaning, provenance, edition identity, and valid precision', () => {
  const map = parsePublicationMap(JSON.stringify({ version: 1, books: { 84: { dates: [edition] } } }));
  assert.equal(map.get(84)?.[0]?.date, '1901');
  for (const date of ['0000', '1901-02-29', '2000-13', '2000-02-30', '1901-01-01T00:00:00Z', 'circa 1901']) assert.throws(() => validatePublicationDates([{ ...edition, date }]), /exact YYYY/);
  assert.doesNotThrow(() => validatePublicationDates([{ ...edition, date: '2000-02-29' }]));
  assert.throws(() => validatePublicationDates([{ ...edition, source: '' }]), /source reference/);
  assert.throws(() => validatePublicationDates([{ ...edition, edition: undefined }]), /cataloged edition/);
  assert.throws(() => validatePublicationDates([{ ...edition, meaning: 'upload-date' }]), /meaning/);
  assert.throws(() => validatePublicationDates([edition, { ...edition, date: '1902' }]), /conflicting/);
  assert.throws(() => validatePublicationDates([edition, { meaning: 'original-work-publication', date: '1902', source: edition.source }]), /chronology/);
  assert.throws(() => validatePublicationDates([
    { meaning: 'gutenberg-release', date: '1998-06', source: edition.source },
    { meaning: 'gutenberg-update', date: '1998-05-31', source: edition.source },
  ]), /chronology/);
  assert.doesNotThrow(() => validatePublicationDates([edition, { meaning: 'original-work-publication', date: '1901-12', source: edition.source }]));
  assert.throws(() => parsePublicationMap('{"version":1,"books":{"84":{"dates":[],"subjects":[]}}}'), /Unknown/);
});

test('maps edition date at its actual precision and keeps 008 consistent', () => {
  for (const [date, code] of [['1901', 's1901    '], ['1901-02', 'e190102  '], ['2000-02-29', 'e20000229']]) {
    const record = toMarcRecord(normalizeBook({ id: 84, title: 'Book' }), [], validatePublicationDates([{ ...edition, date }]));
    const fixed = record.fields.find((f) => f.tag === '008')?.value;
    assert.equal(fixed?.length, 40);
    assert.equal(fixed?.slice(6, 15), code);
    assert.equal(record.fields.find((f) => f.tag === '264')?.ind2, '1');
    assert.equal(record.fields.find((f) => f.tag === '264')?.subfields?.[0]?.value, date);
    assert.match(record.fields.find((f) => f.tag === '500')?.subfields?.[0]?.value ?? '', /Source: https/);
    parseMarcXml(recordsToMarcXml([record]));
  }
});

test('does not turn original work dates, Gutenberg events, author dates, or summaries into edition publication', () => {
  const book = normalizeBook({ id: 84, title: 'Book', summaries: ['Published in 1818'], authors: [{ name: 'Author', birth_year: 1797, death_year: 1851 }], publication_date: '1818' });
  const dates = validatePublicationDates([
    { meaning: 'original-work-publication', date: '1818', source: 'https://example.test/history' },
    { meaning: 'gutenberg-release', date: '1998-06-01', source: 'https://www.gutenberg.org/ebooks/84' },
    { meaning: 'gutenberg-update', date: '2026-09', source: 'https://www.gutenberg.org/ebooks/84' },
  ]);
  for (const selected of [[], dates]) {
    const record = toMarcRecord(book, [], selected);
    assert.equal(record.fields.some((f) => ['008', '264'].includes(f.tag)), false);
    assert.equal(record.fields.filter((f) => f.tag === '500').length, selected.length);
  }
});

test('report retains raw unsupported formats and confirmed metadata, reports unknowns without failing a book', async () => {
  const source = { id: 84, title: 'Book', formats: { 'application/epub+zip': 'https://example.test/book', 'image/png': 'https://example.test/illustration.png' } };
  const client = new GutendexClient({ fetchImpl: async () => new Response(JSON.stringify(source), { status: 200 }) });
  const result = await new GutenbergImporter(client, new Map(), new Map([[84, validatePublicationDates([edition])]])).import([84], 1);
  const report = toReport([84], result) as { books: { source: unknown; publicationDates: unknown; missingMetadata: string[]; resources: { role: string }[] }[] };
  assert.equal(result.errors.length, 0);
  assert.deepEqual(report.books[0]?.source, source);
  assert.deepEqual(report.books[0]?.publicationDates, [edition]);
  assert.deepEqual(report.books[0]?.missingMetadata, ['cover', 'original-work-publication', 'gutenberg-release', 'gutenberg-update']);
  assert.equal(report.books[0]?.resources[0]?.role, 'reading');
});
