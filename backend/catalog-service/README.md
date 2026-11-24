# LIRA Catalog Service

The Catalog Service connects the LIRA frontend to Koha. Koha is the authoritative source of catalog data; the service never writes to Koha and communicates exclusively through its REST API, not its MariaDB database. Optional semantic search maintains a separate search index in Supabase.

## Scope

Implemented:

- Service health and Koha connectivity health checks
- Read-only list, detail, and keyword search endpoints
- Pagination with a maximum page size of 100
- Normalization from Koha bibliographic records to the public LIRA `Book` model
- Optional semantic and hybrid catalog search using OpenRouter embeddings and Supabase pgvector
- FAQ chatbot using librarian-maintained knowledge entries and OpenRouter chat completions
- Authenticated, AES-256-GCM-encrypted conversation history with per-user privacy controls and one-year inactivity retention
- An authenticated endpoint to index or refresh the Koha catalog's semantic vectors
- Timeout-controlled Basic Authentication requests to Koha
- Input validation, safe integration errors, configurable CORS, and request logging

This service does not create or update Koha records, manage patrons or loans, or import Gutenberg/MARC21 data. Catalog semantic indexing stores a search copy of bibliographic metadata in Supabase; the FAQ chatbot retrieves librarian-maintained FAQs and policies from Supabase as answer context. Koha remains authoritative for catalog data.

## Prerequisites

- Node.js 20 or later
- npm
- Network access to the Koha REST API
- A Koha API account with permission to read bibliographic records

## Installation

```powershell
cd backend/catalog-service
npm install
Copy-Item .env.example .env
```

Edit `.env` with the actual password. `.env` is ignored by git and credentials must never be committed.

## Configuration

Required:

- `KOHA_BASE_URL`: Koha host, for example `http://192.168.100.63:8081`
- `KOHA_API_USER`: Koha API username
- `KOHA_API_PASSWORD`: Koha API password
- `KOHA_STUDENT_CATEGORY_ID`: Koha category code for new LIRA patrons (defaults to `ST`)
- `KOHA_LIBRARIAN_CATEGORY_ID`: Koha category code for librarian accounts (defaults to `S`)
- `KOHA_STUDENT_LIBRARY_ID`: Koha library code for new LIRA patrons (defaults to `APC`)

Optional:

- `PORT`: local HTTP port, default `3001`
- `CORS_ORIGINS`: comma-separated allowed origins, default `http://localhost:3000`
- `KOHA_TIMEOUT_MS`: request timeout from 100 to 60000 ms, default `5000`
- `NODE_ENV`: runtime environment label
- `OPENROUTER_API_KEY`: backend-only OpenRouter API key; never put this in the frontend
- `OPENROUTER_CHAT_MODEL`: OpenRouter model used for FAQ answers, defaults to `openai/gpt-4o-mini`
- `OPENROUTER_EMBEDDING_MODEL`: OpenRouter embedding model, defaults to `openai/text-embedding-3-small` (must return 1536-dimensional embeddings)
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: backend-only Supabase service-role key; never put this in the frontend
- `SEMANTIC_INDEX_API_KEY`: secret required by the catalog reindex endpoint
- `SEMANTIC_MATCH_LIMIT`: maximum vector candidates per search, from 1 to 1000; defaults to `500`
- `CHAT_HISTORY_ENCRYPTION_KEY`: base64-encoded 32-byte key used only by the backend to encrypt saved conversations; generate with `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`

