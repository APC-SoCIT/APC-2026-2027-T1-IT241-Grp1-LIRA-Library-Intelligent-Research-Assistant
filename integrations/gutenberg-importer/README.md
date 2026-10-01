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
| --- | --- | --- |
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

The command writes:

- `gutenberg-84-1342-11.marcxml`: MARCXML records for valid books
- `gutenberg-84-1342-11.report.json`: source metadata, duplicate IDs, and per-ID errors

The command returns a non-zero exit code when one or more requested IDs fail, while still writing valid records from the successful IDs. Invalid records are reported rather than silently skipped.

For small or unreliable test imports, keep `--batch-size 1` or `--batch-size 2` to limit concurrent Gutendex requests. The recommended `.env` value is `1`. These settings reduce failures caused by slow responses or service pressure, but cannot prevent external service outages, throttling, or HTTP 5xx responses.

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
| `650$a` | Each subject, with second indicator `0` for non-vernacular terminology |
| `856$u` | At most one `text/html` reading URL followed by one `text/plain` URL |

All Gutendex formats, including RDF, archive, image, EPUB, and Kindle URLs, remain available in the JSON report. Only the first `text/html` URL and first `text/plain` URL are placed in `856` in this initial bibliographic import. No publication, ISBN, edition, or other metadata is invented.

## Koha staging workflow

1. Run the CLI and inspect the MARCXML and report.
2. Open the Koha staff interface's staged MARC management workflow.
3. Upload the generated `.marcxml` file.
4. Select the `GUTENBERG` matching rule during staging.
5. Review the match and import preview manually.
6. Confirm the import only after reviewing duplicates and field mappings.

The importer never performs these Koha steps automatically. The `(PG){id}` value must remain unchanged because it is the identifier used by the tested matching rule. A matching identifier does not by itself guarantee a match in every Koha staging context.

## Tests

Tests use mocked Gutendex responses and do not contact Gutendex or Koha:

```powershell
npm test
npm run build
```

Coverage includes malformed and missing metadata, Unicode and XML escaping, multiple authors and subjects, MARC indicators, stable control numbers, `035$a`, duplicate IDs, cached requests, HTTP errors, timeouts, and MARCXML structure validation.

## Limitations

- Only explicit Gutenberg IDs are supported initially.
- No collection pagination or entire-catalog import is implemented.
- No automated Koha import or replacement is implemented.
- The MARC mapping is intentionally limited to metadata supplied by Gutendex.
- Copyright is retained as source metadata and is not treated as a legal determination.