import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm, link, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { enrichMarcXmlFiles } from '../src/offline-enrich.js';
import { parseMarcXml, fields, recordSignature, serializeRecords, values } from '../src/marc/marcxml-reader.js';
import { normalizeBook } from '../src/gutendex/normalize-book.js';
import { GutenbergImporter } from '../src/importer.js';
import { GutendexClient } from '../src/gutendex/gutendex.client.js';
import { toReport } from '../src/report.js';
import { PublicationDate } from '../src/publication-map.js';

const namespace = 'http://www.loc.gov/MARC21/slim';
const leader = '00000nam a2200000 i 4500';
const collection = (records: string[]) => `<collection xmlns="${namespace}">${records.join('')}</collection>`;
const field = (tag: string, code: string, value: string, ind2 = ' ', extra = '') => `<datafield tag="${tag}" ind1=" " ind2="${ind2}"><subfield code="${code}">${value}</subfield>${extra}</datafield>`;
const record = (id: number, control = '440', extra = '', title = 'Manually edited title &amp; résumé') => `<record><leader>${leader}</leader><controlfield tag="001">${control}</controlfield>${field('035', 'a', '(OCoLC)local')}${field('035', 'a', `(PG)${id}`)}${field('245', 'a', title)}${extra}</record>`;
const edition: PublicationDate = { meaning: 'edition-publication', date: '1901', source: 'https://example.test/title-page', edition: 'Cataloged edition' };
const source = (id = 1342) => ({ id, title: 'Fresh source title', subjects: ['Literature'], formats: {
  'text/html; charset=utf-8': `https://www.gutenberg.org/ebooks/${id}.html.images`,
  'text/plain': `https://www.gutenberg.org/ebooks/${id}.txt.utf-8`,
  'application/epub+zip': `https://www.gutenberg.org/ebooks/${id}.epub3.images`,
  'image/jpeg': `https://www.gutenberg.org/cache/epub/${id}/pg${id}.cover.medium.jpg`,
} });

async function report(books = [source()], dates: PublicationDate[] = []): Promise<string> {
  const client = new GutendexClient({ fetchImpl: async (input) => new Response(JSON.stringify(books.find((book) => String(input).endsWith(`/${book.id}`)))) });
  const ids = books.map((book) => book.id);
  const result = await new GutenbergImporter(client, new Map(ids.map((id) => [id, ['Literature']])), new Map(ids.map((id) => [id, dates]))).import(ids, 2);
  return JSON.stringify(toReport(ids, result));
}
async function temp(run: (dir: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), 'lira-enrich-'));
  try { await run(dir); } finally { await rm(dir, { recursive: true, force: true }); }
}
async function run(dir: string, input: string, metadata: string, suffix = '') {
  const inputPath = join(dir, `koha${suffix}.marcxml`);
  const metadataPath = join(dir, `generated${suffix}.report.json`);
  const outputPath = join(dir, `enriched${suffix}.marcxml`);
  const reportPath = join(dir, `audit${suffix}.json`);
  await writeFile(inputPath, input);
  await writeFile(metadataPath, metadata);
  const audit = await enrichMarcXmlFiles({ inputPaths: [inputPath], metadataPaths: [metadataPath], outputPath, reportPath });
  return { audit, xml: await readFile(outputPath, 'utf8'), inputPath, metadataPath, outputPath, reportPath };
}

