# LIRA Code and ERD Reviewer

## Purpose

This reviewer explains the important parts of LIRA in simple terms. It covers:

1. the key functions currently present in the code;
2. the **Manage Library Catalog Code Diagram, Version 2**;
3. every major group in the **Full ERD with AI Services and Koha**; and
4. the difference between the diagrams and the code that is currently implemented.

The reviewer is based on the repository code and database migrations, not only on the diagram images.

## 1. LIRA in one sentence

LIRA is a library website where a user can find books from Koha, search them with keywords or AI-assisted meaning, and save personal library activity in Supabase.

The basic flow is:

```text
User -> React frontend -> Catalog API -> Koha
                         |
                         +-> Supabase for profile, bookmarks, history, and reservations
                         +-> OpenRouter + Supabase embeddings for semantic search
```

## 2. Key functions in simple terms

### Frontend services

| Function | File | Simple explanation |
|---|---|---|
| `request(path)` | [`frontend/src/services/catalogService.js`](../frontend/src/services/catalogService.js) | Sends a request to the catalog backend. If the server returns an error, it converts it into a readable message. |
| `listCatalogBooks()` | [`frontend/src/services/catalogService.js`](../frontend/src/services/catalogService.js) | Downloads catalog pages until there are no more books, then returns one combined list. |
| `listNewArrivalBooks(limit)` | [`frontend/src/services/catalogService.js`](../frontend/src/services/catalogService.js) | Gets the newest catalog records from the backend. |
| `searchCatalogBooks(query, mode)` | [`frontend/src/services/catalogService.js`](../frontend/src/services/catalogService.js) | Searches the catalog using keyword, semantic, or hybrid mode and combines all result pages. |
| `getCatalogBook(id)` | [`frontend/src/services/catalogService.js`](../frontend/src/services/catalogService.js) | Gets one complete book record. |
| `getCatalogBookContent(id)` | [`frontend/src/services/catalogService.js`](../frontend/src/services/catalogService.js) | Requests the online reading content linked to a book. |
| `signIn(...)` | [`frontend/src/services/authService.js`](../frontend/src/services/authService.js) | Logs a user in through Supabase Auth. |
| `signUp(...)` | [`frontend/src/services/authService.js`](../frontend/src/services/authService.js) | Creates an account and sends profile details such as name and school as user metadata. |
| `signOut()` | [`frontend/src/services/authService.js`](../frontend/src/services/authService.js) | Ends the current Supabase session. |
| `useAuth()` | [`frontend/src/hooks/useAuth.js`](../frontend/src/hooks/useAuth.js) | Watches whether a user is logged in and updates the interface when the session changes. |
| `adaptCatalogBook(book)` | [`frontend/src/utils/catalogCategories.js`](../frontend/src/utils/catalogCategories.js) | Converts the backend book format into the fields used by cards, filters, and categories in the UI. |

### Student library functions

All of these functions are in [`frontend/src/services/studentLibraryService.js`](../frontend/src/services/studentLibraryService.js). Before changing data, `requireUser()` checks that Supabase exists and that a user is signed in.

| Function group | What it does |
|---|---|
| `getStudentProfile()` / `updateStudentProfile(profile)` | Reads or updates the signed-in user's profile. The update function validates required name and school fields, then updates both the profile row and Supabase Auth metadata. |
| `recordReading(book)` / `listReadingHistory()` | Saves the latest time a user read a book and lists the user's reading history. The user/book pair is unique, so reading the same book updates its timestamp instead of creating duplicates. |
| `recordCatalogSearch(query)` | Saves a non-empty search query, trimmed to 200 characters. |
| `recordCatalogBookView(book)` | Saves the latest details of a book the user opened. This activity supports recommendations. |
| `getCatalogRecommendationHistory()` | Loads recent views, reading history, and searches together so the recommendation feature has user activity to work with. |
| `listReadingLists()` / `createReadingList(name)` / `renameReadingList(...)` / `deleteReadingList(...)` | Manages a user's named reading lists. Names must contain 1–60 non-space characters. |
| `saveBookmark(book, listId)` / `moveBookmark(...)` / `removeBookmark(...)` / `listBookmarks(...)` | Adds, moves, removes, or reads saved books. A book can appear only once for a user. |
| `addReservationCartItem(book)` / `removeReservationCartItem(bookId)` / `listReservations()` | Adds, removes, or reads books in the user's reservation cart. |

