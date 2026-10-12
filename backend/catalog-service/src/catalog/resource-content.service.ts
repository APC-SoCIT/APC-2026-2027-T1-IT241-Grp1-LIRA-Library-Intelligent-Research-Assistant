import { HttpService } from '@nestjs/axios';
import { BadGatewayException, BadRequestException, GatewayTimeoutException, HttpException, HttpStatus, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { pipeline, Readable, Transform } from 'node:stream';
import { createBrotliDecompress, createGunzip, createInflate } from 'node:zlib';
import { firstValueFrom } from 'rxjs';
import { getTailscaleProxy } from '../tailscale-vercel';
import { mediaTypeFormat, resourceMediaTypes } from './book-resources';
import { BookResource, ResourceContent, ResourceFormat, ResourceStream } from './resource.types';
import { defaultOpacUrl, DEFAULT_RESOURCE_ORIGINS, DEFAULT_RESOURCE_BYTES, MAX_RESOURCE_BYTES, MAX_READER_BYTES } from './resource-policy';

@Injectable()
export class ResourceContentService {
  private readonly opacOrigin: string;
  private readonly allowedOrigins: Set<string>;
  private readonly timeoutMs: number;
  readonly maxBytes: number;
  readonly readerMaxBytes: number;

  constructor(private readonly http: HttpService, config: ConfigService) {
    this.opacOrigin = new URL(config.get<string>('app.resources.opacBaseUrl')
      ?? defaultOpacUrl(config.getOrThrow<string>('app.koha.baseUrl'))).origin;
    this.allowedOrigins = new Set((config.get<string[]>('app.resources.allowedOrigins') ?? DEFAULT_RESOURCE_ORIGINS)
      .map((origin) => new URL(origin).origin));
    this.timeoutMs = config.get<number>('app.resources.timeoutMs') ?? 60000;
    this.maxBytes = Math.min(config.get<number>('app.resources.maxBytes') ?? DEFAULT_RESOURCE_BYTES, MAX_RESOURCE_BYTES);
    this.readerMaxBytes = config.get<number>('app.resources.readerMaxBytes') ?? MAX_READER_BYTES;
  }

  canRetrieve(sourceUrl: string, mediaType: string | null = null): boolean {
    try { this.destination(sourceUrl); return this.supportedMediaType(mediaType); } catch { return false; }
  }

  private destination(sourceUrl: string): { url: URL; koha: boolean } {
    let url: URL;
    try { url = new URL(sourceUrl); } catch { throw new BadRequestException('Invalid resource destination'); }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.hash) {
      throw new BadRequestException('Resource destination is not permitted');
    }
    if (url.origin === this.opacOrigin) {
      const ids = url.searchParams.getAll('id');
      if (url.pathname !== '/cgi-bin/koha/opac-retrieve-file.pl' || ids.length !== 1
        || !/^[a-zA-Z0-9_-]{1,128}$/.test(ids[0]) || [...url.searchParams.keys()].some((key) => key !== 'id')) {
        throw new BadRequestException('Koha attachment route is not permitted');
      }
      return { url, koha: true };
    }
    if (!this.allowedOrigins.has(url.origin)) throw new BadRequestException('Resource destination is not permitted');
    return { url, koha: false };
  }

  async retrieve(resource: BookResource, bookTitle: string | null): Promise<ResourceContent> {
    // Only the legacy HTML/text JSON reader collects a bounded body in memory.
    const content = await this.openStream(resource, bookTitle, undefined, Math.min(this.readerMaxBytes, this.maxBytes));
    try {
      const chunks: Buffer[] = [];
      for await (const chunk of content.stream) chunks.push(chunk as Buffer);
      const bytes = Buffer.concat(chunks);
      this.contentType(resource, content.mediaType, bytes, this.destination(content.resolvedUrl).koha);
      return { bytes, mediaType: content.mediaType, filename: content.filename,
        sourceUrl: content.sourceUrl, resolvedUrl: content.resolvedUrl };
    } finally {
      content.cancel();
    }
  }

  async openStream(resource: BookResource, bookTitle: string | null, signal?: AbortSignal, maxBytes = this.maxBytes): Promise<ResourceStream> {
    let destination = this.destination(resource.sourceUrl);
    if (!this.supportedMediaType(resource.mediaType)) throw new BadRequestException('Resource format is not supported');
    const controller = new AbortController();
    let timedOut = false;
    let raw: Readable | undefined;
    let source: Readable | undefined;
    let output: Readable | undefined;
    let sourceFailure: unknown;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, this.timeoutMs);
    timer.unref();
    const abort = () => controller.abort();
    const onAbort = () => {
      const error = this.transferError(undefined, timedOut);
      raw?.destroy(error);
      if (source !== raw) source?.destroy(error);
      output?.destroy(error);
      dispose();
    };
    const releaseUpstream = () => {
      raw?.destroy();
      if (source !== raw) source?.destroy();
    };
    const dispose = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      controller.signal.removeEventListener('abort', onAbort);
      releaseUpstream();
    };
    const onSourceError = (error: unknown) => {
      sourceFailure = error;
      output?.destroy(this.transferError(error, timedOut));
    };
    controller.signal.addEventListener('abort', onAbort, { once: true });
    signal?.addEventListener('abort', abort, { once: true });
    try {
      if (signal?.aborted) { controller.abort(); throw new ServiceUnavailableException('Resource retrieval cancelled'); }
      for (let redirects = 0; redirects <= 3; redirects++) {
        // Local uses the installed Tailscale app; deployed Koha requests use
        // the existing embedded proxy. Public origins never receive Koha auth.
        const proxy = destination.koha ? await this.beforeDeadline(getTailscaleProxy(), controller.signal) : undefined;
        const response = await firstValueFrom(this.http.get<Readable>(destination.url.href, {
          proxy: proxy ?? false,
          responseType: 'stream',
          maxRedirects: 0,
          validateStatus: () => true,
          timeout: this.timeoutMs,
          signal: controller.signal,
          decompress: false,
          headers: { Accept: '*/*', 'Accept-Encoding': 'identity' },
        }));
        raw = response.data;
        raw.on('error', onSourceError);
        if (controller.signal.aborted) throw this.transferError(undefined, timedOut);
        if ([301, 302, 303, 307, 308].includes(response.status)) {
          raw.destroy();
          const location = response.headers.location;
          if (redirects === 3 || typeof location !== 'string') throw new BadGatewayException('Resource redirect failed');
          const nextUrl = new URL(location, destination.url);
          nextUrl.hash = '';
          // Recheck the exact origin and Koha route before making another request.
          destination = this.destination(nextUrl.href);
          continue;
        }
        if (response.status !== 200) {
          raw.destroy();
          if (response.status === 404) throw new NotFoundException('Resource content not found');
          throw new BadGatewayException('Resource upstream request failed');
        }
        const lengthHeader = response.headers['content-length'];
        const declaredLength = lengthHeader === undefined ? null : Number(lengthHeader);
        if (declaredLength !== null && (!Number.isSafeInteger(declaredLength) || declaredLength < 0)) {
          throw new BadGatewayException('Resource returned an invalid length');
        }
        if (declaredLength !== null && declaredLength > maxBytes) {
          throw this.tooLarge();
        }
        source = raw;
        const encoding = String(response.headers['content-encoding'] ?? 'identity').toLowerCase();
        if (encoding !== 'identity') {
          const decoder = encoding === 'gzip' || encoding === 'x-gzip' ? createGunzip()
            : encoding === 'deflate' ? createInflate() : encoding === 'br' ? createBrotliDecompress() : undefined;
          if (!decoder) throw new BadGatewayException('Resource returned an unsupported encoding');
          let wireBytes = 0;
          const tooLarge = () => this.tooLarge();
          const wireLimit = new Transform({ transform(chunk: Buffer, _encoding, done) {
            wireBytes += chunk.length;
            done(wireBytes > maxBytes ? tooLarge() : null, chunk);
          } });
          source = decoder;
          source.on('error', onSourceError);
          pipeline(raw, wireLimit, decoder, (error) => { if (error) onSourceError(error); });
        }
        const prefix = await this.readPrefix(source, Math.min(1024, maxBytes + 1));
        if (prefix.length > maxBytes) throw this.tooLarge();
        const mediaType = this.contentType(resource, response.headers['content-type'], prefix, destination.koha);
        const contentLength = encoding === 'identity' ? declaredLength : null;
        const upstream = source;
        const transferError = (error: unknown) => this.transferError(error, timedOut);
        const tooLarge = () => this.tooLarge();
        output = Readable.from((async function* () {
          let size = 0;
          const check = (bytes: Buffer) => {
            size += bytes.length;
            if (size > maxBytes) throw tooLarge();
            if (contentLength !== null && size > contentLength) throw new BadGatewayException('Resource length did not match');
            if (mediaType.startsWith('text/') && bytes.includes(0)) throw new BadGatewayException('Resource returned unexpected text content');
          };
          try {
            if (controller.signal.aborted) throw transferError(undefined);
            if (sourceFailure) throw sourceFailure;
            check(prefix);
            yield prefix; // Every inspected byte is replayed exactly once.
            for await (const chunk of upstream) {
              const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
              check(bytes);
              yield bytes;
            }
            if (contentLength !== null && size !== contentLength) throw new BadGatewayException('Resource length did not match');
          } catch (error) {
            throw transferError(error);
          } finally {
            releaseUpstream();
          }
        })(), { objectMode: false, highWaterMark: 64 * 1024 });
        // Guard the interval between opening the stream and attaching the HTTP
        // consumer. Its async iterator still receives any stored stream error.
        output.on('error', () => {});
        output.once('close', () => {
          releaseUpstream();
          if (output?.errored || controller.signal.aborted) dispose();
          // On normal EOF keep the deadline active until the HTTP consumer
          // finishes flushing its writes and calls cancel() in its finally.
        });
        return {
          stream: output, signal: controller.signal, mediaType, contentLength,
          filename: this.filename(response.headers['content-disposition'], bookTitle ?? resource.label, mediaType),
          sourceUrl: resource.sourceUrl, resolvedUrl: destination.url.href,
          cancel: () => { controller.abort(); output?.destroy(); dispose(); },
        };
      }
      throw new BadGatewayException('Resource redirect failed');
    } catch (error: unknown) {
      dispose();
      throw this.transferError(error, timedOut);
    }
  }

  private async beforeDeadline<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const abort = () => reject(new GatewayTimeoutException('Resource retrieval timed out'));
      signal.addEventListener('abort', abort, { once: true });
      if (signal.aborted) abort();
      promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
    });
  }

  private readPrefix(stream: Readable, limit: number): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      let size = 0;
      const cleanup = () => {
        stream.removeListener('readable', read);
        stream.removeListener('end', end);
        stream.removeListener('error', fail);
        stream.removeListener('close', close);
      };
      const finish = () => { cleanup(); resolve(Buffer.concat(chunks, size)); };
      const fail = (error: Error) => { cleanup(); reject(error); };
      const read = () => {
        try {
          while (size < limit) {
            const chunk = stream.read(limit - size) as Buffer | null;
            if (chunk === null) break;
            const count = Math.min(chunk.length, limit - size);
            chunks.push(chunk.subarray(0, count));
            size += count;
            if (count < chunk.length) stream.unshift(chunk.subarray(count));
          }
          if (size === limit || stream.readableEnded) finish();
        } catch (error) { fail(error as Error); }
      };
      const end = () => { read(); finish(); };
      const close = () => { if (!stream.readableEnded) fail(new Error('Upstream body closed')); };
      stream.on('readable', read).once('end', end).once('error', fail).once('close', close);
      if (stream.errored) { fail(stream.errored); return; }
      if (stream.destroyed && !stream.readableEnded) { fail(new Error('Upstream body closed')); return; }
      read();
    });
  }

  private transferError(error: unknown, timedOut: boolean): HttpException {
    if (timedOut || ['ECONNABORTED', 'ETIMEDOUT'].includes((error as { code?: string })?.code ?? '')) {
      return new GatewayTimeoutException('Resource retrieval timed out');
    }
    return error instanceof HttpException ? error : new ServiceUnavailableException('Resource content is unavailable');
  }

  private contentType(resource: BookResource, upstreamType: unknown, bytes: Buffer, koha: boolean): string {
    const type = typeof upstreamType === 'string' ? upstreamType.split(';')[0].trim().toLowerCase() : '';
    const upstreamFormat = mediaTypeFormat(type);
    const generic = !type || type === 'application/octet-stream' || type === 'binary/octet-stream';
    const detectedBinary = this.binaryFormat(bytes);
    const detectedImage = this.imageMediaType(bytes);
    const format: ResourceFormat = resource.format === 'unknown'
      ? (upstreamFormat !== 'unknown' ? upstreamFormat : detectedBinary !== 'unknown' ? detectedBinary : detectedImage ? 'image' : 'unknown') : resource.format;
    if (!bytes.length || format === 'unknown' || (!generic && upstreamFormat !== format)) {
      throw new BadGatewayException('Resource returned an unexpected media type');
    }
    if (format === 'pdf' || format === 'epub') {
      if (this.binaryFormat(bytes) !== format) throw new BadGatewayException('Resource returned invalid binary content');
    } else if (format === 'image') {
      if (!this.imageMediaType(bytes)) throw new BadGatewayException('Resource returned invalid image content');
    } else {
      // An unclassified Koha attachment returning HTML often means an OPAC
      // login/error page. Only explicit HTML/text attachment metadata permits it.
      if ((koha && resource.format === 'unknown') || this.binaryFormat(bytes) !== 'unknown'
        || bytes.includes(0) || (format === 'text' && /^\s*(?:<!doctype\s+html|<html\b)/i.test(bytes.subarray(0, 1024).toString('utf8')))) {
        throw new BadGatewayException('Resource returned unexpected text content');
      }
    }
    if (format === 'image') return this.imageMediaType(bytes) ?? 'application/octet-stream';
    return resourceMediaTypes[format];
  }

  private binaryFormat(bytes: Buffer): ResourceFormat {
    if (bytes.subarray(0, 5).equals(Buffer.from('%PDF-'))) return 'pdf';
    // EPUB requires the first ZIP entry to be an uncompressed mimetype file.
    if (bytes.length >= 58 && bytes.readUInt32LE(0) === 0x04034b50 && bytes.readUInt16LE(8) === 0
      && (bytes.readUInt16LE(6) & 1) === 0 && bytes.readUInt32LE(18) === 20 && bytes.readUInt32LE(22) === 20
      && bytes.readUInt16LE(26) === 8 && bytes.readUInt16LE(28) === 0
      && bytes.subarray(30, 38).toString('ascii') === 'mimetype'
      && bytes.subarray(38, 58).toString('ascii') === 'application/epub+zip') return 'epub';
    return 'unknown';
  }

  private imageMediaType(bytes: Buffer): string | undefined {
    if (bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return 'image/jpeg';
    if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
    if (bytes.subarray(0, 6).toString('ascii') === 'GIF87a' || bytes.subarray(0, 6).toString('ascii') === 'GIF89a') return 'image/gif';
    if (bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
    return undefined;
  }

  private filename(disposition: unknown, fallback: string, mediaType: string): string {
    let name = '';
    if (typeof disposition === 'string') {
      const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
      try { if (encoded) name = decodeURIComponent(encoded); } catch { /* Use the ordinary filename. */ }
      if (!name) name = disposition.match(/filename\s*=\s*(?:"([^"]*)"|([^;]*))/i)?.slice(1).find(Boolean)?.trim() ?? '';
    }
    const extension = mediaType === 'text/plain' ? 'txt' : mediaTypeFormat(mediaType) === 'image' ? 'img' : mediaTypeFormat(mediaType);
    const clean = (name || fallback).split(/[/\\]/).pop()?.normalize('NFKD')
      .replace(/[^a-zA-Z0-9 ._-]/g, '_').replace(/^\.+|\.+$/g, '').trim().slice(0, 120) || 'resource';
    const stem = clean.replace(/\.(?:pdf|epub|html?|txt|text)$/i, '');
    return `${stem}.${extension}`;
  }

  private tooLarge(): HttpException {
    return new HttpException('Resource exceeds the transfer limit', HttpStatus.PAYLOAD_TOO_LARGE);
  }

  private supportedMediaType(mediaType: string | null): boolean {
    return mediaType === null || mediaTypeFormat(mediaType) !== 'unknown'
      || mediaType === 'application/octet-stream' || mediaType === 'binary/octet-stream';
  }
}
