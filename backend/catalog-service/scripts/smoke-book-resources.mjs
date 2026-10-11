import 'reflect-metadata';
import dotenv from 'dotenv';
import axios from 'axios';
import { createHash } from 'node:crypto';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createApp } from '../dist/create-app.js';
import { defaultOpacUrl, DEFAULT_RESOURCE_BYTES } from '../dist/catalog/resource-policy.js';

dotenv.config({ quiet: true });
const bookId = Number(process.argv[2]);
if (!Number.isSafeInteger(bookId) || bookId < 1) throw new Error('Pass a positive book ID');
const remoteOrigin = process.argv[3];
if (!remoteOrigin && process.env.LIRA_USE_TAILSCALE === '1') throw new Error('Local Windows verification requires LIRA_USE_TAILSCALE=0');
if (remoteOrigin) {
  const url = new URL(remoteOrigin);
  if (!['http:', 'https:'].includes(url.protocol) || url.origin !== remoteOrigin || url.username || url.password) {
    throw new Error('Pass a backend HTTP(S) origin without paths or credentials');
  }
}
Logger.overrideLogger(['error', 'warn']);
const app = remoteOrigin ? undefined : await createApp();
try {
  if (app) await app.listen(0, '127.0.0.1');
  const baseUrl = remoteOrigin ?? await app.getUrl();
  const maxBytes = app ? app.get(ConfigService).getOrThrow('app.resources.maxBytes')
    : Number(process.env.EBOOK_MAX_BYTES ?? DEFAULT_RESOURCE_BYTES);
  const opacOrigin = new URL(process.env.KOHA_OPAC_BASE_URL || defaultOpacUrl(process.env.KOHA_BASE_URL)).origin;
  const request = (path) => fetch(`${baseUrl}${path}`, { signal: AbortSignal.timeout(90000) });
  const get = async (path) => {
    const response = await request(path);
    if (!response.ok) {
      const failure = await response.json().catch(() => null);
      throw new Error(`LIRA returned HTTP ${response.status}${typeof failure?.message === 'string' ? ': ' + failure.message : ''}`);
    }
    return response;
  };
  const measure = async (stream) => {
    const hash = createHash('sha256');
    let bytes = 0;
    for await (const chunk of stream) {
      bytes += chunk.length;
      if (bytes > maxBytes) throw new Error('Verification exceeded configured transfer limit');
      hash.update(chunk);
    }
    return { bytes, sha256: hash.digest('hex') };
  };
  const book = await (await get(`/api/catalog/books/${bookId}`)).json();
  console.log(JSON.stringify({ target: app ? 'local Nest Express adapter' : baseUrl,
    bookId, title: book.title, categories: book.categories, resources: book.resources }, null, 2));
  const attachments = book.resources.filter((resource) => {
    const url = new URL(resource.sourceUrl);
    return resource.contentUrl && url.origin === opacOrigin && !url.username && !url.password
      && url.pathname === '/cgi-bin/koha/opac-retrieve-file.pl';
  });
  if (!attachments.length) throw new Error('Book has no retrievable Koha attachments');
  for (const resource of attachments) {
    const started = Date.now();
    const response = await get(resource.contentUrl);
    const firstResponseMs = Date.now() - started;
    const result = await measure(response.body);
    const upstream = await axios.get(resource.sourceUrl, {
      proxy: false, responseType: 'stream', maxRedirects: 0,
      timeout: 60000, signal: AbortSignal.timeout(90000),
    });
    let original;
    try { original = await measure(upstream.data); } finally { upstream.data.destroy(); }
    if (result.bytes !== original.bytes || result.sha256 !== original.sha256) throw new Error('Attachment count/hash differ from Koha');
    const length = response.headers.get('content-length');
    if (length && Number(length) !== result.bytes) throw new Error('Response length does not match received bytes');
    console.log(JSON.stringify({ resourceId: resource.id, status: response.status,
      mediaType: response.headers.get('content-type'), disposition: response.headers.get('content-disposition'),
      ...result, matchesKoha: true, firstResponseMs, totalMs: Date.now() - started }));
  }
  const reader = await (await get(`/api/catalog/books/${bookId}/content`)).json();
  if (typeof reader.content !== 'string' || !reader.content.length) throw new Error('Empty reader content');
  console.log(JSON.stringify({ readerContentBytes: Buffer.byteLength(reader.content), readerResolvedUrl: reader.resolvedUrl }));
} catch (error) {
  console.error(error instanceof Error && !axios.isAxiosError(error) ? error.message : 'Live upstream comparison failed');
  process.exitCode = 1;
} finally {
  await app?.close();
}
