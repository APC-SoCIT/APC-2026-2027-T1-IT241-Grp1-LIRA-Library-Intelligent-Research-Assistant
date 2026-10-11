# E-book resources and content

Every catalog `Book` response now includes `resources: BookResource[]`, including list, detail, new arrivals, keyword/semantic/hybrid search and existing write responses. Empty/missing URLs produce `[]`. Existing fields, including the pipe-separated `url` and controlled local `650 #4` categories, retain their contract.

```typescript
interface BookResource {
  id: string;           // Lowercase 64-character SHA-256 of canonical sourceUrl.
  sourceUrl: string;    // 856 $u, or legacy url entry; URL fragments removed.
  format: 'pdf' | 'epub' | 'html' | 'text' | 'unknown';
  label: string;        // First applicable nonempty 856 $y, or a format label.
  mediaType: string | null;
  contentUrl: string | null; // Backend-relative path; null for blocked/unsupported resources.
}
```

Example from the read-only book 440 smoke check (October 12, 2026):

```json
{
  "id": "937b58ddf7dfd4222e2e056909ab8686e1625e30a59ecbd3048eb4b3babb12ec",
  "sourceUrl": "http://100.118.244.66:8080/cgi-bin/koha/opac-retrieve-file.pl?id=41a9a0c85b21bc426bcb45141bdf26ea",
  "format": "unknown",
  "label": "PDF upload test",
  "mediaType": null,
  "contentUrl": "/api/catalog/books/440/resources/937b58ddf7dfd4222e2e056909ab8686e1625e30a59ecbd3048eb4b3babb12ec/content"
}
```

This attachment has a label but no `$q` format metadata. Its opaque hash and label do not classify the resource. Retrieval verifies the actual PDF bytes and returns `application/pdf`. Metadata with `$q=application/epub+zip` exposes `format=epub` and `mediaType=application/epub+zip` before retrieval.

## MARC mapping and selection

The existing MARCXML enrichment request now reads both categories and resources. There is still one JSON request plus one optional MARCXML request per Koha book/page, regardless of resource count. No attachment is downloaded during catalog listing.

- Each 856 field contributes its own `$u`, `$q`, and `$y` values. Values never cross field boundaries.
- Repeated `$u` values create individual entries. When the number of `$q` or `$y` subfields equals the number of `$u` subfields, that metadata pairs by position. Otherwise those metadata values apply to all URLs in that field. Empty slots remain in the positional mapping, and fields without a nonempty URL are ignored.
- Duplicate canonical URLs merge in first-appearance order across MARC fields, then the legacy pipe-separated `url`. All format values merge; the first nonempty applicable label wins. Canonicalization uses the standard URL serializer and removes fragments; it preserves path case and query ordering. Duplicate labels/format strings are removed.
- Recognized `$q` values (`PDF`, `EPUB`, `HTML`/`HTM`, `TXT`/`text`/`plain text`, and their MIME types, including `application/xhtml+xml`) take precedence over extensions. One recognized classification wins; conflicting recognized classifications yield `unknown`. Unknown explicit metadata does not fall back to a URL extension. A sole other syntactically valid MIME type remains visible in `mediaType`.
- Without nonempty `$q`, path extensions `.pdf`, `.epub`, `.html`, `.htm`, `.txt`, and `.text` classify the resource. Gutenberg `.txt.utf-8` and `.html.images`/`.html.noimages` variants are also recognized. Query parameters, opaque Koha IDs, and `$y` labels do not determine format.
- IDs depend only on canonical URLs, so changing labels, formats, or MARC order does not change IDs. Removing/changing a URL invalidates its old ID. Retrieval resolves the ID against the selected book's current Koha metadata; an ID from another book is usable only if that same URL belongs to the selected book.
- MARC failure preserves JSON catalog data, empty controlled categories, and URL-derived fallback resources. Older semantic index rows receive the same URL fallback without additional Koha requests. Refreshing the existing semantic index includes enriched metadata; content retrieval always checks current Koha detail metadata.

## Retrieval and responses

`GET /api/catalog/books/:id/resources/:resourceId/content` follows existing public catalog read access. It accepts identifiers only and does not accept a caller-supplied destination. Nonpositive/invalid book IDs and malformed resource IDs return 400; missing books/resources or an upstream 404 return 404.

