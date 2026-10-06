# LIRA Gutenberg Importer

This standalone TypeScript CLI fetches explicitly selected book metadata from the public Gutendex API, validates and normalizes it, and generates MARC21 Slim XML for manual staging in Koha.

Koha remains the authoritative source of catalog data. This importer does not connect to Koha, does not access MariaDB, and does not automatically create, replace, or import records.

## Installation

Requirements:

- Node.js 20.6.0 or later (`--env-file` is required by the npm scripts)
- npm
- Network access to `https://gutendex.com/`

```powershell
cd integrations/gutenberg-importer
npm install
Copy-Item .env.example .env
```

Run the commands from `integrations/gutenberg-importer`. The `start` and `import` scripts require a local `.env` file. Copy `.env.example` to `.env` before running the CLI. The `.env` file is ignored and must not contain credentials committed to Git.

The scripts load `.env` using Node's `--env-file=.env` flag. Existing process environment variables take precedence over values from `.env`. Supported CLI arguments take precedence over their corresponding settings: `--batch-size` overrides `GUTENBERG_BATCH_SIZE`, and `--output-dir` overrides `GUTENBERG_OUTPUT_DIR`.

The code fallback defaults remain available when configuration is read directly in code or tests:

| Variable | Code fallback | Recommended `.env` value | Purpose |
| --- | --- | --- | --- |
| `GUTENDEX_BASE_URL` | `https://gutendex.com` | `https://gutendex.com` | Gutendex API base URL |
| `GUTENDEX_TIMEOUT_MS` | `30000` | `90000` | Per-attempt request timeout |
| `GUTENDEX_MAX_ATTEMPTS` | `3` | `3` | Maximum attempts including the initial request |
| `GUTENDEX_RETRY_INITIAL_DELAY_MS` | `250` | `5000` | Initial retry backoff |
| `GUTENDEX_RETRY_MAX_DELAY_MS` | `2000` | `15000` | Maximum retry delay |
| `GUTENBERG_OUTPUT_DIR` | `./output` | `./output` | Output directory |
| `GUTENBERG_BATCH_SIZE` | `10` | `1` | Concurrent requests per batch |

## CLI usage

Build and generate MARCXML for the initial verification IDs:

```powershell
npm run import -- --ids 84,1342,11 --output-dir ./output --batch-size 3
```

To apply curated LIRA subjects from a JSON map:

```powershell
npm run import -- --ids 57628,22657,71292,6737,168,51676,20239,3300,38269 --subject-map ./examples/subjects.json --output-dir ./output/curated-subjects --batch-size 1
```

The subject map is a JSON object keyed by positive Gutenberg ID. Each value is a nonempty array of subject strings:

```json
{
	"57628": ["Psychology"],
	"22657": ["Engineering"],
	"71292": ["Computer science"]
}
```

The controlled LIRA category vocabulary is:

```text
Psychology
Engineering
Computer Science
Literature
Photography
Accounting
Architecture
Business & Economics
History
```

Whitespace is trimmed, category matching is case-insensitive, and duplicate values are removed after trimming. Values are emitted using the canonical spelling above. Unknown categories, malformed JSON, invalid IDs, empty arrays, and empty strings stop the command with a clear error. Mappings for IDs not selected by `--ids` have no effect.

The command writes:

- `gutenberg-84-1342-11.marcxml`: MARCXML records for valid books
- `gutenberg-84-1342-11.report.json`: source metadata, duplicate IDs, and per-ID errors

The command returns a non-zero exit code when one or more requested IDs fail, while still writing valid records from the successful IDs. Invalid records are reported rather than silently skipped.

For small or unreliable test imports, keep `--batch-size 1` or `--batch-size 2` to limit concurrent Gutendex requests. The recommended `.env` value is `1`. These settings reduce failures caused by slow responses or service pressure, but cannot prevent external service outages, throttling, or HTTP 5xx responses.

## Offline MARCXML categorization

Existing MARCXML can be categorized without contacting Gutendex or Koha. The command accepts one or more repeated `--input` paths, a controlled subject map, and a separate output path:

```powershell
npm run categorize -- --input ./output/gutenberg-50-batch/lira-gutenberg-50-records.marcxml --input ./output/gutenberg-84-1342-11.marcxml --subject-map ./examples/subjects.json --output ./output/categorized/lira-gutenberg-52-existing-categorized.marcxml --report ./output/categorized/lira-gutenberg-52-existing-categorized.report.json
```

The command preserves complete source records and existing `650` fields, identifies records through `001` and `035$a`, verifies those identifiers agree, deduplicates identical records shared across input files, and rejects materially conflicting duplicates. It never overwrites an input path. A record without a required category mapping also fails the command rather than producing incomplete output.

