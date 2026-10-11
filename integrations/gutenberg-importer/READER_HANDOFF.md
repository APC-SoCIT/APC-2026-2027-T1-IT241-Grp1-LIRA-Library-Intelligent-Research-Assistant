# Reader metadata and offline enrichment handoff

Changes are confined to `integrations/gutenberg-importer` on `main`. No commits, pushes, deployments, Koha imports, attachment downloads, or Koha writes were performed. Reader retrieval/backend code is outside this change.

## Files changed

- `src/resource-mapping.ts`, `src/gutendex/normalize-book.ts`, `src/marc/marc.types.ts`: validated MIME-keyed resources, deterministic HTML-first order, deduplication, and separate confirmed covers.
- `src/publication-map.ts`, `examples/publication-template.json`, `src/importer.ts`, `src/report.ts`, `src/cli.ts`: optional validated dates with meaning/provenance, precise MARC dates, missing-metadata reporting, and the existing generator CLI.
- `src/offline-enrich.ts`, `src/enrich-record.ts`, `src/enrichment-metadata.ts`, `src/offline-enrich-cli.ts`: additive offline enrichment, safe identifier matching, field preservation, conflict rejection, and audit output.
- `src/marc/marcxml-reader.ts`, `src/marc/validate-marcxml.ts`, `src/output-files.ts`, `src/offline-categorize.ts`: shared strict XML parsing/serialization, reused categorization utilities, and exclusive output writes. Existing offline category semantics remain covered by their tests.
- `src/reader-example-cli.ts`, `package.json`: reproducible offline example and enrichment commands, without changes to existing commands or `.env` precedence.
- `test/resources-dates.test.ts`, `test/offline-enrich.test.ts`, `test/fixture-handoff.test.ts`, `test/fixtures/*`, existing MARC/importer assertions, and `README.md`: focused verification, local fixtures, and usage/staging documentation.

The canonical `examples/subjects.json`, existing category mappings, batching, retries, and configuration defaults are unchanged.

## Examples

Run from the importer directory in PowerShell:

```powershell
npm.cmd run example:reader -- --output-dir ./output/reader-example
```

This is fully offline: it mocks Gutendex with `test/fixtures/gutendex-reader.json` and uses a fictional Koha export in `test/fixtures/koha-export.marcxml`. The source reading/cover URLs reflect the inspected PG1342 metadata. Its manual Koha URLs, local fields, and identity are fixtures. Do not stage these example records.

Generated source reading and cover fields:

```xml
<datafield tag="856" ind1="4" ind2="0">
  <subfield code="u">https://www.gutenberg.org/ebooks/1342.html.images</subfield>
  <subfield code="q">text/html</subfield>
  <subfield code="y">Read online</subfield>
</datafield>
<datafield tag="856" ind1="4" ind2="0">
  <subfield code="u">https://www.gutenberg.org/ebooks/1342.txt.utf-8</subfield>
  <subfield code="q">text/plain</subfield>
  <subfield code="y">Plain text</subfield>
</datafield>
<datafield tag="856" ind1="4" ind2="0">
  <subfield code="u">https://www.gutenberg.org/ebooks/1342.epub3.images</subfield>
  <subfield code="q">application/epub+zip</subfield>
  <subfield code="y">EPUB</subfield>
</datafield>
<datafield tag="856" ind1="4" ind2="2">
  <subfield code="3">Cover image</subfield>
  <subfield code="u">https://www.gutenberg.org/cache/epub/1342/pg1342.cover.medium.jpg</subfield>
  <subfield code="q">image/jpeg</subfield>
  <subfield code="y">Cover image</subfield>
</datafield>
```

No PDF is generated for this fixture because the source did not supply one. An explicitly supplied `application/pdf` entry maps to a separate `856 40` with `$q=application/pdf` and `$y=PDF`, covered by the MIME tests. All unsupported Kindle/RDF/archive entries remain in `source.formats` and `omittedFormats`.

Representative generated report entries (excerpts):

```json
{
  "schemaVersion": 1,
  "resources": [
    {
      "url": "https://www.gutenberg.org/ebooks/1342.epub3.images",
      "mediaType": "application/epub+zip",
      "label": "EPUB",
      "role": "reading",
      "source": "Gutendex formats[\"application/epub+zip\"]",
      "sourceMediaType": "application/epub+zip"
    },
    {
      "url": "https://www.gutenberg.org/cache/epub/1342/pg1342.cover.medium.jpg",
      "mediaType": "image/jpeg",
      "label": "Cover image",
      "role": "cover",
      "source": "Gutendex formats[\"image/jpeg\"]",
      "sourceMediaType": "image/jpeg"
    }
  ],
  "publicationDates": [],
  "missingMetadata": ["edition-publication", "original-work-publication", "gutenberg-release", "gutenberg-update"]
}
```

