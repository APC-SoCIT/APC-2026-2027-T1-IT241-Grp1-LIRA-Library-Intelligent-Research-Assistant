# LIRA Catalog Service

The Catalog Service connects the LIRA frontend to Koha. Koha is the authoritative source of catalog data; the service never writes to Koha and communicates exclusively through its REST API, not its MariaDB database. Optional semantic search maintains a separate search index in Supabase.

## Scope

Implemented:

- Service health and Koha connectivity health checks
- Read-only list, detail, and keyword search endpoints
- Pagination with a maximum page size of 100
- Normalization from Koha bibliographic records to the public LIRA `Book` model
- Optional semantic and hybrid catalog search using OpenRouter embeddings and Supabase pgvector
- An authenticated endpoint to index or refresh the Koha catalog's semantic vectors
- Timeout-controlled Basic Authentication requests to Koha
- Input validation, safe integration errors, configurable CORS, and request logging

This service does not create or update Koha records, manage patrons or loans, import Gutenberg/MARC21 data, or perform RAG or availability logic. Semantic indexing stores a search copy of bibliographic metadata in Supabase; Koha remains authoritative.

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

Optional:

- `PORT`: local HTTP port, default `3001`
- `CORS_ORIGINS`: comma-separated allowed origins, default `http://localhost:3000`
- `KOHA_TIMEOUT_MS`: request timeout from 100 to 60000 ms, default `5000`
- `NODE_ENV`: runtime environment label
- `OPENROUTER_API_KEY`: backend-only OpenRouter API key; never put this in the frontend
- `OPENROUTER_EMBEDDING_MODEL`: OpenRouter embedding model, defaults to `openai/text-embedding-3-small` (must return 1536-dimensional embeddings)
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: backend-only Supabase service-role key; never put this in the frontend
- `SEMANTIC_INDEX_API_KEY`: secret required by the catalog reindex endpoint
- `SEMANTIC_MATCH_LIMIT`: maximum vector candidates per search, from 1 to 1000; defaults to `500`

Semantic settings are optional as a group. When enabled, set `OPENROUTER_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SEMANTIC_INDEX_API_KEY` in the backend `.env`, then restart the service. OpenRouter usage may incur provider charges.

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

- `GET /health` returns `{ "status": "ok" }` for service health.
- `GET /health/koha` performs an authenticated request to Koha. It returns HTTP 200 with `{ "status": "ok", "koha": "reachable" }`, or HTTP 503 with `{ "status": "error", "koha": "unreachable" }`.
- `GET /api/catalog/books?page=1&limit=20` lists normalized books.
- `GET /api/catalog/books/:id` returns one normalized book. Invalid IDs return HTTP 400; missing records return HTTP 404.
- `GET /api/catalog/search?q=programming&page=1&limit=20&mode=keyword` searches Koha by general title/author/ISBN query. `mode=semantic` searches the vector index; `mode=hybrid` combines both ranked lists. Keyword is the default.
- `POST /api/catalog/semantic/reindex` refreshes all catalog embeddings. Requires the `x-semantic-index-key` header and complete semantic configuration.

Missing Koha fields remain `null`. The service does not guess or generate metadata.

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

Koha credentials stay on the backend. The service never returns credentials or the Authorization header and does not log passwords, tokens, or full Koha responses. Requests use a finite timeout and CORS is configured from `CORS_ORIGINS`, rather than allowing every origin.

Koha remains responsible for bibliographic records, items, MARC data, and library-management data. This service is only the integration boundary used by LIRA clients.