### Catalog API functions

The API is implemented in the NestJS catalog service under [`backend/catalog-service/src/catalog`](../backend/catalog-service/src/catalog).

| Function or endpoint | Simple explanation |
|---|---|
| `CatalogController.listBooks()` — `GET /api/catalog/books` | Asks the catalog service for one page of books. |
| `CatalogController.listNewArrivals()` — `GET /api/catalog/new-arrivals` | Gets books ordered by newest bibliographic record. |
| `CatalogController.getBook(id)` — `GET /api/catalog/books/:id` | Gets one book by its Koha bibliographic ID. |
| `CatalogController.getBookContent(id)` — `GET /api/catalog/books/:id/content` | Gets the first valid online resource attached to a book. |
| `CatalogController.search()` — `GET /api/catalog/search` | Validates the search query and chooses keyword, semantic, or hybrid search. |
| `CatalogService.listBooks(page, limit)` | Calls Koha, then converts each Koha record into LIRA's common `Book` format. |
| `CatalogService.searchBooks(query, page, limit, mode)` | Runs the selected search mode and returns paginated results. |
| `CatalogService.normalize(record)` | Makes different or incomplete Koha values safe and consistent for the frontend: missing text becomes `null`, lists become arrays, and years become numbers. |
| `CatalogService.searchHybrid(...)` | Runs keyword and semantic search together, gives higher combined scores to books appearing in both lists, sorts them, and caches the result briefly. |
| `CatalogService.reindexSemanticCatalog(indexKey)` | Downloads all Koha books, creates new embeddings, stores them, and removes old embedding records. It requires a protected indexing key. |

### Koha and semantic search functions

| Function group | Simple explanation |
|---|---|
| `KohaClient.getBiblios(...)` / `getBiblio(id)` | Reads catalog records from Koha. |
| `KohaClient.searchBiblios(query, ...)` | Searches Koha by title, author, or ISBN. |
| `KohaClient.getControlledCategories(...)` | Reads MARCXML category information and adds recognized subject categories to records. If MARCXML enrichment fails, the basic book record can still be returned. |
| `KohaClient.toIntegrationError(...)` | Converts network and HTTP failures into known error types such as not found, unauthorized, rate limited, or unavailable. |
| `SemanticSearchService.search(query, limit)` | Sends the query to the embedding provider, then asks Supabase to find catalog vectors with similar meaning. |
| `SemanticSearchService.indexBooks(books)` | Creates embeddings in batches of 32, saves them in `catalog_embeddings`, and deletes stale records from older index runs. |
| `SemanticSearchService.authorizeIndexRequest(key)` | Protects the reindex operation by comparing the supplied key using a timing-safe comparison. |
| `SemanticSearchService.searchableText(book)` | Builds the text used for an embedding from title, author, description, subjects, categories, publisher, year, and other book fields. |

## 2.1 How the current semantic search works

Semantic search means the system compares the meaning of the user's words with the meaning of each book record. It is different from ordinary keyword search: a query such as “books about managing stress” can find relevant records even when the exact words do not appear in the title.

### Search flow

```text
User chooses Semantic Search
  -> frontend calls GET /api/catalog/search?q=...&mode=semantic
  -> CatalogService calls SemanticSearchService.search()
  -> OpenRouter turns the query into a 1,536-number embedding
  -> Supabase RPC compares that vector with catalog_embeddings
  -> closest book_data records are returned
  -> frontend displays the results
```

