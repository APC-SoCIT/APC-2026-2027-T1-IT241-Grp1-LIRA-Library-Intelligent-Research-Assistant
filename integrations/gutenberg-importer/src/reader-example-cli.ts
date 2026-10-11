import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { GutendexClient } from './gutendex/gutendex.client.js';
import { GutenbergImporter } from './importer.js';
import { recordsToMarcXml } from './marc/marcxml-writer.js';
import { validateMarcXml } from './marc/validate-marcxml.js';
import { enrichMarcXmlFiles } from './offline-enrich.js';
import { checkNewOutputs, writeNewOutput } from './output-files.js';
import { toReport } from './report.js';
import { readSubjectMap } from './subject-map.js';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 2 || args[0] !== '--output-dir' || !args[1])) throw new Error('Usage: npm run example:reader -- [--output-dir ./output/reader-example]');
  const dir = resolve(args[1] ?? './output/reader-example');
  const xmlPath = resolve(dir, 'gutenberg-1342.marcxml');
  const reportPath = resolve(dir, 'gutenberg-1342.report.json');
  const enrichedPath = resolve(dir, 'koha-enriched.marcxml');
  const auditPath = resolve(dir, 'koha-enriched.report.json');
  await checkNewOutputs([xmlPath, reportPath, enrichedPath, auditPath]);
  const source = await readFile(resolve('test/fixtures/gutendex-reader.json'), 'utf8');
  const client = new GutendexClient({ fetchImpl: async () => new Response(source) });
  const result = await new GutenbergImporter(client, await readSubjectMap(resolve('examples/subjects.json'))).import([1342], 1);
  const xml = recordsToMarcXml(result.records);
  validateMarcXml(xml, 1);
  await writeNewOutput(xmlPath, xml);
  await writeNewOutput(reportPath, JSON.stringify(toReport([1342], result), null, 2));
  const audit = await enrichMarcXmlFiles({ inputPaths: [resolve('test/fixtures/koha-export.marcxml')], metadataPaths: [reportPath], outputPath: enrichedPath, reportPath: auditPath });
  if (audit.errors.length) throw new Error(audit.errors.join('; '));
  console.log(`Offline fixtures only; do not stage these example records. Outputs: ${dir}`);
  console.log(JSON.stringify(audit.counts));
}
main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : 'Reader example failed'); process.exitCode = 1; });
