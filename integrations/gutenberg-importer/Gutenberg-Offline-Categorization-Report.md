# Gutenberg Importer Categorization Report

Date: 2026-10-01

## Repository State

- Branch: `dev`
- HEAD: `6fdcc65` (`fix: load Gutenberg importer environment configuration`)
- Existing subject-map work was extended rather than duplicated.
- No commit or push was performed.
- No Gutendex or Koha access was performed during the offline categorization work.

## Implemented Changes

- Added controlled LIRA category validation for the nine allowed values:
  - Psychology
  - Engineering
  - Computer Science
  - Literature
  - Photography
  - Accounting
  - Architecture
  - Business & Economics
  - History
- Preserved import-time `--subject-map` support.
- Added the offline `categorize` npm script.
- Added offline multi-file MARCXML categorization.
- Added duplicate Gutenberg ID detection and material-conflict detection.
- Added `001` and `035$a` identifier validation.
- Added audit reports with input counts, duplicate IDs, conflicts, unmapped IDs, unused mappings, assigned categories, appended categories, totals, and errors.
- Added tests for controlled values, invalid maps, duplicates, conflicts, identifiers, source-subject preservation, and exact record totals.
- Updated the README with offline usage and Koha overlay guidance.

## Mapping Files

Existing nine-record map:

[examples/subjects.json](examples/subjects.json)

Canonical map:

[examples/subjects.json](examples/subjects.json)

The canonical map contains 61 unique Gutenberg IDs. Its complete totals are:

- Literature: 49
- History: 4
- Psychology: 2
- Engineering: 1
- Computer Science: 1
- Photography: 1
- Accounting: 1
- Architecture: 1
- Business & Economics: 1

PG84 appears in both existing MARCXML inputs but appears only once in `subjects.json`.

## MARC Behavior

Original Gutendex subjects are preserved as existing `650` fields with second indicator `0`.

Curated LIRA categories are appended as topical subjects:

```xml
<datafield tag="650" ind1=" " ind2="4">
  <subfield code="a">Literature</subfield>
</datafield>
```

The first indicator is blank and the second indicator is `4`, representing a locally assigned or unspecified subject source. Categories are never written as `655` genre fields.

Category values are trimmed, validated against the controlled vocabulary, canonicalized, and deduplicated case-insensitively. Existing source subjects are not removed or renamed.

When a source Gutendex `650 #0` subject already equals the assigned category, the mapped local `650 #4` is still added. Duplicate prevention applies only to an equivalent existing local `650 #4`. The audit report distinguishes:

- `appliedCategories`: categories assigned to records.
- `addedCategories`: new local `650 #4` fields physically appended.

## Generated Existing-Record Output

Inputs:

- `output/gutenberg-50-batch/lira-gutenberg-50-records.marcxml`
- `output/gutenberg-84-1342-11.marcxml`

PG84 was compared across both files. There was no material conflict, so the duplicate was safely deduplicated.

Generated files:

- `output/categorized/lira-gutenberg-52-existing-categorized.marcxml`
- `output/categorized/lira-gutenberg-52-existing-categorized.report.json`

Verified results:

- Input occurrences: 53
- Unique output records: 52
- Duplicate IDs: PG84
- Conflicting duplicate IDs: none
- Unmapped IDs: none
- Unused mapping IDs: 9 informational IDs from the nine-record portion of the canonical map
- Category totals: Literature 48, History 3, Psychology 1
- Stable identifiers preserved, including `001=PG84` and `035$a=(PG)84`

## Generated Nine-Record Output

Inputs:

- `output/subject-starter/gutenberg-57628-22657-71292-6737-168-51676-20239-3300-38269.marcxml`
- `output/subject-retry/gutenberg-22657-71292-6737-168-51676-20239-3300-38269.marcxml`

Generated files:

- `output/categorized/lira-gutenberg-9-new-categorized.marcxml`
- `output/categorized/lira-gutenberg-9-new-categorized.report.json`

Verified results:

- Input records: 9
- Unique output records: 9
- Duplicate IDs: none
- Conflicting duplicate IDs: none
- Unmapped IDs: none
- Unused mapping IDs: 52 informational IDs from the existing-record portion of the canonical map
- Assigned category totals: one each for all nine controlled categories

All nine records now contain exactly one newly appended local `650 #4` category. Source `650 #0` subjects remain preserved, including any source values with the same text as the local category.

## Commands Used

Tests, build, and whitespace validation:

```powershell
npm test
npm run build
git diff --check
```

Existing-record offline categorization:

```powershell
npm run categorize -- --input ./output/gutenberg-50-batch/lira-gutenberg-50-records.marcxml --input ./output/gutenberg-84-1342-11.marcxml --subject-map ./examples/subjects.json --output ./output/categorized/lira-gutenberg-52-existing-categorized.marcxml --report ./output/categorized/lira-gutenberg-52-existing-categorized.report.json
```

Nine-record offline categorization:

```powershell
npm run categorize -- --input ./output/subject-starter/gutenberg-57628-22657-71292-6737-168-51676-20239-3300-38269.marcxml --input ./output/subject-retry/gutenberg-22657-71292-6737-168-51676-20239-3300-38269.marcxml --subject-map ./examples/subjects.json --output ./output/categorized/lira-gutenberg-9-new-categorized.marcxml --report ./output/categorized/lira-gutenberg-9-new-categorized.report.json
```

## Verification Results

- `npm test`: 32 passed, 0 failed.
- `npm run build`: passed.
- `git diff --check`: passed.
- Both offline categorization commands completed successfully.
- Original MARCXML input files were not overwritten.
- Generated files remain under ignored `output/` directories.
- No live Gutendex import was run.
- No Koha operation was performed.

## Safe Koha Next Steps

For the existing-record overlay:

1. Stage only `lira-gutenberg-52-existing-categorized.marcxml`.
2. Select the `GUTENBERG` matching rule.
3. Confirm Koha reports exactly 52 matches and 0 new records.
4. Enable replacement of matching bibliographic records.
5. Preserve or ignore existing items rather than replacing them.
6. Review representative MARC previews.
7. Stop if any record is classified as new.

The nine-record categorized file is for new-record import and must remain separate from the 52-record overlay file. Do not stage the earlier uncategorized files together with the categorized outputs.