In the actual report, `schemaVersion` is at the root and the other fields above are inside `books[0]`. A book with no confirmed cover also reports `cover` in `missingMetadata` and a warning. Supplemental date examples/schema are in [README.md](README.md#publication-metadata); no date is guessed for PG1342 from its summary or author dates.

The fixture enrichment preserves Koha `001=440`, unrelated 035, the edited 245 subtitle, notes, complete manual PDF and EPUB 856 fields, 952, 999, and unknown 987. The opaque manual EPUB URL remains without `$q`; its label is not evidence for assigning a MIME. It fills the source HTML `$q`/`$y`, adds three absent source URLs (text, EPUB, cover), and adds local `650 #4 Literature` despite existing source `650 #0 Literature`.

Representative audit excerpt:

```json
{
  "counts": { "matched": 1, "unmatched": 0, "enriched": 1, "unchanged": 0, "conflicting": 0 },
  "koha001": "440",
  "gutenbergId": 1342,
  "matchMethod": "035$a",
  "status": "enriched",
  "proposedChanges": [
    { "field": "856$q", "action": "add-subfield", "value": "text/html", "source": "Gutendex formats[\"text/html\"]" },
    { "field": "856$y", "action": "add-subfield", "value": "Read online", "source": "Gutendex formats[\"text/html\"]" }
  ],
  "conflicts": []
}
```

The actual identity/change fields are inside `records[0]`, and its full audit lists all six changes, including complete added 856 field proposals. `appliedChanges` lists those applied to the output only. Conflicting records have no applied changes and are withheld from MARCXML. Counts can include both `matched` and `conflicting` for a unique match with incompatible field metadata.

## Commands for the real handoff

From the repository root:

```powershell
Set-Location ./integrations/gutenberg-importer
# First setup only, if .env does not already exist:
if (-not (Test-Path -LiteralPath .env)) { Copy-Item .env.example .env }

# Fetch selected metadata only; write new records separately.
npm.cmd run import -- --ids 1342,84,11 --subject-map ./examples/subjects.json --output-dir ./output/new-reader --batch-size 1

# After manually exporting full current Koha records to this local path:
npm.cmd run enrich -- --input ./exports/koha-books.marcxml --metadata ./output/new-reader/gutenberg-1342-84-11.report.json --output ./output/enriched-reader/koha-books.marcxml --report ./output/enriched-reader/audit.json

# Offline idempotence verification into new output paths:
npm.cmd run enrich -- --input ./output/enriched-reader/koha-books.marcxml --metadata ./output/new-reader/gutenberg-1342-84-11.report.json --output ./output/enriched-repeat/koha-books.marcxml --report ./output/enriched-repeat/audit.json

npm.cmd test
npm.cmd run build
git diff --check
```

All output paths must be unused; select fresh paths on subsequent generation runs. Add `--publication-map ./publication.local.json` only after manually recording evidence for the cataloged edition using the documented schema. Do not supply the category map as a publication map. Enrichment and example commands need no `.env` and make no network calls.

## Manual staging review

No Koha actions were carried out. The later operator must review the audit and compare output to the complete fresh export before staging. Specifically inspect stable `(PG)` matches and Koha identity, complete manual attachment fields, verified dates, edited descriptions, notes, local fields, categories, and item data. Refresh the export if Koha changed after it was taken.

Stage only the reviewed **enrichment** file with the site's `GUTENBERG` matching rule on 035$a. Set unmatched incoming records to be ignored and ignore item imports so current items are preserved. Inspect the staging previews before approving replacement: require zero MARC errors, exactly the reported output record count in matches, zero new records, and the intended existing identities. Resolve unexpected matches or withheld conflicts first. Only then may the operator approve replacement of matched bibliographic records. Keep genuine new-record staging separate. Details and official Koha/MARC references are in [README.md](README.md#koha-staging-workflow).

## Validation and remaining work

Local validation: 53 offline tests pass, TypeScript build passes, and `git diff --check` passes. The fixture example enriches one record; repeating enrichment produces `enriched: 0`, `unchanged: 1`, and an empty change list. Tests include actual file outputs and complete field comparisons, mocked requests, duplicate/identity conflicts, date provenance/precision conflicts, category behavior, Unicode/namespace escaping, and overwrite protection. No live Koha write/staging test or deployment test was performed.

A read-only source inspection of Gutendex PG1342 plus Gutenberg RDF confirmed available MIME URLs and named cover entries, and the absence of all four date meanings in the Gutendex response. This is a source-contract check, not validation of publication dates or a Koha integration run. Tests and examples remain offline.

Outstanding metadata/functionality:

- Original-work publication, cataloged-edition publication, and Gutenberg release/update dates are unavailable from the current Gutendex response. A date in a generated summary is not evidence. Verified supplemental values can be carried; missing dates still require bibliographic research.
- Gutendex does not supply manual Koha attachments, local notes, item fields, or edits; a complete export is required to preserve those. URLs and formats of opaque uploads are never guessed.
- ISBN and edition provenance are outside the source mapping. Gutendex images have no explicit cover-role field; only the confirmed named Gutenberg cache entries are promoted. Other images need reliable role evidence first.
- Catalog cover extraction/role mapping, separate cover API metadata, image/destination policy, and frontend display/fallback handling remain outstanding. No extraction, thumbnails, proxying, or cover display was implemented.
- Catalog date API/display needs separate meanings, precision, and provenance beyond its current `publicationYear` field, plus verification of Koha 264/008 mappings. Missing dates must remain visibly unknown. Backend/frontend work and deployed reader checks remain separate from this importer change.
