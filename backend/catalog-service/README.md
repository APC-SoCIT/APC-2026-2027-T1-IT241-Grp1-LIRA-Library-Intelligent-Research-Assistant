Koha ILS integration, catalog CRUD, and synchronization. This service provides the canonical backend API for searching books, reading detail records, viewing availability, and maintaining catalog data.

Synchronization should account for changed, removed, and temporarily unavailable records while keeping local identifiers traceable to Koha. Administrative mutations require authorization and validation, and read endpoints should provide stable pagination and filter semantics. Lira-02, Lira-11