test('preserves complete manual attachments, notes, Unicode and unknown/local/item fields; enrichment is idempotent', async () => {
  await temp(async (dir) => {
    const pdf = field('856', 'u', 'http://100.118.244.66:8080/cgi-bin/koha/opac-retrieve-file.pl?id=opaque', '0', '<subfield code="q">application/pdf</subfield><subfield code="y">Manual PDF &amp; notes</subfield><subfield code="z">Keep all subfields</subfield>');
    const epub = field('856', 'u', 'http://100.118.244.66:8080/cgi-bin/koha/opac-retrieve-file.pl?id=another-opaque', '0', '<subfield code="y">EPUB version</subfield>');
    const local = `<controlfield tag="005">20261012000000.0</controlfield>${field('090', 'a', 'LOCAL-001')}${field('500', 'a', 'Do not replace &amp; café')}${field('952', 'p', 'Barcode-42', ' ', '<subfield code="a">MAIN</subfield><subfield code="9">123</subfield>')}${field('999', 'c', '440')}${field('987', 'x', 'Unknown local data &lt;α&gt;')}${field('650', 'a', 'Literature', '0')}`;
    const original = collection([record(1342, '440', pdf + epub + local)]);
    const metadata = await report();
    const first = await run(dir, original, metadata);
    assert.deepEqual(first.audit.counts, { matched: 1, unmatched: 0, enriched: 1, unchanged: 0, conflicting: 0 });
    assert.equal(await readFile(first.inputPath, 'utf8'), original);
    const enriched = parseMarcXml(first.xml)[0]!;
    const before = parseMarcXml(original)[0]!;
    for (const tag of ['001', '005', '035', '245', '090', '500', '952', '999', '987']) assert.deepEqual(fields(enriched, tag).map((f) => recordSignature(f)), fields(before, tag).map((f) => recordSignature(f)));
    for (const attachment of fields(before, '856')) assert.ok(fields(enriched, '856').some((f) => recordSignature(f) === recordSignature(attachment)));
    assert.equal(fields(enriched, '856').length, 6);
    assert.deepEqual(fields(enriched, '650').map((f) => f.getAttribute('ind2')), ['0', '4']);
    assert.equal(fields(enriched, '264').length, 0);
    const second = await run(dir, first.xml, metadata, '-second');
    assert.deepEqual(second.audit.counts, { matched: 1, unmatched: 0, enriched: 0, unchanged: 1, conflicting: 0 });
    assert.deepEqual(second.audit.records[0]?.proposedChanges, []);
    assert.equal(recordSignature(parseMarcXml(second.xml)[0]!), recordSignature(enriched));
  });
});

test('fills missing q/y only for the exact source URL and preserves existing equivalent local categories', async () => {
  await temp(async (dir) => {
    const html = field('856', 'u', 'https://www.gutenberg.org/ebooks/1342.html.images', '0', '<subfield code="x">Private note</subfield>');
    const result = await run(dir, collection([record(1342, '440', html + field('650', 'a', ' literature ', '4'))]), await report());
    const parsed = parseMarcXml(result.xml)[0]!;
    const first = fields(parsed, '856')[0]!;
    assert.deepEqual(values(first, 'q'), ['text/html']);
    assert.deepEqual(values(first, 'y'), ['Read online']);
    assert.deepEqual(values(first, 'x'), ['Private note']);
    assert.equal(fields(parsed, '650').length, 1);
    assert.equal(result.audit.records[0]?.appliedChanges.filter((c) => c.action === 'add-subfield').length, 2);
  });
});

test('conflicting resource MIME, labels or associations are reported, unchanged and withheld', async () => {
  await temp(async (dir) => {
    const url = 'https://www.gutenberg.org/ebooks/1342.html.images';
    for (const [index, extra] of [
      '<subfield code="q">application/pdf</subfield>', '<subfield code="y">Manual online label</subfield>',
      '<subfield code="u">https://example.test/another</subfield>', '<subfield code="q"></subfield>',
    ].entries()) {
      const input = collection([record(1342, '440', field('856', 'u', url, '0', extra))]);
      const result = await run(dir, input, await report(), `-${index}`);
      assert.equal(result.audit.counts.conflicting, 1);
      assert.equal(result.audit.outputRecordCount, 0);
      assert.deepEqual(result.audit.records[0]?.appliedChanges, []);
      assert.ok(result.audit.records[0]?.conflicts.length);
      assert.equal(await readFile(result.inputPath, 'utf8'), input);
    }
  });
});