The audit report records input files, input and unique record counts, duplicate and conflicting IDs, unmapped IDs, informational `unusedMappingIds`, assigned `appliedCategories`, newly appended `addedCategories`, category totals, and errors. A source Gutendex `650 #0` never suppresses the mapped local `650 #4`; only an existing equivalent local `650 #4` prevents a duplicate local field. Generated MARCXML and reports remain under ignored `output/` directories.

The canonical `examples/subjects.json` contains all 61 selected records. The nine-record run reports 52 informational unused mapping IDs; the existing-record run reports 9. Missing mappings for input records remain fatal.

For the nine newly fetched records, reuse `examples/subjects.json` and keep the output separate from the existing-record overlay:

```powershell
npm run categorize -- --input ./output/subject-starter/gutenberg-57628-22657-71292-6737-168-51676-20239-3300-38269.marcxml --input ./output/subject-retry/gutenberg-22657-71292-6737-168-51676-20239-3300-38269.marcxml --subject-map ./examples/subjects.json --output ./output/categorized/lira-gutenberg-9-new-categorized.marcxml --report ./output/categorized/lira-gutenberg-9-new-categorized.report.json
```

The two input files contain 9 records in total and produce 9 unique categorized records. The existing-record inputs contain 53 record occurrences because PG84 is present in both files; they must produce 52 unique records.

## Mapping

Each record receives a stable identifier derived from the Gutenberg ID:

| MARC field | Mapping |
| --- | --- |
| `001` | `PG{Gutenberg ID}` |
| `035$a` | `(PG){Gutenberg ID}`; required for the tested Koha `GUTENBERG` matching rule |
| `100$a` | First author, when present |
| `245$a` | Full Gutendex title |
| `245` indicators | First indicator `1` when `100` exists, otherwise `0`; second indicator accounts for leading `A`, `An`, or `The` |
| `700$a` | Additional authors |
| `041$a` | Known ISO-639-1 languages converted to MARC three-letter codes; unknown values are retained unchanged |
| `520$a` | Each summary |
| `650$a` | Each original Gutendex subject, with second indicator `0` |
| `650$a` | Each applicable curated LIRA subject, appended after source subjects with second indicator `4` (source not specified) |
| `856$u` | At most one `text/html` reading URL followed by one `text/plain` URL |

All Gutendex formats, including RDF, archive, image, EPUB, and Kindle URLs, remain available in the JSON report. Only the first `text/html` URL and first `text/plain` URL are placed in `856` in this initial bibliographic import. No publication, ISBN, edition, or other metadata is invented.

Curated LIRA subjects are topical or academic labels, so they are stored as additional `650` fields rather than `655` genre fields. The `650` second indicator `4` identifies the subject source as unspecified instead of falsely labeling these local curation values as Library of Congress Subject Headings. Original Gutendex subjects are preserved. A curated subject is not added when the same trimmed value already exists in the source subjects, compared case-insensitively.

The JSON report includes an `curatedSubjects` object keyed by successfully generated Gutenberg ID, containing the curated subjects actually applied after duplicate suppression.

## Koha staging workflow

For the 52-record overlay:

1. Inspect the categorized MARCXML and audit report.
2. Open Koha's staged MARC management workflow and upload only `lira-gutenberg-52-existing-categorized.marcxml`.
3. Select the `GUTENBERG` matching rule.
4. Confirm Koha reports exactly 52 matches and 0 new records.
5. Enable the option to replace matching bibliographic records.
6. Preserve or ignore existing items rather than replacing them.
7. Review representative MARC previews and stop if any record is classified as new.

The nine-record categorized output is a separate new-record import and must not be combined with the 52-record overlay file.

The importer never performs these Koha steps automatically. The `(PG){id}` value must remain unchanged because it is the identifier used by the tested matching rule. A matching identifier does not by itself guarantee a match in every Koha staging context.

## Tests

Tests use mocked Gutendex responses and do not contact Gutendex or Koha:

```powershell
npm test
npm run build
```

Coverage includes malformed and missing metadata, Unicode and XML escaping, multiple authors and subjects, MARC indicators, stable control numbers, `035$a`, duplicate IDs, cached requests, HTTP errors, timeouts, and MARCXML structure validation.

Subject-map coverage includes JSON validation, whitespace trimming, duplicate removal, source-subject preservation, curated `650` fields, multiple curated subjects, unrelated IDs, and report output.

## Limitations

- Only explicit Gutenberg IDs are supported initially.
- No collection pagination or entire-catalog import is implemented.
- No automated Koha import or replacement is implemented.
- The MARC mapping is intentionally limited to metadata supplied by Gutendex.
- Copyright is retained as source metadata and is not treated as a legal determination.