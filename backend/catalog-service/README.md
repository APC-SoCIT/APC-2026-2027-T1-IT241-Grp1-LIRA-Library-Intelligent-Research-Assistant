# LIRA Catalog Service

The Catalog Service is a read-only REST gateway between the LIRA frontend and Koha. Koha is the authoritative source of catalog data. The service communicates with Koha exclusively through the Koha REST API and must not access Koha's MariaDB database directly.

## Scope

Implemented:

- Service health and Koha connectivity health checks
- Read-only list, detail, and keyword search endpoints
- Pagination with a maximum page size of 100
- Normalization from Koha bibliographic records to the public LIRA `Book` model
- Timeout-controlled Basic Authentication requests to Koha
- Input validation, safe integration errors, configurable CORS, and request logging

This service does not create, update, or delete records, manage patrons or loans, import Gutenberg/MARC21 data, or perform AI, RAG, recommendation, or availability logic.

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
- `GET /api/catalog/search?q=programming&page=1&limit=20` searches Koha by general title/author/ISBN query.

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