1. The user selects **Semantic Search** in the catalog interface.
2. [`searchCatalogBooks(query, mode)`](../frontend/src/services/catalogService.js) sends the query and mode to the catalog API.
3. [`CatalogService.searchBooks()`](../backend/catalog-service/src/catalog/catalog.service.ts) sees `mode === 'semantic'` and calls the semantic service.
4. [`SemanticSearchService.createEmbeddings()`](../backend/catalog-service/src/catalog/semantic-search.service.ts) sends the query to OpenRouter's embeddings endpoint.
5. The service checks that the returned vector has 1,536 finite numbers.
6. [`match_catalog_books`](../supabase/migrations/202610010001_openrouter_embedding_dimensions.sql) compares the query vector with stored catalog vectors using cosine distance.
7. Supabase returns the nearest `book_data` records, ordered from most similar to least similar.
8. The backend returns those records in the same `Book` shape used by keyword search.

### How the catalog is prepared for semantic search

Semantic search only works after the catalog has been indexed.

1. A protected request calls `POST /api/catalog/semantic/reindex` with the `x-semantic-index-key` header.
2. The catalog service downloads all records from Koha.
3. Each record is normalized into a LIRA `Book` object.
4. The semantic service builds searchable text from the title, author, description, genres, subjects, categories, series, publisher, place, year, item type, and language.
5. Books are processed in batches of 32 so the embedding request is manageable.
6. Each vector and its book data are upserted into `catalog_embeddings` using `book_id` as the key.
7. Records from older indexing runs are deleted, so removed Koha books do not stay in the semantic index.

### Keyword, semantic, and hybrid search

| Mode | How it works | Best use |
|---|---|---|
| Keyword | Koha searches title, author, and ISBN text. | Exact names, ISBNs, and known words. |
| Semantic | OpenRouter creates a query vector and Supabase finds similar book vectors. | Natural-language questions and topic searches. |
| Hybrid | Keyword and semantic searches run together. A book receives points based on its position in each result list; books appearing in both lists usually rise to the top. | General-purpose search when both exact matches and meaning matter. |

Both semantic and hybrid results are cached in memory for about 30 seconds. The hybrid cache can hold up to 100 query keys, and reindexing clears the hybrid cache. This reduces repeated calls but means the cache is lost when the service restarts.

### Important current implementation note

The migration history first used 768-dimensional vectors, then changed the table and matching function to 1,536 dimensions in [`202610010001_openrouter_embedding_dimensions.sql`](../supabase/migrations/202610010001_openrouter_embedding_dimensions.sql). The backend now expects 1,536 dimensions, so the migrations must be applied in order and the catalog must be reindexed after the dimension change. Otherwise semantic search can fail because the query vector and stored vectors have different sizes.

## 3. Manage Library Catalog Code Diagram, Version 2

Source diagram: [`ManageLibraryCatalogCodeDiagram(Version2).puml`](MSYADD1/diagrams/ManageLibraryCatalogCodeDiagram(Version2).puml).

### People and external systems

- **Student / Faculty**: signs in, searches, opens book details, saves bookmarks, and adds reservations.
- **Librarian**: manages the authoritative catalog in Koha and may synchronize metadata through DocuPulse.
- **Microsoft Entra ID**: the identity provider shown in the diagram for APC Microsoft account SSO.
- **Koha ILS**: the authoritative source for bibliographic records, physical items, availability, and circulation.
- **DocuPulse**: an external metadata synchronization source shown in the diagram.

### Frontend package

- **`CatalogAccessPage.jsx`** shows the catalog access and login screen.
- **`AuthPanel.jsx`** provides the sign-in/sign-up controls.
- **`OpacPage.jsx`** is the main catalog screen. It loads books, runs searches, opens details, records activity, and controls bookmarks and reservations.
- **`OpacSearchResults.jsx`** displays results, local pagination, source filtering, and facets such as author, category, year, and item type.
- **`BookDetail.jsx`** shows one selected record and actions such as save, read, and reserve.
- **`catalogService.js`** is the frontend gateway to the catalog API.
- **`authService.js`** handles authentication calls.
- **`studentLibraryService.js`** handles personal library data in Supabase.
- **`adaptCatalogBook()`** translates API records into frontend-friendly values.