test('existing edition and fixed dates stay intact, additions preserve precision, conflicts are withheld', async () => {
  await temp(async (dir) => {
    const metadata = await report([source()], [edition]);
    const fixed = '241201s1901    xx ' + '|'.repeat(17) + 'eng d';
    const input = collection([record(1342, '440', `<controlfield tag="008">${fixed}</controlfield>${field('264', 'c', '1901', '1', '<subfield code="b">Manual publisher</subfield>')}`)]);
    const first = await run(dir, input, metadata);
    const parsed = parseMarcXml(first.xml)[0]!;
    assert.equal(fields(parsed, '008')[0]?.textContent, fixed);
    assert.deepEqual(values(fields(parsed, '264')[0]!, 'b'), ['Manual publisher']);
    assert.deepEqual(values(fields(parsed, '264')[0]!, 'c'), ['1901']);
    const again = await run(dir, first.xml, metadata, '-again');
    assert.equal(again.audit.counts.unchanged, 1);
    for (const [index, change] of [input.replace('>1901<', '>1902<'), input.replace('s1901', 's1902'), input.replace('s1901    ', 'e19010101')].entries()) {
      const result = await run(dir, change, metadata, `-conflict-${index}`);
      assert.equal(result.audit.counts.conflicting, 1);
      assert.equal(result.audit.outputRecordCount, 0);
    }
    const unknown = '241201|||||||||xx ' + '|'.repeat(17) + 'eng d';
    const result = await run(dir, collection([record(1342, '440', `<controlfield tag="008">${unknown}</controlfield>${field('264', 'b', 'Manual publisher', '1')}`)]), metadata, '-fill');
    assert.equal(fields(parseMarcXml(result.xml)[0]!, '008')[0]?.textContent, fixed);
    assert.deepEqual(values(fields(parseMarcXml(result.xml)[0]!, '264')[0]!, 'c'), ['1901']);
  });
});

test('Koha 001 is not a Gutenberg fallback; primary repeated 035 identifiers and PG001 fallback are handled safely', async () => {
  await temp(async (dir) => {
    const primary = record(1342, '440');
    const fallback = record(84, 'PG84').replace(field('035', 'a', '(PG)84'), '');
    const noPg = record(11, '11').replace(field('035', 'a', '(PG)11'), '');
    const input = collection([primary, fallback, noPg]);
    const result = await run(dir, input, await report([source(), source(84), source(11)]));
    assert.equal(result.audit.counts.matched, 2);
    assert.equal(result.audit.counts.unmatched, 1);
    assert.deepEqual(result.audit.records.map((r) => r.matchMethod), ['035$a', '001-fallback', null]);
    const out = parseMarcXml(result.xml);
    assert.equal(fields(out[0]!, '001')[0]?.textContent, '440');
    assert.equal(fields(out[1]!, '001')[0]?.textContent, 'PG84');
    assert.ok(fields(out[1]!, '035').some((f) => values(f, 'a').includes('(PG)84')));
    assert.deepEqual(result.audit.unmatchedMetadataIds, [11]);
  });
});

test('rejects conflicting repeated 035, PG001 conflicts, malformed identifiers and ambiguous exports', async () => {
  await temp(async (dir) => {
    const input = collection([
      record(1342, '440', field('035', 'a', '(PG)11')),
      record(11, 'PG84'),
      record(84, '442').replace('(PG)84', '(PG)bad'),
      record(50, '500'), record(50, '501'),
    ]);
    const result = await run(dir, input, await report([source(), source(11), source(84), source(50)]));
    assert.equal(result.audit.counts.conflicting, 5);
    assert.equal(result.audit.outputRecordCount, 0);
    assert.ok(result.audit.records.every((r) => r.conflicts.length));
  });
});

test('deduplicates identical exports and metadata but rejects material duplicates including categories and local fields', async () => {
  await temp(async (dir) => {
    const generated = await report();
    const doubled = JSON.parse(generated);
    doubled.books.push(doubled.books[0]);
    const same = await run(dir, collection([record(1342), record(1342)]), JSON.stringify(doubled));
    assert.equal(same.audit.outputRecordCount, 1);
    assert.equal(same.audit.duplicateExports.length, 1);
    assert.deepEqual(same.audit.duplicateMetadataIds, [1342]);
    const conflict = await run(dir, collection([record(1342), record(1342, '440', field('650', 'a', 'History', '4'))]), generated, '-categories');
    assert.equal(conflict.audit.counts.conflicting, 2);
    doubled.books[1] = { ...doubled.books[1], source: { ...doubled.books[1].source, title: 'Different title' } };
    const metadataConflict = await run(dir, collection([record(1342)]), JSON.stringify(doubled), '-metadata');
    assert.deepEqual(metadataConflict.audit.conflictingMetadataIds, [1342]);
    assert.equal(metadataConflict.audit.outputRecordCount, 0);
  });
});

