import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { GutendexClient } from '../src/gutendex/gutendex.client.js';
import { GutenbergImporter } from '../src/importer.js';
import { toReport } from '../src/report.js';
import { enrichMarcXmlFiles } from '../src/offline-enrich.js';
import { parseMarcXml, fields, values } from '../src/marc/marcxml-reader.js';

test('reader handoff fixtures generate a real-shaped report and enrich a Koha export entirely offline', async () => {
  const source = JSON.parse(await readFile(new URL('./fixtures/gutendex-reader.json', import.meta.url), 'utf8'));
  const client = new GutendexClient({ fetchImpl: async () => new Response(JSON.stringify(source)) });
  const result = await new GutenbergImporter(client, new Map([[1342, ['Literature']]])).import([1342], 1);
  const dir = await mkdtemp(join(tmpdir(), 'lira-fixture-'));
  try {
    const metadataPath = join(dir, 'report.json');
    const outputPath = join(dir, 'enriched.marcxml');
    await writeFile(metadataPath, JSON.stringify(toReport([1342], result)));
    const audit = await enrichMarcXmlFiles({ inputPaths: [fileURLToPath(new URL('./fixtures/koha-export.marcxml', import.meta.url))], metadataPaths: [metadataPath], outputPath, reportPath: join(dir, 'audit.json') });
    assert.equal(audit.counts.enriched, 1);
    const record = parseMarcXml(await readFile(outputPath, 'utf8'))[0]!;
    assert.equal(fields(record, '856').length, 6);
    assert.ok(fields(record, '856').some((field) => values(field, 'q').includes('application/epub+zip')));
    const manualEpub = fields(record, '856').find((field) => values(field, 'y').includes('Manual EPUB'))!;
    assert.deepEqual(values(manualEpub, 'q'), []); // Opaque upload URL/label is not format evidence.
    assert.equal(fields(record, '264').length, 0);
    assert.equal(audit.records[0]?.koha001, '440');
  } finally { await rm(dir, { recursive: true, force: true }); }
});