Successful responses stream raw bytes with HTTP 200, the verified `Content-Type`, a sanitized ASCII `Content-Disposition: inline; filename="..."`, `X-Content-Type-Options: nosniff`, and `Cache-Control: private, no-store`. `Content-Length` is supplied only when the upstream gives a valid unencoded length; otherwise Node streams without that header. Filename preference is upstream `filename*`/`filename`, then book title/label; paths, quotes and control characters are removed and the verified format's extension is used. HTML responses additionally use a sandbox CSP.

The route does not implement partial responses. `Range` is ignored and the complete bounded body returns 200 with `Accept-Ranges: none`, without `Content-Range`. Unexpected upstream 206 responses are rejected, rather than forwarding partial content as a complete file.

PDF/EPUB content must match both its expected/returned media type and a binary signature: `%PDF-` or an EPUB ZIP beginning with the required stored `mimetype` entry. Missing/octet-stream types are accepted only when metadata/signatures establish a supported format. This checks format signatures, not every PDF object or EPUB document. A generic ZIP is not an EPUB. HTML error/login pages cannot pass as PDF/EPUB, even with a misleading binary content type. Unclassified Koha attachments returning HTML/text are rejected; explicit HTML/text metadata permits those formats.

The transport buffers at most a 1024-byte inspection prefix, then replays every inspected byte exactly once before streaming the remaining source. Node reads and HTTP writes apply backpressure; the attachment is never collected in a whole-file buffer. Upstream gzip/deflate/Brotli responses are decoded as streams, with separate wire/decoded byte counting, and compressed lengths/encodings are not forwarded as decoded response headers. Text validation also checks later chunks for unexpected binary NUL bytes.

Before response bytes are sent, missing/invalid media or upstream non-200 responses produce safe 502 errors; connection/body failures produce 503, timeouts 504 and transfer limits 413. After headers/bytes have been sent, a failure, truncation, deadline or limit aborts the downstream connection, cancels upstream I/O and never appends JSON or sends a clean EOF. Clients must treat an aborted/incomplete download as a failure and discard its partial file. Known lengths are checked against the actual decoded count. Client disconnects cancel the upstream request and remove its deadline/listeners. The deadline remains active while downstream writes wait for drain, including after upstream EOF.

`GET /api/catalog/books/:id/content` retains `{ content, sourceUrl, resolvedUrl }` JSON for frontend reader consumers. It selects HTML/text in legacy URL order, falling back to an unclassified resource if necessary, and uses the same validated transport with a separate memory limit. Binary content is never decoded into this JSON response. Both the body collected for the reader and the serialized JSON must fit `EBOOK_READER_MAX_BYTES`.

## Destinations, transport and deployment

`KOHA_BASE_URL` remains the staff/API origin, `http://100.118.244.66:8081` in the current setup. Set `KOHA_OPAC_BASE_URL=http://100.118.244.66:8080` for attachments. Omitting the OPAC setting derives the staff scheme/host with port 8080. Only the exact OPAC path `/cgi-bin/koha/opac-retrieve-file.pl`, with one nonempty alphanumeric/underscore/hyphen `id` and no other query keys, is permitted. Other Koha routes and the staff port are blocked by default.

External retrieval defaults to these exact origins: `https://www.gutenberg.org`, `http://www.gutenberg.org`, `https://gutenberg.org`, `http://gutenberg.org`. Gutenberg currently redirects its ebook links from HTTPS to its HTTP cache origin, so both are included. Optional `EBOOK_ALLOWED_ORIGINS` replaces this list; a blank value disables external retrieval. Entries must be HTTP(S) origins, without credentials, paths, queries or fragments. Add only trusted resource hosts. Unsupported/malformed destinations remain visible with `contentUrl: null`.

Known unsupported MIME types such as `image/jpeg` also receive `contentUrl: null` and return 400 if explicitly requested. Unknown/generic media types may be retrieved and classified from supported upstream MIME/signatures; a non-null URL does not guarantee that a remote file exists or fits the transfer limit.

Automatic redirect handling is disabled. At most three redirects are followed, with each exact origin and Koha route revalidated before sending the next request. Cookies, inbound authorization and Koha Basic credentials are never sent by the content transport. Koha REST/MARC requests retain their existing backend authentication.