test('reports unmatched records and prevents distinct Gutenberg IDs from sharing a Koha identity', async () => {
  await temp(async (dir) => {
    const unmatched = await run(dir, collection([record(11, '441')]), await report());
    assert.equal(unmatched.audit.counts.unmatched, 1);
    assert.deepEqual(unmatched.audit.unmatchedMetadataIds, [1342]);
    assert.equal(unmatched.audit.outputRecordCount, 0);
    const conflict = await run(dir, collection([record(1342, '440'), record(11, '440')]), await report([source(), source(11)]), '-same-identity');
    assert.equal(conflict.audit.counts.conflicting, 2);
    assert.ok(conflict.audit.records.every((r) => r.conflicts.some((c) => c.includes('Koha record identity'))));
  });
});

test('qualified original-work and Gutenberg dates never populate edition dates and conflicting provenance is preserved', async () => {
  await temp(async (dir) => {
    const dates: PublicationDate[] = [{ meaning: 'gutenberg-release', date: '1998-06-01', source: 'https://www.gutenberg.org/ebooks/1342' }];
    const first = await run(dir, collection([record(1342)]), await report([source()], dates));
    const parsed = parseMarcXml(first.xml)[0]!;
    assert.equal(fields(parsed, '264').length, 0);
    assert.equal(fields(parsed, '008').length, 0);
    const repeated = await run(dir, first.xml, await report([source()], dates), '-repeat-notes');
    assert.equal(repeated.audit.counts.unchanged, 1);
    const conflicting = await run(dir, first.xml, await report([source()], [{ ...dates[0]!, date: '1998-06' }]), '-conflicting-notes');
    assert.equal(conflicting.audit.counts.conflicting, 1);
    assert.equal(conflicting.audit.outputRecordCount, 0);
  });
});

test('never overwrites inputs, reports, existing outputs or aliases to inputs', async () => {
  await temp(async (dir) => {
    const result = await run(dir, collection([record(1342)]), await report());
    const base = { inputPaths: [result.inputPath], metadataPaths: [result.metadataPath], outputPath: join(dir, 'other.marcxml'), reportPath: join(dir, 'other.json') };
    await assert.rejects(enrichMarcXmlFiles({ ...base, outputPath: result.inputPath }), /never overwritten/);
    await assert.rejects(enrichMarcXmlFiles({ ...base, reportPath: result.inputPath }), /never overwritten/);
    await assert.rejects(enrichMarcXmlFiles({ ...base, outputPath: result.metadataPath }), /never overwritten/);
    await assert.rejects(enrichMarcXmlFiles({ ...base, outputPath: result.outputPath }), /already exists/);
    await assert.rejects(enrichMarcXmlFiles({ ...base, reportPath: base.outputPath }), /must differ/);
    const alias = join(dir, 'hardlink.marcxml');
    await link(result.inputPath, alias);
    await assert.rejects(enrichMarcXmlFiles({ ...base, outputPath: alias }), /never overwritten/);
  });
});

test('strict XML parsing rejects repair, DTD, and malformed input; structural failures write only an audit', async () => {
  for (const xml of ['<!DOCTYPE collection><collection/>', collection([record(1342)]).replace('</subfield>', ''), '<collection xmlns="wrong"/>']) assert.throws(() => parseMarcXml(xml));
  await temp(async (dir) => {
    const inputPath = join(dir, 'bad.marcxml');
    const metadataPath = join(dir, 'metadata.json');
    const outputPath = join(dir, 'output.marcxml');
    const reportPath = join(dir, 'audit.json');
    await writeFile(inputPath, '<broken>'); await writeFile(metadataPath, await report());
    await assert.rejects(enrichMarcXmlFiles({ inputPaths: [inputPath], metadataPaths: [metadataPath], outputPath, reportPath }));
    assert.ok(JSON.parse(await readFile(reportPath, 'utf8')).errors.length);
    await assert.rejects(access(outputPath));
  });
});

test('preserves prefixed namespaces and escaped XML without losing complete fields', () => {
  const original = collection([record(1342)]).replace(/<(\/?)(collection|record|leader|controlfield|datafield|subfield)/gu, '<$1marc:$2').replace(`xmlns="${namespace}"`, `xmlns:marc="${namespace}"`);
  const records = parseMarcXml(original);
  const serialized = serializeRecords(records);
  assert.equal(recordSignature(parseMarcXml(serialized)[0]!), recordSignature(records[0]!));
  assert.equal(normalizeBook({ id: 1, title: 'Café & α' }).title, 'Café & α');
});
