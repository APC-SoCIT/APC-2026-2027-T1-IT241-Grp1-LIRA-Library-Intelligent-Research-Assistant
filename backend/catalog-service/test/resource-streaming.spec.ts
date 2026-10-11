import { HttpService } from '@nestjs/axios';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { createHash } from 'node:crypto';
import { createServer, Server, ServerResponse } from 'node:http';
import { AddressInfo } from 'node:net';
import { Readable, Writable } from 'node:stream';
import { EventEmitter } from 'node:events';
import { Request, Response } from 'express';
import { gzipSync } from 'node:zlib';
import { of } from 'rxjs';
import { CatalogController } from '../src/catalog/catalog.controller';
import { CatalogService } from '../src/catalog/catalog.service';
import { ResourceContentService } from '../src/catalog/resource-content.service';
import { buildBookResources } from '../src/catalog/book-resources';
import { LibrarianGuard } from '../src/shared/librarian.guard';
import { epubBytes, pdfBytes } from './resource-fixtures';

const pdfPrefix = Buffer.concat([pdfBytes, Buffer.alloc(1024 - pdfBytes.length, 65)]);
const digest = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
};

describe('Resource streaming through the actual Nest Express adapter', () => {
  let upstream: Server;
  let app: INestApplication;
  let origin: string;
  let contentPath: string;
  let handle: (response: ServerResponse) => void;
  const settings: Record<string, unknown> = {};
  const originalFlag = process.env.LIRA_USE_TAILSCALE;

  beforeAll(async () => {
    process.env.LIRA_USE_TAILSCALE = '0';
    upstream = createServer((_request, response) => handle(response));
    await new Promise<void>((resolve) => upstream.listen(0, '127.0.0.1', resolve));
    const opac = `http://127.0.0.1:${(upstream.address() as AddressInfo).port}`;
    settings['app.resources.opacBaseUrl'] = opac;
    const config = { get: (key: string) => settings[key] } as unknown as ConfigService;
    const resources = buildBookResources([], `${opac}/cgi-bin/koha/opac-retrieve-file.pl?id=fixture`);
    const content = new ResourceContentService(new HttpService(), config);
    const module = await Test.createTestingModule({
      controllers: [CatalogController],
      providers: [
        { provide: CatalogService, useValue: {
          getResourceContent: (_id: number, _resourceId: string, signal: AbortSignal) =>
            // Construct with each test's settings while retaining real Axios.
            new ResourceContentService(new HttpService(), config).openStream(resources[0], 'Test book', signal),
        } },
        { provide: LibrarianGuard, useValue: { canActivate: () => true } },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();
    expect(content.maxBytes).toBe(64000000);
    app = module.createNestApplication();
    await app.listen(0, '127.0.0.1');
    origin = await app.getUrl();
    contentPath = `/api/catalog/books/1/resources/${resources[0].id}/content`;
  });

  beforeEach(() => {
    settings['app.resources.maxBytes'] = 64000000;
    settings['app.resources.timeoutMs'] = 2000;
  });

  afterAll(async () => {
    await app.close();
    upstream.closeAllConnections();
    await new Promise<void>((resolve) => upstream.close(() => resolve()));
    if (originalFlag === undefined) delete process.env.LIRA_USE_TAILSCALE;
    else process.env.LIRA_USE_TAILSCALE = originalFlag;
  });

  it('delivers bytes before upstream EOF and preserves a >4 MB EPUB including the inspected prefix', async () => {
    const gate = deferred();
    const remainder = Buffer.alloc(5_000_000, 0xa7);
    const expectedHash = createHash('sha256').update(epubBytes).update(remainder).digest('hex');
    let ended = false;
    handle = (res) => {
      res.writeHead(200, { 'Content-Type': 'application/epub+zip', 'Content-Length': epubBytes.length + remainder.length });
      res.write(epubBytes);
      void gate.promise.then(() => { ended = true; res.end(remainder); });
    };
    const response = await fetch(origin + contentPath);
    const reader = response.body!.getReader();
    const first = await reader.read();
    expect(first.value!.length).toBeGreaterThan(0);
    expect(ended).toBe(false); // A buffering implementation would stall here.
    gate.resolve();
    let bytes = first.value!.length;
    const hash = createHash('sha256').update(first.value!);
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.length;
      hash.update(part.value);
    }
    expect(bytes).toBe(epubBytes.length + remainder.length);
    expect(hash.digest('hex')).toBe(expectedHash);
    expect(response.headers.get('content-type')).toBe('application/epub+zip');
    expect(response.headers.get('content-disposition')).toBe('inline; filename="Test book.epub"');
  });

  it('returns safe JSON before headers for invalid binary content and declared oversize files', async () => {
    handle = (res) => { res.writeHead(200, { 'Content-Type': 'application/pdf' }); res.end('<html>Private error page</html>'); };
    let response = await fetch(origin + contentPath);
    expect(response.status).toBe(502);
    expect(response.headers.get('content-type')).toMatch(/application\/json/);
    expect(response.headers.has('content-disposition')).toBe(false);
    expect(JSON.stringify(await response.json())).not.toContain('Private');
    settings['app.resources.maxBytes'] = 2048;
    handle = (res) => { res.writeHead(200, { 'Content-Type': 'application/pdf', 'Content-Length': '10000' }); res.end(pdfPrefix); };
    response = await fetch(origin + contentPath);
    expect(response.status).toBe(413);
    expect(response.headers.get('content-type')).toMatch(/application\/json/);
    await response.body?.cancel();
  });

  it.each(['failure', 'limit', 'timeout'])('aborts an incomplete transfer after headers on %s without appending JSON', async (scenario) => {
    const gate = deferred();
    settings['app.resources.maxBytes'] = scenario === 'limit' ? 2048 : 64000000;
    settings['app.resources.timeoutMs'] = scenario === 'timeout' ? 200 : 2000;
    handle = (res) => {
      res.writeHead(200, { 'Content-Type': 'application/pdf' });
      res.write(pdfPrefix);
      void gate.promise.then(() => {
        if (scenario === 'failure') res.destroy(new Error('private failure'));
        else if (scenario === 'limit') res.end(Buffer.alloc(4096));
        // Timeout intentionally leaves the body open.
      });
    };
    const response = await fetch(origin + contentPath);
    expect(response.status).toBe(200);
    const reader = response.body!.getReader();
    const first = await reader.read();
    expect(first.value?.length).toBe(1024);
    gate.resolve();
    await expect(reader.read()).rejects.toThrow();
  });

  it('cancels Koha promptly when the HTTP client disconnects', async () => {
    const closed = deferred();
    handle = (res) => {
      res.once('close', closed.resolve);
      res.writeHead(200, { 'Content-Type': 'application/pdf' });
      res.write(pdfPrefix);
    };
    const abort = new AbortController();
    const response = await fetch(origin + contentPath, { signal: abort.signal });
    await response.body!.getReader().read();
    abort.abort();
    await closed.promise;
  });

  it('streams decoded gzip bytes intact without forwarding a compressed Content-Length', async () => {
    const bytes = Buffer.concat([epubBytes, Buffer.alloc(100000, 0x81)]);
    const compressed = gzipSync(bytes);
    handle = (res) => {
      res.writeHead(200, { 'Content-Type': 'application/epub+zip', 'Content-Encoding': 'gzip', 'Content-Length': compressed.length });
      res.end(compressed);
    };
    const response = await fetch(origin + contentPath);
    expect(response.headers.has('content-length')).toBe(false);
    expect(response.headers.has('content-encoding')).toBe(false);
    expect(digest(Buffer.from(await response.arrayBuffer()))).toBe(digest(bytes));
  });
});

describe('Resource stream memory and validation', () => {
  const values: Record<string, unknown> = { 'app.resources.opacBaseUrl': 'http://koha.test:8080' };
  const config = { get: (key: string) => values[key] } as unknown as ConfigService;
  const resource = buildBookResources([], 'http://koha.test:8080/cgi-bin/koha/opac-retrieve-file.pl?id=fixture')[0];
  const originalFlag = process.env.LIRA_USE_TAILSCALE;
  beforeEach(() => { process.env.LIRA_USE_TAILSCALE = '0'; });
  afterEach(() => {
    if (originalFlag === undefined) delete process.env.LIRA_USE_TAILSCALE;
    else process.env.LIRA_USE_TAILSCALE = originalFlag;
  });

  it('does not consume the entire source while waiting for the HTTP consumer', async () => {
    let produced = 0;
    const source = Readable.from((async function* () {
      produced++;
      yield pdfPrefix;
      for (let index = 0; index < 1000; index++) { produced++; yield Buffer.alloc(4096); }
    })(), { objectMode: false, highWaterMark: 4096 });
    const get = () => of({ data: source, status: 200, headers: { 'content-type': 'application/pdf' } });
    const result = await new ResourceContentService({ get } as unknown as HttpService, config).openStream(resource, null);
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(produced).toBeLessThan(5);
    result.cancel();
    expect(source.destroyed).toBe(true);
  });

  it('preserves an EPUB signature split over one-byte upstream chunks', async () => {
    const data = Readable.from([...epubBytes].map((byte) => Buffer.from([byte])), { objectMode: false });
    const get = () => of({ data, status: 200, headers: { 'content-type': 'application/octet-stream' } });
    const result = await new ResourceContentService({ get } as unknown as HttpService, config).openStream(resource, null);
    const chunks: Buffer[] = [];
    for await (const chunk of result.stream) chunks.push(chunk as Buffer);
    expect(Buffer.concat(chunks).equals(epubBytes)).toBe(true);
    expect(result.mediaType).toBe('application/epub+zip');
    result.cancel();
  });

  it('rejects a truncated declared body instead of completing the stream', async () => {
    const get = () => of({ data: Readable.from([pdfPrefix]), status: 200,
      headers: { 'content-type': 'application/pdf', 'content-length': '2048' } });
    const result = await new ResourceContentService({ get } as unknown as HttpService, config).openStream(resource, null);
    const consume = async () => { for await (const chunk of result.stream) expect(chunk).toBeDefined(); };
    await expect(consume()).rejects.toMatchObject({ status: 502 });
    result.cancel();
  });

  it.each([false, true])('times out while waiting for downstream drain, including upstream EOF=%s', async (ended) => {
    class SlowResponse extends Writable {
      headersSent = false;
      setHeader() {}
      removeHeader() {}
      // No callback: simulate a connected HTTP consumer that never drains.
      _write() { this.headersSent = true; }
    }
    const response = new SlowResponse({ highWaterMark: 1 });
    const data = ended ? Readable.from([pdfPrefix], { objectMode: false })
      : new Readable({ read() { if (!this.readableLength) this.push(pdfPrefix); } });
    const get = () => of({ data, status: 200, headers: { 'content-type': 'application/pdf' } });
    const timeoutConfig = { get: (key: string) => key === 'app.resources.timeoutMs' ? 100 : values[key] } as unknown as ConfigService;
    const service = new ResourceContentService({ get } as unknown as HttpService, timeoutConfig);
    const controller = new CatalogController({
      getResourceContent: (_id: number, _resourceId: string, signal: AbortSignal) => service.openStream(resource, null, signal),
    } as unknown as CatalogService);
    await controller.getResourceContent(1, resource.id, new EventEmitter() as Request, response as unknown as Response);
    expect(response.destroyed).toBe(true);
    expect(data.destroyed).toBe(true);
  });
});