Koha attachment requests call the existing `getTailscaleProxy()`:

- Local Windows uses the installed Tailscale application with `LIRA_USE_TAILSCALE=0` and direct HTTP to the tailnet address.
- Vercel retains `LIRA_USE_TAILSCALE=1`, the existing `TS_AUTHKEY` and embedded proxy/binaries. Failed proxy initialization never falls back to direct Koha access. External public resources use direct transport.

`EBOOK_TIMEOUT_MS` defaults to 60000 (allowed 100–90000) and bounds content retrieval, including proxy readiness, redirects, body reads and downstream completion. Existing Koha metadata requests retain `KOHA_TIMEOUT_MS`. `EBOOK_MAX_BYTES` defaults to 64,000,000 (allowed 100–512,000,000) and bounds streamed transfers. Declared oversized content is rejected before reading; actual wire/decoded bytes are counted even with absent or inaccurate lengths. `EBOOK_READER_MAX_BYTES` defaults to 4,000,000 (allowed 100–4,000,000) because the existing reader still returns buffered JSON. The reader body is also subject to the configured streaming limit. Set the new values explicitly if an environment still contains the previous `EBOOK_MAX_BYTES=4000000`/`EBOOK_TIMEOUT_MS=15000` values.

Vercel's official [response-size guidance](https://vercel.com/kb/guide/how-to-bypass-vercel-body-size-limit-serverless-functions) says streaming function responses do not have the 4.5 MB response-body limit. The prior universal 4 MB ceiling was incorrect. This implementation uses the actual Nest Express adapter's Node `ServerResponse`, writing incrementally and waiting for drain. It bypasses Nest's default `StreamableFile` error behavior, which can call `end()` on a late failure. The Vercel `api/index.js` entry point passes through the original request/response and now awaits response finish/close, keeping its invocation promise active throughout the stream.