The FAQ chatbot uses `OPENROUTER_API_KEY`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY` to retrieve librarian-maintained knowledge entries and generate answers. Semantic search settings are optional as a group; when enabled, also set `SEMANTIC_INDEX_API_KEY` in the backend `.env`. OpenRouter usage may incur provider charges.

Saved chat history additionally requires `CHAT_HISTORY_ENCRYPTION_KEY`. Keep it backend-only, back it up securely, and do not rotate or lose it without an explicit key migration; existing ciphertext cannot be recovered without the original key.

### Enable semantic search

1. Apply `202609300001_catalog_semantic_search.sql` followed by `202610010001_openrouter_embedding_dimensions.sql`. The OpenRouter migration clears existing embeddings and changes the index to the 1536 dimensions returned by the default model. If your database already has the prior 768-dimensional migration applied, just apply the OpenRouter migration.
2. Configure `OPENROUTER_API_KEY`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY` in the backend `.env`. Keep both API keys on the backend.
3. Generate a random key in PowerShell with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` and add it to the backend `.env` as `SEMANTIC_INDEX_API_KEY`. Start the service from `backend/catalog-service` and leave it running:

   ```powershell
   npm run start:dev
   ```

   In a second PowerShell terminal, run the request using the same key value configured in `.env`:

   ```powershell
   $headers = @{ 'x-semantic-index-key' = 'PASTE_YOUR_SEMANTIC_INDEX_API_KEY_HERE' }
   Invoke-RestMethod -Method Post -Uri 'http://localhost:3001/api/catalog/semantic/reindex' -Headers $headers
   ```

   The endpoint is idempotent and can be called again after catalog metadata changes. Keep the key private; only a trusted operator should invoke it. Never put the real key in documentation or source control.
4. In the OPAC, select **Semantic** or **Hybrid** in the search-mode selector. Keyword mode remains the default and does not require the embedding setup.

Hybrid mode combines Koha keyword results with vector results using reciprocal rank fusion. ISBN/title exact searches remain available through Keyword mode; Semantic mode searches by meaning alone. Book text and search queries are sent to OpenRouter for embedding inference; the resulting vectors and indexed metadata are stored in Supabase.

The development VM uses `http://192.168.100.63:8081`. Do not use `localhost` for Koha from the Windows backend.

## Running

```powershell
npm run start:dev
```

Production build and start:

```powershell
npm run build
npm run start:prod
```

## API

Structured e-book resources, binary retrieval, mapping rules, transfer limits and
PowerShell smoke checks are documented in [RESOURCE_API.md](RESOURCE_API.md).

- `GET /health` returns `{ "status": "ok" }` for service health.
- `GET /health/koha` performs an authenticated request to Koha. It returns HTTP 200 with `{ "status": "ok", "koha": "reachable" }`, or HTTP 503 with `{ "status": "error", "koha": "unreachable" }`.
- `GET /api/catalog/books?page=1&limit=20` lists normalized books.
- `GET /api/catalog/books/:id` returns one normalized book. Invalid IDs return HTTP 400; missing records return HTTP 404.
- `GET /api/catalog/books/:id/resources/:resourceId/content` returns verified raw PDF/EPUB/HTML/text bytes for an approved resource from that book.
- `GET /api/catalog/books/:id/summaries?resourceId=...` returns a shared generated summary, if available. `POST` to the same route with `{ "resourceId": "..." }` generates one for any signed-in user.
- `GET /api/librarian/book-summaries?status=approved` filters summary records by status; `PUT /api/librarian/book-summaries/:id` accepts an edit and an `approve` or `reject` action for a librarian.
- `POST /api/catalog/books/:id/resources/upload` uploads a PDF/EPUB to Koha for a librarian and returns its public OPAC URL. Send `multipart/form-data` with a `file` field; the librarian client immediately saves the returned resource to the record.
- `GET /api/catalog/books/:id/content` returns the existing HTML/text reader JSON response.
- `GET /api/catalog/search?q=programming&page=1&limit=20&mode=keyword` searches Koha by general title/author/ISBN query. `mode=semantic` searches the vector index; `mode=hybrid` combines both ranked lists. Keyword is the default.
- `POST /api/catalog/semantic/reindex` refreshes all catalog embeddings. Requires the `x-semantic-index-key` header and complete semantic configuration.
- `POST /api/chatbot/faq` accepts `{ "question": "...", "history": [], "language": "en" }` and returns an answer with matched librarian knowledge entries and their source links. Configure `OPENROUTER_API_KEY`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY`, and apply `202611190002_librarian_knowledge_entries.sql` followed by `202611240001_seed_library_faq_entries.sql`. Manage the imported FAQ records from the librarian **FAQs & policies** page.
- `GET|PUT /api/chatbot/preferences` reads or updates `{ "saveHistory": boolean }` for the authenticated account.
- `GET|POST|DELETE /api/chatbot/conversations` lists, creates, or deletes the caller's conversations; `GET|DELETE /api/chatbot/conversations/:id` loads or deletes one. `POST /api/chatbot/conversations/:id/messages` saves one user or assistant turn. All routes require a valid Supabase access token and enforce the authenticated user's ownership.

### Encrypted chat history

Apply `202611240002_encrypted_chat_history.sql` after the existing Supabase migrations. It creates private preference, session, and message tables, enables RLS, revokes browser-role table access, and schedules `pg_cron` to purge sessions one year after creation. If `pg_cron` is not enabled for the project, enable the Supabase `pg_cron` extension before applying the migration.

Saving is enabled by default for signed-in users; signed-out chats remain in memory only. The privacy toggle prevents future LIRA persistence but does not stop prompts from being sent to the configured AI provider. Previously saved messages remain until the user deletes the conversation. Titles, message text, citations, and source metadata are encrypted with AES-256-GCM before reaching Supabase, using a fresh nonce per record and a key derived per user and conversation. Librarians can access only their own account's history through the same owner-scoped API; backend operators with database access and the encryption key can decrypt it. The retention schedule deletes each session and its messages one year after creation.

### Shared AI book summaries

Apply `202611240003_shared_ai_book_summaries.sql` after the existing Supabase migrations. It creates private summary and per-user daily-usage tables; the service role is the only database API role with table access. Set `OPENROUTER_API_KEY`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY`. Any signed-in account can request up to three new summaries per UTC day; cached summaries do not count. Summaries are shared by book resource and source-content hash, appear as AI-generated while awaiting review, and receive a verified tag only after librarian approval. The librarian **AI book summaries** workspace filters generating, pending, approved, rejected, and failed records, displaying each summary UUID with its Koha catalog ID and resource ID. Librarians can edit, approve, or reject pending summaries there.

