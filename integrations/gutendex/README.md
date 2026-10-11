# Gutendex Integration

Gutendex is the external metadata source for Project Gutenberg records. This integration must use Gutendex rather than scraping Project Gutenberg directly.

The future pipeline is Gutendex metadata -> transformation -> MARC21 -> Koha import. The importer and data download are intentionally not implemented yet.