The existing `maxDuration: 120` remains unchanged. Allow budget for catalog metadata/Tailscale startup plus the transfer deadline, and verify the project's plan/Fluid Compute setting supports it; consult [Vercel's duration configuration](https://vercel.com/docs/functions/configuring-functions/duration). No Tailscale setup was replaced. Local Express streaming and entry-point lifecycle tests do not establish Vercel deployment compatibility; the deployed path must be tested separately.

## PowerShell verification

From the repository root:

```powershell
Set-Location backend/catalog-service
npm.cmd test
npm.cmd run build
git diff --check

# Read-only smoke test; credentials are loaded from the existing backend .env.
$env:LIRA_USE_TAILSCALE = '0'
$env:KOHA_BASE_URL = 'http://100.118.244.66:8081'
$env:KOHA_OPAC_BASE_URL = 'http://100.118.244.66:8080'
$env:EBOOK_MAX_BYTES = '64000000'
$env:EBOOK_TIMEOUT_MS = '60000'
node scripts/smoke-book-resources.mjs 440
```

The smoke script starts a temporary local Nest app, reads the selected book, streams each attachment to a byte counter/SHA-256 hash, compares it with a separate complete Koha stream, checks reader JSON, and closes the app. Neither transfer is buffered as a whole file. It does not write to Koha or save attachments. The book ID is a command-line parameter.

For a running backend, inspect/download a selected resource without hardcoding its ID:

```powershell
$backend = 'http://localhost:3001' # Or the deployed backend origin.
$book = Invoke-RestMethod "$backend/api/catalog/books/440"
$book.resources | Format-Table id, format, label, mediaType
$resource = $book.resources | Where-Object { $_.contentUrl -and $_.label -eq 'PDF upload test' } | Select-Object -First 1
if (-not $resource) { throw 'Select a permitted resource from the book response' }
Invoke-WebRequest "$backend$($resource.contentUrl)" -OutFile "$env:TEMP/lira-resource.bin"
Get-FileHash "$env:TEMP/lira-resource.bin" -Algorithm SHA256
Invoke-RestMethod "$backend/api/catalog/books/440/content"
```

The example label is only a smoke-test selection; application retrieval uses the supplied stable ID and current metadata, without hardcoded book IDs, attachment hashes or formats.

## Verify the deployed endpoint after deployment

No deployment was performed as part of this change. After a separately authorized deployment, set backend `KOHA_OPAC_BASE_URL=http://100.118.244.66:8080`, `LIRA_USE_TAILSCALE=1`, the existing `TS_AUTHKEY`, `EBOOK_MAX_BYTES=64000000`, `EBOOK_TIMEOUT_MS=60000` and `EBOOK_READER_MAX_BYTES=4000000`. Retain the existing staff/API URL and function duration. Remove any older 4 MB streaming limit from the backend environment.

From Windows with installed Tailscale and direct Koha access, run the same script against the deployed backend origin:

```powershell
$env:KOHA_BASE_URL = 'http://100.118.244.66:8081'
$env:KOHA_OPAC_BASE_URL = 'http://100.118.244.66:8080'
$env:EBOOK_MAX_BYTES = '64000000'
node scripts/smoke-book-resources.mjs 440 'https://YOUR-BACKEND.vercel.app'
```

The optional origin makes the script call the deployed HTTP routes instead of starting a local app. It still compares against direct Koha from Windows and sends no Koha credentials to Vercel. Expect HTTP 200, the complete EPUB count/hash listed below, matching PDF count/hash, and compatible reader JSON. Any platform payload-limit error, aborted stream, timeout, wrong count/hash or protected-deployment response fails the check; do not declare deployment success from headers/status alone. A protected deployment must be accessible to the verification client first.

For independent file verification, fetch catalog metadata, select the intended EPUB by its returned ID/label, then download its `contentUrl` with `curl.exe --fail --show-error --output "$env:TEMP/lira-epub.epub" "$backend$($resource.contentUrl)"`. Require curl exit code 0, inspect `(Get-Item "$env:TEMP/lira-epub.epub").Length`, and run `Get-FileHash "$env:TEMP/lira-epub.epub" -Algorithm SHA256`. Repeat from a cold invocation and abort one request during transfer to check cancellation/logs. Only testing this deployed route establishes that the project's Vercel runtime/entry point streams beyond 4.5 MB.

## Verified results

The initial baseline was 9 suites / 55 tests. Final validation passes 13 suites / 129 tests, the Nest build and `git diff --check`. Streaming tests additionally cover delivery before EOF, >4 MB integrity, split/replayed signatures, bounded source consumption, compressed streaming, cancellation, upstream/limit/timeout errors after headers, declared truncation, downstream drain deadlines and Vercel entry-point finish/close lifetime. Tests cover local/deployed transport selection; deployment-side transport remains mocked. Repository-wide lint has three existing `no-require-imports` violations in `catalog.controller.spec.ts`, `request-logging.spec.ts` and `tailscale-vercel.spec.ts`.

Read-only local Windows smoke results for book 440:

- Four resources returned; `url` remains intact and the controlled category is `Literature`.
- PDF: HTTP 200, `application/pdf`, 168,420 bytes, with the same count/SHA-256 as an independent complete Koha stream. SHA-256: `7eef3c24e9d329b7bd161eaf8e3ad9c94250c660f1071bca0a9f725d38746290`.
- EPUB: HTTP 200, `application/epub+zip`, all 24,836,548 bytes received, with the same count/SHA-256 as an independent complete Koha stream. SHA-256: `d401ad6b118e84d01b8dd1a3d034fd41784feb14c50f1f7a0fc17f3263fa8e9f`. The live attachment metadata still reports `unknown` because its 856 field lacks `$q`; retrieval validates the actual MIME/signature.
- Existing HTML reader: HTTP 200 JSON with 852,590 content bytes; resolved URL `https://www.gutenberg.org/cache/epub/1342/pg1342-images.html`.

Deployed Vercel attachment retrieval was not exercised; deployed proxy selection is covered by mocked transport tests and the existing Tailscale test suite. No records, attachments or Koha settings were changed, and no commit/push/deployment was performed.

Publication-date enrichment and cover work remain outstanding and outside this change. Missing bibliographic dates are not inferred from generated descriptions. Resource formats are not inferred from descriptions, labels or opaque URL hashes; catalog classification remains based on explicit metadata and supported URL extensions, while retrieval checks actual response types/signatures.
