import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { createServer, Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { Readable } from 'node:stream';
import { gzipSync } from 'node:zlib';
import { of, throwError } from 'rxjs';
import { buildBookResources } from '../src/catalog/book-resources';
import { ResourceContentService } from '../src/catalog/resource-content.service';
import * as tailscale from '../src/tailscale-vercel';
import { epubBytes, pdfBytes } from './resource-fixtures';

describe('ResourceContentService', () => {
  const opac = 'http://100.118.244.66:8080';
  const attachmentUrl = `${opac}/cgi-bin/koha/opac-retrieve-file.pl?id=fixture`;
  const get = jest.fn();
  let service: ResourceContentService;
  const originalFlag = process.env.LIRA_USE_TAILSCALE;

  function config(overrides: Record<string, unknown> = {}): ConfigService {
    const values: Record<string, unknown> = {
      'app.koha.baseUrl': 'http://100.118.244.66:8081',
      'app.resources.opacBaseUrl': opac,
      'app.resources.timeoutMs': 500,
      'app.resources.maxBytes': 4000000,
      ...overrides,
    };
    return { get: (key: string) => values[key], getOrThrow: (key: string) => values[key] } as unknown as ConfigService;
  }

  function resource(format = 'PDF', url = attachmentUrl) {
    return buildBookResources([{ url, formats: format ? [format] : [], labels: [] }])[0];
  }

  function upstream(bytes: Buffer, headers: Record<string, string> = {}, status = 200) {
    const data = Readable.from([bytes]);
    return { data, status, headers };
  }

  beforeEach(() => {
    process.env.LIRA_USE_TAILSCALE = '0';
    get.mockReset();
    service = new ResourceContentService({ get } as unknown as HttpService, config());
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (originalFlag === undefined) delete process.env.LIRA_USE_TAILSCALE;
    else process.env.LIRA_USE_TAILSCALE = originalFlag;
  });

  it.each([
    ['PDF', 'application/pdf', pdfBytes, 'pdf'],
    ['EPUB', 'application/epub+zip', epubBytes, 'epub'],
  ])('returns %s bytes unchanged with the canonical media type and filename', async (format, mediaType, bytes, extension) => {
    get.mockReturnValue(of(upstream(bytes as Buffer, { 'content-type': mediaType as string })));
    const result = await service.retrieve(resource(format as string), 'Test title');
    expect(result.bytes.equals(bytes as Buffer)).toBe(true);
    expect(result).toMatchObject({ mediaType, filename: `Test title.${extension}`, sourceUrl: attachmentUrl, resolvedUrl: attachmentUrl });
  });

  it('uses direct transport with local Tailscale, without sending Koha credentials', async () => {
    const proxy = jest.spyOn(tailscale, 'getTailscaleProxy');
    get.mockReturnValue(of(upstream(pdfBytes, { 'content-type': 'application/pdf' })));
    await service.retrieve(resource(), null);
    expect(proxy).toHaveBeenCalledTimes(1);
    expect(get.mock.calls[0][1]).toMatchObject({ proxy: false, responseType: 'stream', maxRedirects: 0, timeout: 500 });
    expect(get.mock.calls[0][1]).not.toHaveProperty('auth');
    expect(get.mock.calls[0][1].headers).not.toHaveProperty('Authorization');
  });

  it('uses the existing embedded Tailscale proxy for deployed attachments', async () => {
    process.env.LIRA_USE_TAILSCALE = '1';
    const proxy = { protocol: 'http', host: '127.0.0.1', port: 1055 };
    jest.spyOn(tailscale, 'getTailscaleProxy').mockResolvedValue(proxy);
    get.mockReturnValue(of(upstream(epubBytes, { 'content-type': 'application/epub+zip' })));
    await service.retrieve(resource('EPUB'), null);
    expect(get.mock.calls[0][1].proxy).toEqual(proxy);
  });

  it('fails safely instead of falling back to direct access on Tailscale failure', async () => {
    jest.spyOn(tailscale, 'getTailscaleProxy').mockRejectedValue(new Error('private-key'));
    await expect(service.retrieve(resource(), null)).rejects.toMatchObject({ status: 503, message: 'Resource content is unavailable' });
    expect(get).not.toHaveBeenCalled();
  });

  it('keeps known unsupported MIME formats unavailable without fetching them', async () => {
    const image = resource('image/jpeg', 'https://www.gutenberg.org/image.jpg');
    expect(service.canRetrieve(image.sourceUrl, image.mediaType)).toBe(false);
    await expect(service.retrieve(image, null)).rejects.toMatchObject({ status: 400 });
    expect(get).not.toHaveBeenCalled();
  });

  it('bounds time spent waiting for Tailscale initialization', async () => {
    jest.spyOn(tailscale, 'getTailscaleProxy').mockImplementation(() => new Promise(() => {}));
    service = new ResourceContentService({ get } as unknown as HttpService, config({ 'app.resources.timeoutMs': 100 }));
    await expect(service.retrieve(resource(), null)).rejects.toMatchObject({ status: 504 });
    expect(get).not.toHaveBeenCalled();
  });

  it.each([
    'http://127.0.0.1/private', 'http://169.254.169.254/latest/meta-data/',
    'http://100.118.244.66:8081/api/v1/biblios',
    `${opac}/cgi-bin/koha/opac-user.pl?id=fixture`,
    `${attachmentUrl}&id=second`, `${attachmentUrl}&extra=1`,
    `${opac}/cgi-bin/koha/opac-retrieve-file.pl`,
    `${opac}/cgi-bin/koha/opac-retrieve-file.pl?id=%2Fetc%2Fpasswd`,
    'https://www.gutenberg.org.evil.example/a.pdf',
    'https://user:secret@www.gutenberg.org/a.pdf', 'file:///etc/passwd',
  ])('blocks destination %s before making a request', async (url) => {
    expect(service.canRetrieve(url)).toBe(false);
    await expect(service.retrieve(resource('PDF', url), null)).rejects.toMatchObject({ status: 400 });
    expect(get).not.toHaveBeenCalled();
  });

  it('revalidates a redirect to an unapproved host and destroys the upstream body', async () => {
    const redirect = upstream(Buffer.alloc(0), { location: 'http://127.0.0.1/private' }, 302);
    get.mockReturnValue(of(redirect));
    await expect(service.retrieve(resource(), null)).rejects.toMatchObject({ status: 400 });
    expect(get).toHaveBeenCalledTimes(1);
    expect(redirect.data.destroyed).toBe(true);
  });

  it('blocks a redirect from an attachment into another Koha route', async () => {
    get.mockReturnValue(of(upstream(Buffer.alloc(0), { location: '/cgi-bin/koha/opac-user.pl' }, 302)));
    await expect(service.retrieve(resource(), null)).rejects.toMatchObject({ status: 400 });
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('follows relative permitted redirects and recalculates transport for public destinations', async () => {
    const proxy = { protocol: 'http', host: '127.0.0.1', port: 1055 };
    jest.spyOn(tailscale, 'getTailscaleProxy').mockResolvedValue(proxy);
    get.mockReturnValueOnce(of(upstream(Buffer.alloc(0), { location: '?id=next' }, 302)))
      .mockReturnValueOnce(of(upstream(Buffer.alloc(0), { location: 'https://www.gutenberg.org/file.pdf' }, 301)))
      .mockReturnValueOnce(of(upstream(pdfBytes, { 'content-type': 'application/pdf' })));
    await expect(service.retrieve(resource(), null)).resolves.toMatchObject({ resolvedUrl: 'https://www.gutenberg.org/file.pdf' });
    expect(get.mock.calls[1][0]).toBe(`${opac}/cgi-bin/koha/opac-retrieve-file.pl?id=next`);
    expect(get.mock.calls.map(([, options]) => options.proxy)).toEqual([proxy, proxy, false]);
    for (const [, options] of get.mock.calls) expect(options).not.toHaveProperty('auth');
  });

  it('blocks redirects to origins excluded by configuration, and bounds redirect loops', async () => {
    service = new ResourceContentService({ get } as unknown as HttpService, config({ 'app.resources.allowedOrigins': ['https://www.gutenberg.org'] }));
    get.mockReturnValue(of(upstream(Buffer.alloc(0), { location: 'http://www.gutenberg.org/file.pdf' }, 302)));
    await expect(service.retrieve(resource('PDF', 'https://www.gutenberg.org/file.pdf'), null)).rejects.toMatchObject({ status: 400 });
    get.mockClear().mockReturnValue(of(upstream(Buffer.alloc(0), { location: attachmentUrl }, 302)));
    await expect(service.retrieve(resource(), null)).rejects.toMatchObject({ status: 502 });
    expect(get).toHaveBeenCalledTimes(4);
  });

  it('preserves Gutenberg redirects to its explicitly permitted HTTP origin, removing fragments', async () => {
    get.mockReturnValueOnce(of(upstream(Buffer.alloc(0), { location: 'http://www.gutenberg.org/cache/book.html#start' }, 302)))
      .mockReturnValueOnce(of(upstream(Buffer.from('<html>Read online</html>'), { 'content-type': 'text/html; charset=utf-8' })));
    const result = await service.retrieve(resource('text/html', 'https://www.gutenberg.org/book.html'), null);
    expect(result.resolvedUrl).toBe('http://www.gutenberg.org/cache/book.html');
    expect(get.mock.calls[1][0]).toBe(result.resolvedUrl);
  });

  it.each([401, 403, 404, 429, 500, 206])('does not return upstream HTTP %i as successful content', async (status) => {
    get.mockReturnValue(of(upstream(pdfBytes, { 'content-type': 'application/pdf' }, status)));
    await expect(service.retrieve(resource(), null)).rejects.toMatchObject({ status: status === 404 ? 404 : 502 });
  });

  it('maps connection failures without exposing upstream details', async () => {
    get.mockReturnValue(throwError(() => new Error('private upstream data')));
    await expect(service.retrieve(resource(), null)).rejects.toMatchObject({ status: 503, message: 'Resource content is unavailable' });
  });

  it('discards partially received binary content if the upstream body fails', async () => {
    const data = Readable.from((async function* () {
      yield pdfBytes.subarray(0, 10);
      throw new Error('private upstream error');
    })());
    get.mockReturnValue(of({ data, status: 200, headers: { 'content-type': 'application/pdf' } }));
    await expect(service.retrieve(resource(), null)).rejects.toMatchObject({ status: 503, message: 'Resource content is unavailable' });
    expect(data.destroyed).toBe(true);
  });

  it.each(['application/pdf', 'application/epub+zip', 'text/html'])('rejects HTML error pages labeled %s', async (type) => {
    get.mockReturnValue(of(upstream(Buffer.from('<html>Attachment not found</html>'), { 'content-type': type })));
    await expect(service.retrieve(resource(type === 'application/epub+zip' ? 'EPUB' : 'PDF'), null)).rejects.toMatchObject({ status: 502 });
  });

  it('rejects a generic ZIP masquerading as EPUB', async () => {
    get.mockReturnValue(of(upstream(Buffer.from('PK\x03\x04' + 'x'.repeat(100)), { 'content-type': 'application/epub+zip' })));
    await expect(service.retrieve(resource('EPUB'), null)).rejects.toMatchObject({ status: 502 });
  });

  it('retrieves unclassified attachments using MIME/signatures but rejects OPAC HTML fallback pages', async () => {
    get.mockReturnValueOnce(of(upstream(epubBytes, { 'content-type': 'application/octet-stream' })))
      .mockReturnValueOnce(of(upstream(pdfBytes, { 'content-type': 'application/pdf' })))
      .mockReturnValueOnce(of(upstream(Buffer.from('<html>Login</html>'), { 'content-type': 'text/html' })));
    await expect(service.retrieve(resource(''), null)).resolves.toMatchObject({ mediaType: 'application/epub+zip' });
    await expect(service.retrieve(resource(''), null)).resolves.toMatchObject({ mediaType: 'application/pdf' });
    await expect(service.retrieve(resource(''), null)).rejects.toMatchObject({ status: 502 });
  });

  it('sanitizes an upstream UTF-8 filename and forces the verified extension', async () => {
    get.mockReturnValue(of(upstream(pdfBytes, { 'content-type': 'application/pdf',
      'content-disposition': "attachment; filename*=UTF-8''..%2Fbad%22%0D%0AX-Header%3A%20value.exe" })));
    const result = await service.retrieve(resource(), null);
    expect(result.filename).toMatch(/^[a-zA-Z0-9 ._-]+\.pdf$/);
    expect(result.filename).not.toMatch(/["\r\n/\\]/);
  });

  it('rejects oversized declared lengths before reading and enforces the actual byte limit without a length', async () => {
    service = new ResourceContentService({ get } as unknown as HttpService, config({ 'app.resources.maxBytes': 100 }));
    const declared = upstream(pdfBytes, { 'content-length': '101', 'content-type': 'application/pdf' });
    get.mockReturnValueOnce(of(declared))
      .mockReturnValueOnce(of({ data: Readable.from([Buffer.alloc(60), Buffer.alloc(60)]), status: 200, headers: {} }))
      .mockReturnValueOnce(of(upstream(Buffer.alloc(101), { 'content-length': '1' })));
    await expect(service.retrieve(resource(), null)).rejects.toMatchObject({ status: 413 });
    expect(declared.data.destroyed).toBe(true);
    await expect(service.retrieve(resource(), null)).rejects.toMatchObject({ status: 413 });
    await expect(service.retrieve(resource(), null)).rejects.toMatchObject({ status: 413 });
  });

  it('aborts stalled response bodies within the overall timeout', async () => {
    const data = new Readable({ read() {} });
    get.mockReturnValue(of({ data, status: 200, headers: {} }));
    service = new ResourceContentService({ get } as unknown as HttpService, config({ 'app.resources.timeoutMs': 100 }));
    await expect(service.retrieve(resource(), null)).rejects.toMatchObject({ status: 504 });
    expect(data.destroyed).toBe(true);
  });

  it('enforces the decompressed byte limit using the real Axios HTTP transport', async () => {
    let server: Server | undefined;
    try {
      const compressed = gzipSync(Buffer.alloc(101, 65));
      server = createServer((_req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/plain', 'Content-Encoding': 'gzip', 'Content-Length': compressed.length });
        res.end(compressed);
      });
      await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
      const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
      service = new ResourceContentService(new HttpService(), config({ 'app.resources.maxBytes': 100, 'app.resources.allowedOrigins': [origin] }));
      await expect(service.retrieve(resource('text/plain', `${origin}/test.txt`), null)).rejects.toMatchObject({ status: 413 });
    } finally {
      if (server) {
        server.closeAllConnections();
        await new Promise<void>((resolve) => server!.close(() => resolve()));
      }
    }
  });
});
