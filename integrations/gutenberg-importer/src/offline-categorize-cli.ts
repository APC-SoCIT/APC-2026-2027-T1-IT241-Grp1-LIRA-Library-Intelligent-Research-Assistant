import { categorizeMarcXmlFiles } from './offline-categorize.js';
import { CategorizeOptions } from './offline-categorize.js';

function parseArgs(args: string[]): CategorizeOptions {
  const inputPaths: string[] = [];
  let subjectMapPath: string | undefined;
  let outputPath: string | undefined;
  let reportPath: string | undefined;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--input') inputPaths.push(requireArgument(args[++index], '--input'));
    else if (argument === '--subject-map') subjectMapPath = requireArgument(args[++index], '--subject-map');
    else if (argument === '--output') outputPath = requireArgument(args[++index], '--output');
    else if (argument === '--report') reportPath = requireArgument(args[++index], '--report');
    else if (argument === '--help') {
      console.log('Usage: npm run categorize -- --input file1.marcxml --input file2.marcxml --subject-map ./examples/existing-subjects.json --output ./output/categorized/output.marcxml [--report ./output/categorized/output.report.json]');
      process.exit(0);
    } else throw new Error(`Unknown argument: ${argument}`);
  }
  if (inputPaths.length === 0) throw new Error('At least one --input MARCXML file is required');
  if (!subjectMapPath) throw new Error('--subject-map is required');
  if (!outputPath) throw new Error('--output is required');
  return { inputPaths, subjectMapPath, outputPath, reportPath: reportPath ?? `${outputPath}.report.json` };
}

function requireArgument(value: string | undefined, argument: string): string {
  if (!value) throw new Error(`${argument} requires a path`);
  return value;
}

categorizeMarcXmlFiles(parseArgs(process.argv.slice(2))).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Offline categorization failed');
  process.exitCode = 1;
});