### Authentication boundary

This part is meant to keep identity work separate from catalog work:

1. the auth controller starts or completes sign-in;
2. the Microsoft OAuth/MSAL adapter communicates with Entra ID;
3. the session service checks claims and creates a session; and
4. account provisioning creates or updates the local account and profile.

### Catalog service boundary

The catalog request moves through a clear chain:

```text
Frontend service
  -> CatalogController
  -> DTO validation
  -> CatalogService
  -> KohaClient or SemanticSearchService
  -> normalized Book response
```

- **DTOs** check that page, limit, query, and search mode have acceptable values.
- **`CatalogService`** decides what kind of search is needed.
- **`KohaClient`** talks to Koha's REST API and converts Koha failures into API errors.
- **`SemanticSearchService`** handles embeddings and vector matching.
- **`normalize()`** prevents the frontend from needing to understand every Koha response variation.
- **Supabase application storage** holds user activity such as views, history, reading lists, bookmarks, and reservations.
- **Supabase vector storage** holds `catalog_embeddings` used by semantic and hybrid search.

### Important Version 2 review note

The diagram describes Microsoft Entra ID / MSAL authentication, but the current frontend code calls Supabase Auth with email and password in [`authService.js`](../frontend/src/services/authService.js). The diagram should be treated as the target design for SSO unless an Entra adapter exists elsewhere outside the current source tree.

## 4. Full ERD explained simply

Source diagram: [`LIRA_Full_System_ERD_With_AI_Koha(Version1).puml`](MSYADD1/diagrams/LIRA_Full_System_ERD_With_AI_Koha(Version1).puml).

### A. Identity and Profiles

| Entity | Meaning |
|---|---|
| `microsoft_accounts` | Stores the external Microsoft identity: object ID, email, display name, and tenant. |
| `profiles` | Stores LIRA's local user information such as name, school, and role. |

The diagram shows one Microsoft account linked to one LIRA profile. This lets LIRA use Microsoft for identity while keeping application-specific information locally.

### B. Koha ILS — external source of truth

| Entity | Meaning |
|---|---|
| `koha_biblios` | One bibliographic work or catalog record: title, author, ISBN, and item type. |
| `koha_items` | The physical or individual copy connected to a bibliographic record. It includes barcode and availability. |
| `koha_loans` | Koha's circulation record for an item and borrower, including the due date. |

The relationships are: one biblio can have many items, and one item can have many loan records over time. These are shown as logical links because Koha is an external database; LIRA normally stores IDs such as `biblio_id` and `item_id` instead of owning these Koha rows.

### C. Catalog and student library data

| Entity | Meaning |
|---|---|
| `catalog_embeddings` | Stores searchable book text, an embedding vector, and the book data used for semantic search. One book normally has one current embedding. |
| `catalog_book_views` | Records the latest time a user viewed a book. |
| `catalog_search_history` | Records the user's search text. |
| `reading_lists` | Stores named lists created by a user, such as “Research” or “Read later.” |
| `bookmarks` | Connects a user and a book to a reading list. A bookmark is the saved-book record. |
| `reading_history` | Stores books the user has opened or read and the most recent read time. |

The profile owns the user's activity. A reading list owns its bookmarks. Book records are referenced by `book_id`, which normally points back to a Koha bibliographic record conceptually.

### D. Circulation and reservations

| Entity | Meaning |
|---|---|
| `reservations` | The user's saved reservation-cart items. It represents an intention to reserve, not necessarily a completed Koha checkout. |
| `loan_transactions` | LIRA's proposed local view of borrowing status, due dates, and returned dates. It can keep Koha IDs for synchronization. |
| `overdue_alerts` | Proposed reminders connected to a loan, with statuses such as pending, sent, failed, or dismissed. |

The important distinction is that Koha remains the circulation authority in the diagram. LIRA's `loan_transactions` and `overdue_alerts` are application-side workflow records that still need a synchronization design.

