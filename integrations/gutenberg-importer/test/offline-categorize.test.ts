import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { categorizeMarcXmlFiles } from '../src/offline-categorize.js';
import { CONTROLLED_CATEGORIES } from '../src/subject-map.js';

const leader = '00000nam a2200000 i 4500';

function record(id: number, title = 'Book', subject = 'Source subject'): string {
  return `<record><leader>${leader}</leader><controlfield tag="001">PG${id}</controlfield><datafield tag="035" ind1=" " ind2=" "><subfield code="a">(PG)${id}</subfield></datafield><datafield tag="245" ind1="0" ind2="0"><subfield code="a">${title}</subfield></datafield><datafield tag="650" ind1=" " ind2="0"><subfield code="a">${subject}</subfield></datafield></record>`;
}

function collection(records: string[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?><collection xmlns="http://www.loc.gov/MARC21/slim">${records.join('')}</collection>`;
}

async function withTempDirectory(run: (directory: string) => Promise<void>): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), 'lira-categorize-'));
  try {
    await run(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test('categorizes multiple files, deduplicates identical records, preserves source 650, and reports unused mappings', async () => {
  await withTempDirectory(async (directory) => {
    const first = join(directory, 'first.marcxml');
    const second = join(directory, 'second.marcxml');
    const map = join(directory, 'subjects.json');
    const output = join(directory, 'categorized.marcxml');
    const reportPath = join(directory, 'categorized.report.json');
    await writeFile(first, collection([record(84, 'Book', 'Literature'), record(11, 'Second book')]), 'utf8');
    await writeFile(second, collection([record(84, 'Book', 'Literature')]), 'utf8');
    await writeFile(map, JSON.stringify({ 84: ['literature'], 11: ['History'], 999: ['Psychology'] }), 'utf8');

    const report = await categorizeMarcXmlFiles({ inputPaths: [first, second], subjectMapPath: map, outputPath: output, reportPath });
    const xml = await readFile(output, 'utf8');
    assert.equal(report.inputRecordCount, 3);
    assert.equal(report.uniqueOutputRecordCount, 2);
    assert.deepEqual(report.duplicateGutenbergIds, [84]);
    assert.deepEqual(report.unusedMappingIds, [999]);
    assert.deepEqual(report.categoryTotals, { Literature: 1, History: 1 });
    assert.deepEqual(report.addedCategories, { '11': ['History'], '84': ['Literature'] });
    assert.match(xml, /<controlfield tag="001">PG84<\/controlfield>/);
    assert.match(xml, /<datafield tag="650" ind1=" " ind2="0"><subfield code="a">Literature<\/subfield><\/datafield>/);
    assert.match(xml, /<datafield tag="650" ind1=" " ind2="4"><subfield code="a">Literature<\/subfield><\/datafield>/);
  });
});

test('reports exact 53 input occurrences as 52 unique records with required totals', async () => {
  await withTempDirectory(async (directory) => {
    const existingIds = [42, 84, 100, 108, 145, 155, 204, 209, 244, 345, 393, 468, 564, 583, 589, 601, 831, 834, 863, 1184, 1260, 1513, 1661, 1695, 1727, 2097, 2147, 2148, 2350, 2465, 2554, 2641, 2680, 2701, 2760, 2852, 2868, 3268, 3289, 5197, 6133, 8492, 37106, 37683, 63469, 65238, 67979, 68283, 68957, 69087, 1342, 11];
    const first = join(directory, 'fifty.marcxml');
    const second = join(directory, 'three.marcxml');
    const map = join(directory, 'existing.json');
    const output = join(directory, 'output.marcxml');
    const reportPath = join(directory, 'output.report.json');
    const categories = Object.fromEntries(existingIds.map((id) => [id, [id === 2680 ? 'Psychology' : [2760, 5197, 63469].includes(id) ? 'History' : 'Literature']]));
    await writeFile(first, collection(existingIds.slice(0, 50).map((id) => record(id))), 'utf8');
    await writeFile(second, collection([record(84), record(1342), record(11)]), 'utf8');
    await writeFile(map, JSON.stringify(categories), 'utf8');

    const report = await categorizeMarcXmlFiles({ inputPaths: [first, second], subjectMapPath: map, outputPath: output, reportPath });
    assert.equal(report.inputRecordCount, 53);
    assert.equal(report.uniqueOutputRecordCount, 52);
    assert.deepEqual(report.duplicateGutenbergIds, [84]);
    assert.deepEqual(report.categoryTotals, { Literature: 48, Psychology: 1, History: 3 });
  });
});

test('reports multiple assigned categories while adding each non-duplicate category', async () => {
  await withTempDirectory(async (directory) => {
    const input = join(directory, 'input.marcxml');
    const map = join(directory, 'subjects.json');
    const output = join(directory, 'output.marcxml');
    const reportPath = join(directory, 'output.report.json');
    await writeFile(input, collection([record(84)]), 'utf8');
    await writeFile(map, '{"84":["Literature","History","history"]}', 'utf8');
    const report = await categorizeMarcXmlFiles({ inputPaths: [input], subjectMapPath: map, outputPath: output, reportPath });
    assert.deepEqual(report.appliedCategories, { '84': ['Literature', 'History'] });
    assert.deepEqual(report.addedCategories, { '84': ['Literature', 'History'] });
  });
});

test('rejects conflicting duplicate records and writes an audit error', async () => {
  await withTempDirectory(async (directory) => {
    const first = join(directory, 'first.marcxml');
    const second = join(directory, 'second.marcxml');
    const map = join(directory, 'subjects.json');
    const output = join(directory, 'output.marcxml');
    const reportPath = join(directory, 'output.report.json');
    await writeFile(first, collection([record(84, 'First')]), 'utf8');
    await writeFile(second, collection([record(84, 'Different')]), 'utf8');
    await writeFile(map, '{"84":["Literature"]}', 'utf8');
    await assert.rejects(categorizeMarcXmlFiles({ inputPaths: [first, second], subjectMapPath: map, outputPath: output, reportPath }), /Conflicting duplicate/);
    assert.deepEqual(JSON.parse(await readFile(reportPath, 'utf8')).conflictingDuplicateIds, [84]);
  });
});

test('rejects missing mappings and inconsistent identifiers without producing output', async () => {
  await withTempDirectory(async (directory) => {
    const input = join(directory, 'input.marcxml');
    const map = join(directory, 'subjects.json');
    const output = join(directory, 'output.marcxml');
    const reportPath = join(directory, 'output.report.json');
    await writeFile(input, collection([record(84)]), 'utf8');
    await writeFile(map, '{"11":["Literature"]}', 'utf8');
    await assert.rejects(categorizeMarcXmlFiles({ inputPaths: [input], subjectMapPath: map, outputPath: output, reportPath }), /Missing subject mappings/);
    await assert.rejects(categorizeMarcXmlFiles({ inputPaths: [input], subjectMapPath: map, outputPath: input, reportPath }), /Output path must differ/);
  });
});

test('rejects inconsistent 001 and 035 identifiers', async () => {
  await withTempDirectory(async (directory) => {
    const input = join(directory, 'input.marcxml');
    const map = join(directory, 'subjects.json');
    const output = join(directory, 'output.marcxml');
    const reportPath = join(directory, 'output.report.json');
    const inconsistent = record(84).replace('(PG)84', '(PG)11');
    await writeFile(input, collection([inconsistent]), 'utf8');
    await writeFile(map, '{"84":["Literature"]}', 'utf8');
    await assert.rejects(categorizeMarcXmlFiles({ inputPaths: [input], subjectMapPath: map, outputPath: output, reportPath }), /conflicting 001 and 035/);
  });
});