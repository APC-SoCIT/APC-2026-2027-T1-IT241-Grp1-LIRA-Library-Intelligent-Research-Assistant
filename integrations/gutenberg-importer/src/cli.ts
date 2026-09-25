/// <reference types="node" />

import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { readConfig } from './config.js';
import { GutendexClient } from './gutendex/gutendex.client.js';
import { GutenbergImporter, ImportResult } from './importer.js';
import { recordsToMarcXml } from './marc/marcxml-writer.js';
import { validateMarcXml } from './marc/validate-marcxml.js';

interface CliOptions {
  ids: number[];
  outputDir?: string;
  batchSize?: number;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const config = readConfig();
  const outputDir = resolve(options.outputDir ?? config.outputDir);
  const importer = new GutenbergImporter(new GutendexClient({ baseUrl: config.baseUrl, timeoutMs: config.timeoutMs }));
  const result = await importer.import(options.ids, options.batchSize ?? config.batchSize);
  const xml = recordsToMarcXml(result.records);
  validateMarcXml(xml, result.records.length);
  await mkdir(outputDir, { recursive: true });
  const stem = `gutenberg-${options.ids.join('-')}`;
  const xmlPath = resolve(outputDir, `${stem}.marcxml`);
  const reportPath = resolve(outputDir, `${stem}.report.json`);
  await writeFile(xmlPath, xml, 'utf8');
  await writeFile(reportPath, JSON.stringify(toReport(options.ids, result), null, 2), 'utf8');
  console.log(`Generated ${result.records.length} MARCXML record(s): ${xmlPath}`);
  console.log(`Wrote import report: ${reportPath}`);
  if (result.errors.length > 0) {
    for (const error of result.errors) console.error(`ID ${error.id}: ${error.message}`);
    process.exitCode = 1;
  }
}

function parseArgs(args: string[]): CliOptions {
  const ids: number[] = [];
  let outputDir: string | undefined;
  let batchSize: number | undefined;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--help') {
      console.log('Usage: npm run import -- --ids 84,1342,11 [--output-dir ./output] [--batch-size 10]');
      process.exit(0);
    }
    if (argument === '--ids') {
      const value = args[++index];
      if (!value) throw new Error('--ids requires a comma-separated list');
      ids.push(...value.split(',').map(parseId));
    } else if (argument === '--output-dir') {
      outputDir = args[++index];
      if (!outputDir) throw new Error('--output-dir requires a path');
    } else if (argument === '--batch-size') {
      batchSize = parsePositiveInteger(args[++index], '--batch-size');
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }
  if (ids.length === 0) throw new Error('At least one Gutenberg ID is required; use --ids 84,1342,11');
  return { ids, outputDir, batchSize };
}

function parseId(value: string): number {
  return parsePositiveInteger(value, 'Gutenberg ID');
}

function parsePositiveInteger(value: string | undefined, label: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error(`${label} must be a positive integer`);
  return parsed;
}

function toReport(ids: number[], result: ImportResult): object {
  return {
    ids,
    generatedRecords: result.records.length,
    duplicateIds: result.duplicateIds,
    errors: result.errors,
    books: result.books.map((book) => ({ id: book.id, title: book.title, source: book.source })),
  };
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Importer failed');
  process.exitCode = 1;
});