### E. AI chatbot and knowledge base

| Entity | Meaning |
|---|---|
| `chatbot_configs` | Stores chatbot versions, tone, rules, and which configuration is active. |
| `knowledge_sources` | Registers FAQs, policies, catalog data, documents, or URLs used as chatbot knowledge. |
| `knowledge_chunks` | Breaks each source into smaller text pieces and optionally stores an embedding for retrieval. |
| `chat_sessions` | One conversation between a user and the chatbot, tied to the configuration used. |
| `chat_messages` | Individual user, assistant, or system messages in a conversation. |
| `chat_response_sources` | Explains which knowledge chunk or book supported a chatbot response. |

The flow is: a source is divided into chunks, a user starts a session, messages are stored, and each answer can point back to the chunks or books used. This makes answers easier to trace.

### F. AI outputs

| Entity | Meaning |
|---|---|
| `summary_requests` / `summaries` | A request for a short, medium, or long book summary and the generated result. |
| `citation_requests` / `citations` | A request for an APA or MLA citation and the generated citation, including missing fields. |
| `recommendation_runs` / `recommendation_items` | One recommendation calculation and the books it selected, with rank, score, and reason. |

The one-to-one links mean one completed summary or citation belongs to one request. A recommendation run can contain many recommended books.

### G. Analytics and reports

| Entity | Meaning |
|---|---|
| `report_requests` | A staff member's request for a report, including report type, dates, filters, and processing status. |
| `report_exports` | The generated PDF or CSV file connected to a report request. |
| `audit_events` | A record of who did what, to which kind of entity, and when. |

These entities support administration, reporting, and accountability. They are shown as proposed in the full ERD.

### H. OpenRouter AI Provider

OpenRouter is an external AI provider. It is not a normal local table. The dotted relationships mean the AI provider is called by services that create embeddings, chatbot answers, summaries, citations, or recommendations.

## 5. Current versus proposed ERD parts

The full ERD contains both implemented and planned areas.

### Present in current migrations

The current Supabase migrations contain the user profile, reading history, reading lists, bookmarks, catalog search history, catalog book views, catalog embeddings, and reservations. The current schema is defined in [`supabase/migrations`](../supabase/migrations).

### Planned or not fully implemented

The full ERD labels the loan transactions, overdue alerts, chatbot, knowledge base, AI output, and analytics/report tables as proposed. They appear in the full ERD export [`LIRA_Full_ERD_Supabase_Microsoft_SSO.sql`](MSYADD1/diagrams/LIRA_Full_ERD_Supabase_Microsoft_SSO.sql), but they should not be described as completed features unless their migrations and services have also been added.

### Schema caution for reviewers

There are two ERD SQL snapshots with different identity assumptions:

- [`LIRA_Current_ERD_Supabase.sql`](MSYADD1/diagrams/LIRA_Current_ERD_Supabase.sql) models Supabase `auth_users` and profile IDs.
- [`LIRA_Full_ERD_Supabase_Microsoft_SSO.sql`](MSYADD1/diagrams/LIRA_Full_ERD_Supabase_Microsoft_SSO.sql) models Microsoft accounts and the larger planned system.

When updating the diagrams, choose one authentication model as the current source of truth and label the other as target/proposed.

## 6. Short presentation script

“LIRA separates the user interface, catalog API, external Koha system, and personal user storage. Koha owns the official catalog and circulation records. The frontend asks the catalog service for books, while the catalog service validates requests, calls Koha, normalizes records, and optionally uses semantic search through embeddings. Supabase stores profiles and personal actions such as reading history, bookmarks, lists, and reservations. The full ERD also describes future chatbot, AI output, loan, alert, analytics, and reporting features. Those future areas should be implemented and migrated before they are presented as completed parts of the system. Finally, the Version 2 code diagram shows Microsoft SSO, but the current frontend authentication code still uses Supabase email/password, so that difference should be resolved or explicitly marked as a planned migration.”
