import { enrichMarcXmlFiles, EnrichOptions } from './offline-enrich.js';

function parseArgs(args: string[]): EnrichOptions {
  const inputPaths: string[] = [];
  const metadataPaths: string[] = [];
  let outputPath: string | undefined;
  let reportPath: string | undefined;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--help') {
      console.log('Usage: npm run enrich -- --input ./exports/koha.marcxml --metadata ./output/new/gutenberg-1342.report.json --output ./output/enriched/koha.marcxml [--report ./output/enriched/audit.json] (repeat --input and --metadata as needed)');
      process.exit(0);
    }
    const value = args[++index];
    if (!value || value.startsWith('--')) throw new Error(`${argument} requires a path`);
    if (argument === '--input') inputPaths.push(value);
    else if (argument === '--metadata') metadataPaths.push(value);
    else if (argument === '--output') outputPath = value;
    else if (argument === '--report') reportPath = value;
    else throw new Error(`Unknown argument: ${argument}`);
  }
  if (!inputPaths.length || !metadataPaths.length || !outputPath) throw new Error('--input, --metadata, and --output are required');
  return { inputPaths, metadataPaths, outputPath, reportPath: reportPath ?? `${outputPath}.report.json` };
}

enrichMarcXmlFiles(parseArgs(process.argv.slice(2))).then((report) => {
  console.log(`Wrote ${report.outputRecordCount} matched records: ${report.outputFile}`);
  console.log(JSON.stringify(report.counts));
  if (report.errors.length) { report.errors.forEach((error) => console.error(error)); process.exitCode = 1; }
}).catch((error: unknown) => { console.error(error instanceof Error ? error.message : 'Offline enrichment failed'); process.exitCode = 1; });
