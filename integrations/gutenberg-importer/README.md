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

All generation, categorization, and enrichment outputs are created exclusively. Existing files (including input aliases) are never overwritten. Choose a fresh output directory or filename for each run. Commands, retries, batching, and `.env` precedence remain the same; generation additionally accepts `--publication-map` and enrichment has its own offline `enrich` command.

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
| `856 40 $u$q$y` | Each supported source-supplied HTML, plain text, EPUB, and PDF reading URL, with normalized MIME and link text |
| `856 42 $3$u$q$y` | Confirmed Gutenberg cache cover entry; `$3` and `$y` are `Cover image`, never a full-book reading resource |
| `264 #1$c` | Optional verified cataloged-edition publication date from the separate publication map |
| `008/06-14` | Same optional edition date, preserving year/month/day precision |
| `500$a` | Qualified supplemental date meaning, precision, edition identity where applicable, and source reference |

All raw Gutendex formats, including unsupported RDF, archive, Kindle, and unconfirmed image URLs, remain in each report book's `source`. `resources` lists mapped links with source MIME, normalized MIME, label, and explicit reading/cover role. `omittedFormats` explains unsupported, invalid, and conflicting entries. No URLs or formats are inferred from filenames, descriptions, or opaque hashes. No attachment or image is downloaded or uploaded.

MIME parameters are removed from `$q`, and HTTP(S) URLs must parse without credentials, whitespace, backslashes, or control characters. Duplicate URLs are compared after normal URL serialization and fragment removal; the supplied URL is retained for display. Conflicting MIME declarations for the same URL are omitted and reported. Deterministic order is HTML, plain text, EPUB, PDF, then covers, with URLs sorted within each type. All distinct URLs of a supported type are retained, so HTML remains first even if there are multiple charset variants.

The cover convention recognizes only `image/jpeg` URLs actually supplied by Gutendex on `gutenberg.org`/`www.gutenberg.org` with the exact `/cache/epub/{id}/pg{id}.cover.medium.jpg` or `.cover.small.jpg` entry for that book, without query/fragment. It does not promote arbitrary images, illustrations, alternate hosts, or another book's cover. These named entries were checked against the live PG1342 Gutendex formats and Gutenberg RDF metadata; Gutendex exposes no independent image-role field. The conservative `856 42` relationship marks a related image separately; image MIME and `$3`/`$y` identify the cover. Missing or unconfirmed covers remain absent and appear in `missingMetadata`.