The backend extracts HTML, text, EPUB, and PDF content. Sparse PDF text is OCR-processed with Tesseract.js (up to 200 pages per request), using the book language where a matching trained-data language is available. The first OCR request for a language may download its trained data from Tesseract.js's configured language-data host.

Missing Koha fields remain `null`. The service does not guess or generate metadata.

### PDF/EPUB uploads

The upload route logs into Koha's staff interface, obtains a short-lived session and CSRF token, then posts the exact multipart request used by Koha's own `file-upload.js` (`uploadfile`, `public=1`, and `category=KOHA_UPLOAD_CATEGORY`). It converts the returned file hash into the OPAC `opac-retrieve-file.pl?id=...` URL. REST catalog edits use `KOHA_API_USER`/`KOHA_API_PASSWORD`; uploads use those values by default, or `KOHA_UPLOAD_USER`/`KOHA_UPLOAD_PASSWORD` when the REST password is an API key rather than the staff user's password. `KOHA_UPLOAD_COOKIE` and `KOHA_UPLOAD_CSRF_TOKEN` are optional overrides for a pre-existing staff session; do not commit them. The Koha account must be permitted to upload general files, and the configured upload category must exist in Koha's `UPLOAD` authorized-value category.

## Testing

Unit tests mock Koha and do not require credentials or a live server:

```powershell
npm test
npm run build
npm run lint
```

For development verification against the VM, configure `.env`, start the service, then call:

```powershell
Invoke-RestMethod http://localhost:3001/health
Invoke-RestMethod http://localhost:3001/health/koha
Invoke-RestMethod 'http://localhost:3001/api/catalog/books?page=1&limit=20'
Invoke-RestMethod 'http://localhost:3001/api/catalog/books/1'
Invoke-RestMethod 'http://localhost:3001/api/catalog/search?q=programming'
```

Record `biblio_id=1` is a useful development check only; it is not hard-coded into the application. Live verification requires the configured Koha account and network access to `192.168.100.63`.

## Security and architecture

Koha credentials, the Supabase service-role key, and the chat-history encryption key stay on the backend. The public chatbot uses librarian knowledge entries as answer context, so only add information that is appropriate to share with library users. The service never returns credentials or the Authorization header and does not log passwords, tokens, or full Koha responses. Requests use a finite timeout and CORS is configured from `CORS_ORIGINS`, rather than allowing every origin.

Koha remains responsible for bibliographic records, items, MARC data, and library-management data. This service is only the integration boundary used by LIRA clients.