This follows [MARC 856](https://www.loc.gov/marc/bibliographic/bd856.html): HTTP uses indicator 1 `4`, complete electronic reading resources use indicator 2 `0`, related resources use `2`, `$q` supplies MIME, `$y` supplies link text, and `$3` specifies materials.

Curated LIRA subjects are topical or academic labels, so they are stored as additional `650` fields rather than `655` genre fields. The `650` second indicator `4` identifies the subject source as unspecified instead of falsely labeling these local curation values as Library of Congress Subject Headings. Original Gutendex subjects are preserved. An identical source `650 #0` never suppresses a local `650 #4`; only an equivalent existing local category prevents another local field. The canonical 61-ID `examples/subjects.json` is unchanged.

The JSON report includes a `curatedSubjects` object keyed by successfully generated Gutenberg ID, containing the curated subjects actually applied after duplicate suppression. The expanded report uses `schemaVersion: 1` and can be supplied to offline enrichment.

## Publication metadata

The [documented Gutendex Book schema](https://gutendex.com/) and [serializer](https://github.com/garethbjohnson/gutendex/blob/master/books/serializers.py) supply no publication, release, or update dates. A read-only PG1342 metadata check confirmed that omission. Author birth/death years are person metadata. Dates embedded in summaries are not publication evidence. The [Gutenberg bibliographic help](https://www.gutenberg.org/help/bibliographic_record.html#metadata-fields) distinguishes print-source information from Gutenberg release dates, which concern the digital publication. Nothing is scraped from descriptions, attachments, file timestamps, or the current year.

Use an optional, manually verified publication map, separate from `examples/subjects.json`. Start with `examples/publication-template.json` (empty; it invents no dates). Schema:

```json
{
  "version": 1,
  "books": {
    "900001": {
      "dates": [
        {
          "meaning": "edition-publication",
          "date": "1901",
          "edition": "Cataloged edition identified from its title page",
          "source": "https://example.test/verified-title-page"
        }
      ]
    }
  }
}
```

This schema illustration uses a fictional ID/date/reference; do not use it as bibliographic evidence. Replace it with evidence for the edition the Koha record actually describes. A print source used for digitization is not automatically the cataloged digital edition. Source references must be valid HTTP(S) URLs without credentials; they are retained for review, not fetched or verified automatically.

Accepted meanings: `edition-publication`, `original-work-publication`, `gutenberg-release`, `gutenberg-update`. Each book needs a nonempty `dates` array, at most one entry per meaning. `edition-publication` requires a nonempty `edition` description. Unknown keys, invalid IDs, invalid calendar dates, missing provenance, duplicate/conflicting meanings, edition labels on other meanings, original-work dates definitively later than edition dates, and Gutenberg updates definitively before release fail validation before fetching. Date chronology is checked only when supplied precision ranges do not overlap. Only exact CE `YYYY`, `YYYY-MM`, or `YYYY-MM-DD` dates are accepted; circa dates, ranges, and uncertain dates remain outside this small schema and must be cataloged manually.

Only `edition-publication` populates [264 #1$c](https://www.loc.gov/marc/bibliographic/bd264.html). [008](https://www.loc.gov/marc/bibliographic/bd008a.html) gets `s` plus year and blank Date 2 for a year, or `e` plus year and `MMDD` for a detailed date (blank day positions for month precision). The other 008 positions do not invent publication facts. A known year never becomes January 1. Other date meanings become explicit provenance-bearing `500` notes and never substitute for edition publication or populate its fixed dates. All supplemental dates and missing meanings appear in the report. Without an edition date, new records have no invented 264/008 publication date.

```powershell
# From integrations/gutenberg-importer; requires the existing .env file.
Copy-Item ./examples/publication-template.json ./publication.local.json
# Edit publication.local.json only after checking edition evidence.
npm.cmd run import -- --ids 1342 --subject-map ./examples/subjects.json --publication-map ./publication.local.json --output-dir ./output/new-with-dates --batch-size 1
```

## Offline enrichment of exported Koha records

Use full Koha MARCXML exports as the authoritative record base. Fresh Gutendex records contain no manually uploaded attachment URLs, edited descriptions, local notes, or item fields and must not replace existing records directly. `enrich` makes no network requests and reads newly generated `schemaVersion: 1` reports; older reports must be regenerated with the expanded importer.

```powershell
# Generate source metadata/new-record MARCXML into a separate, fresh directory.
npm.cmd run import -- --ids 1342,84,11 --subject-map ./examples/subjects.json --output-dir ./output/new-reader --batch-size 1

# Manually export the corresponding complete Koha records to ./exports/koha-books.marcxml.
# Include 035, complete 856 fields, all local fields, and item-related fields.
npm.cmd run enrich -- --input ./exports/koha-books.marcxml --metadata ./output/new-reader/gutenberg-1342-84-11.report.json --output ./output/enriched-reader/koha-books.marcxml --report ./output/enriched-reader/audit.json

# Repeating enrichment into different files must add zero changes.
npm.cmd run enrich -- --input ./output/enriched-reader/koha-books.marcxml --metadata ./output/new-reader/gutenberg-1342-84-11.report.json --output ./output/enriched-repeat/koha-books.marcxml --report ./output/enriched-repeat/audit.json
```

Repeat `--input` and `--metadata` for multiple exports/reports. Output contains matched, conflict-free existing records only, both enriched and unchanged. Unmatched exports and metadata are reported and never converted into new records in the enrichment output. New-record MARCXML stays in its generation directory. Every output path must be unused, including audit paths; structural failures write an audit but no MARCXML.

Matching reads all repeated `035$a` entries, ignoring unrelated agency identifiers, and primarily uses exact `(PG){id}`. `PG{id}` in `001` is a fallback only when that identifier is unambiguous; a numeric Koha `001` is never treated as a Gutenberg ID. A fallback adds the stable 035 for later matching while keeping 001 unchanged. Conflicting identifiers, multiple 001 fields, multiple distinct exported records for one PG ID, repeated Koha identities with material differences, and materially conflicting generated duplicates are withheld. Completely identical exports/reports are deduplicated. Export signatures retain local categories and every field value; a local-category difference counts as material.

The merge keeps the exported leader, 001, 005, 035, edited descriptions, original subjects, all existing resource fields, notes, 952 items, 999 identity, and unknown fields/subfields. It adds missing source URLs, confirmed covers, and missing controlled `650 #4` categories. For an existing URL, missing `$q`/`$y` may be added only from explicit source MIME metadata. A manual Koha upload URL with an opaque ID is preserved in full and gets no inferred MIME from its filename, label, hash, or another URL. Equivalent local categories are compared case-insensitively after trimming; source `650 #0` does not suppress them.

Dates are additive too: an existing 260/264 publication date or meaningful 008 date code is preserved. Absent publication dates can be added to a single unambiguous publication statement; unknown 008 date positions can be filled while preserving the other positions. Different date values, precision, meaning, invalid fixed fields, ambiguous publication statements, conflicting resource MIME/labels, repeated URL fields, and multi-destination associations are reported. Existing empty subfields are conservatively sent for manual review rather than replaced. Other existing descriptive fields are never compared for automatic replacement or overwritten.

There is no automatic conflict-override flag. Resolve conflicts by reviewing evidence and explicitly correcting copies of the relevant export or supplemental mapping, then rerun into fresh outputs. Inputs remain untouched. On a per-record conflict, all proposed changes are withheld: the audit has `appliedChanges: []`, and that record is excluded from output. The CLI exits nonzero when records or generated metadata conflict; it still writes conflict-free matched records for review. Never stage a partial run without accounting for withheld records.

The audit distinguishes `matched` from each record's `enriched`, `unchanged`, `unmatched`, or `conflicting` status, records identity/match method, and lists `proposedChanges`, `appliedChanges`, conflict reasons, identical duplicates, unmatched generated IDs, and material duplicate IDs. XML whitespace/namespace serialization may change; bibliographic values and untouched fields are preserved, not reconstructed.

## Koha staging workflow

This is a manual handoff only; no staging or import is performed by this project change. Follow the [Koha staging documentation](https://koha-community.org/manual/latest/en/html/cataloging.html#staging-records-for-import):

1. Export a fresh backup of the complete current records. Generate metadata separately, enrich the export, and review every audit conflict and proposed change. Keep new-record output separate. Do not use the historical 52-record generation/category overlay to replace records that have since acquired manual fields.
2. Compare the enrichment output to the export, checking complete manual PDF/EPUB 856 fields, local identity/notes, verified dates, edited descriptive fields, categories, and item fields. Account for unmatched/withheld records. If Koha changed after export, export and enrich again before replacement.
3. Stage only the reviewed enrichment MARCXML with UTF-8/MARCXML settings and the site's `GUTENBERG` matching rule on `035$a`. Do not apply a modification template that strips preserved fields. Use the action to ignore incoming records when there is no match, and ignore items/preserve existing items rather than adding or replacing them.
4. Inspect the staging summary and match previews **before approving replacement**: zero MARC errors, exactly `outputRecordCount` matches, zero new records, and the expected Koha identities. Stop on unexpected or multiple matches. A stable identifier alone does not guarantee correct matching in every Koha configuration.
5. Only after reviewing those matches and preserved fields, manually select replacement of matching bibliographic records, with items ignored. Recheck representative catalog/MARC records afterward. The importer never carries out this approval or Koha write.

For genuine new-record imports, review the separate generated new-record MARCXML and exclude IDs already present in Koha. Never mix it with enrichment output.

## Tests

Tests use mocked Gutendex responses and do not contact Gutendex or Koha:

```powershell
npm test
npm run build
```

Coverage includes malformed and missing metadata, Unicode and XML escaping, multiple authors and subjects, MARC indicators, stable control numbers, `035$a`, duplicate IDs, cached requests, HTTP errors, timeouts, and MARCXML structure validation.

Subject-map coverage includes JSON validation, whitespace trimming, duplicate removal, source-subject preservation, curated `650` fields, multiple curated subjects, unrelated IDs, and report output.

Reader/enrichment tests add MIME parameters, URL validation, duplicate/order behavior, missing/present confirmed covers, date meaning/provenance/precision, conflicting dates, complete Koha attachment/local/item field preservation, repeated/ambiguous identifiers, conflicting duplicates, namespace/Unicode escaping, exclusive outputs (including hardlink aliases), and zero-change repeated enrichment. Source calls are mocked and use local fixtures; tests make no Koha calls.

For reviewable sample files from offline fixtures:

```powershell
npm.cmd run example:reader -- --output-dir ./output/reader-example
```

This writes generated MARCXML/report and enriched MARCXML/audit. The fixture's reading/cover URLs follow the checked PG1342 source entries; its Koha attachment/identity fields are deliberately fictional. **Do not stage these example files.** See [READER_HANDOFF.md](READER_HANDOFF.md) for representative entries and validation results.

## Limitations

- Only explicit Gutenberg IDs are supported initially.
- No collection pagination or entire-catalog import is implemented.
- No automated Koha import or replacement is implemented.
- The MARC mapping is intentionally limited to metadata supplied by Gutendex.
- Gutendex does not supply original-work publication, cataloged-edition publication, Gutenberg release/update dates, ISBN/edition provenance, or manually added Koha fields through this importer contract. Unknown dates remain unknown unless verified supplemental metadata is provided.
- Cover metadata is carried only. Catalog cover functionality remains outstanding: the backend must recognize the related 856 cover convention, expose a cover URL/role separately from reading resources, and apply image/destination policy. The frontend must render that field with missing-image handling; extraction, thumbnails, image proxying, and display are not implemented here.
- Date display remains a backend/frontend handoff: the current catalog contract exposes `publicationYear`, not distinct original/edition/Gutenberg dates with full precision and provenance. Koha field mapping and catalog responses must be verified before display; the frontend must label date meaning and handle unknown dates without invented fallbacks.
- Copyright is retained as source metadata and is not treated as a legal determination.
