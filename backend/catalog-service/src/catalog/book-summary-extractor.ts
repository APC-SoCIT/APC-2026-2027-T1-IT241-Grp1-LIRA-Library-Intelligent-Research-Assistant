import { BadRequestException, Injectable } from '@nestjs/common';
import { createCanvas, DOMMatrix, ImageData, Path2D } from '@napi-rs/canvas';
import * as AdmZip from 'adm-zip';
import { XMLParser } from 'fast-xml-parser';
import { posix } from 'node:path';
import { createWorker } from 'tesseract.js';
import { ResourceFormat } from './resource.types';

const MAX_SOURCE_TEXT_CHARACTERS = 600_000;
const MAX_EPUB_TEXT_BYTES = 64 * 1024 * 1024;
const MAX_OCR_PAGES = 200;
const MIN_TEXT_PAGE_CHARACTERS = 60;

interface PdfTextItem {
  str?: string;
}

interface PdfPage {
  getTextContent(): Promise<{ items: PdfTextItem[] }>;
  getViewport(options: { scale: number }): { width: number; height: number };
  render(options: { canvas: unknown; canvasContext: unknown; viewport: unknown }): { promise: Promise<void> };
  cleanup(): void;
}

interface PdfDocument {
  numPages: number;
  getPage(pageNumber: number): Promise<PdfPage>;
}

interface PdfLoadingTask {
  promise: Promise<PdfDocument>;
  destroy(): Promise<void>;
}

interface PdfJsModule {
  getDocument(options: Record<string, unknown>): PdfLoadingTask;
}

class NapiCanvasFactory {
  create(width: number, height: number) {
    const canvas = createCanvas(width, height);
    return { canvas, context: canvas.getContext('2d') };
  }

  reset(entry: { canvas: ReturnType<typeof createCanvas> }, width: number, height: number): void {
    entry.canvas.width = width;
    entry.canvas.height = height;
  }

  destroy(entry: { canvas: ReturnType<typeof createCanvas>; context?: unknown }): void {
    entry.canvas.width = 0;
    entry.canvas.height = 0;
    entry.context = undefined;
  }

  getNoAlphaContext(canvas: ReturnType<typeof createCanvas>) {
    return canvas.getContext('2d', { alpha: false });
  }
}

interface ZipContent {
  getData(): Buffer;
  header: { size: number };
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true,
});

@Injectable()
export class BookSummaryExtractor {
  async extract(bytes: Buffer, format: ResourceFormat, language: string | null): Promise<string> {
    let text: string;
    if (format === 'text') {
      text = bytes.toString('utf8');
    } else if (format === 'html') {
      text = cleanMarkup(bytes.toString('utf8'));
    } else if (format === 'epub') {
      text = extractEpubText(bytes);
    } else if (format === 'pdf') {
      text = await this.extractPdfText(bytes, language);
    } else {
      throw new BadRequestException('This ebook format cannot be summarized.');
    }

    const normalized = normalizeText(text);
    if (!normalized) throw new BadRequestException('No readable text was found in this ebook.');
    if (normalized.length > MAX_SOURCE_TEXT_CHARACTERS) {
      throw new BadRequestException('This ebook exceeds the automatic summary size limit.');
    }
    return normalized;
  }

  private async extractPdfText(bytes: Buffer, language: string | null): Promise<string> {
    if (typeof globalThis.DOMMatrix === 'undefined') Reflect.set(globalThis, 'DOMMatrix', DOMMatrix);
    if (typeof globalThis.ImageData === 'undefined') Reflect.set(globalThis, 'ImageData', ImageData);
    if (typeof globalThis.Path2D === 'undefined') Reflect.set(globalThis, 'Path2D', Path2D);

    const importModule = new Function('specifier', 'return import(specifier)') as
      (specifier: string) => Promise<PdfJsModule>;
    const pdfjs = await importModule('pdfjs-dist/legacy/build/pdf.mjs');
    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(bytes),
      useSystemFonts: true,
      isEvalSupported: false,
      CanvasFactory: NapiCanvasFactory,
    });
    const document = await loadingTask.promise;
    let ocrWorker: Awaited<ReturnType<typeof createWorker>> | undefined;
    let ocrPageCount = 0;
    const pages: string[] = [];

    try {
      for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
        const page = await document.getPage(pageNumber);
        const content = await page.getTextContent();
        let pageText = content.items.map((item) => item.str ?? '').join(' ').trim();

        if (pageText.length < MIN_TEXT_PAGE_CHARACTERS) {
          ocrPageCount += 1;
          if (ocrPageCount > MAX_OCR_PAGES) {
            throw new BadRequestException('This scanned PDF exceeds the automatic OCR page limit.');
          }
          ocrWorker ??= await createWorker(ocrLanguage(language));
          const baseViewport = page.getViewport({ scale: 1 });
          const scale = Math.min(1.5, 2000 / Math.max(baseViewport.width, baseViewport.height));
          const viewport = page.getViewport({ scale });
          const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
          await page.render({
            canvas,
            canvasContext: canvas.getContext('2d'),
            viewport,
          }).promise;
          const result = await ocrWorker.recognize(canvas.toBuffer('image/png'));
          if (result.data.text.trim()) pageText = result.data.text.trim();
        }

        if (pageText) pages.push(pageText);
        page.cleanup();
      }
    } finally {
      await ocrWorker?.terminate();
      await loadingTask.destroy();
    }

    return pages.join('\n\n');
  }
}

export function extractEpubText(bytes: Buffer): string {
  let zip: AdmZip;
  try {
    zip = new AdmZip(bytes);
  } catch {
    throw new BadRequestException('This EPUB file could not be opened.');
  }

  const containerEntry = zip.getEntry('META-INF/container.xml') as ZipContent | null;
  if (!containerEntry || containerEntry.header.size > MAX_EPUB_TEXT_BYTES) {
    throw new BadRequestException('This EPUB has no valid package document.');
  }
  const container = parseXml(containerEntry.getData().toString('utf8'));
  const rootfile = findElements(container, 'rootfile')[0];
  const packagePath = rootfile?.['@_full-path'];
  if (typeof packagePath !== 'string' || !packagePath || packagePath.startsWith('/')) {
    throw new BadRequestException('This EPUB has no valid package document.');
  }

  const packageEntry = zip.getEntry(packagePath) as ZipContent | null;
  if (!packageEntry || packageEntry.header.size > MAX_EPUB_TEXT_BYTES) {
    throw new BadRequestException('This EPUB has no valid package document.');
  }
  const packageDocument = parseXml(packageEntry.getData().toString('utf8'));
  const manifest = findElements(packageDocument, 'manifest')[0];
  const spine = findElements(packageDocument, 'spine')[0];
  const items = asRecords(manifest?.item);
  const itemRefs = asRecords(spine?.itemref);
  const contentById = new Map(items.flatMap((item) => {
    const id = item['@_id'];
    const href = item['@_href'];
    return typeof id === 'string' && typeof href === 'string' ? [[id, href] as const] : [];
  }));
  const textParts: string[] = [];
  let totalContentBytes = 0;

  for (const itemRef of itemRefs) {
    const id = itemRef['@_idref'];
    if (typeof id !== 'string') continue;
    const href = contentById.get(id);
    if (!href) continue;
    const contentPath = posix.normalize(posix.join(posix.dirname(packagePath), href.split('#')[0]));
    if (contentPath.startsWith('../') || contentPath.startsWith('/')) continue;
    const entry = zip.getEntry(contentPath) as ZipContent | null;
    if (!entry) continue;
    totalContentBytes += entry.header.size;
    if (totalContentBytes > MAX_EPUB_TEXT_BYTES) {
      throw new BadRequestException('This EPUB exceeds the automatic summary size limit.');
    }
    textParts.push(cleanMarkup(entry.getData().toString('utf8')));
  }

  if (textParts.length === 0) throw new BadRequestException('This EPUB contains no readable chapters.');
  return textParts.join('\n\n');
}

function parseXml(xml: string): Record<string, unknown> {
  try {
    return xmlParser.parse(xml) as Record<string, unknown>;
  } catch {
    throw new BadRequestException('This EPUB contains an invalid package document.');
  }
}

function findElements(value: unknown, name: string): Array<Record<string, unknown>> {
  if (Array.isArray(value)) return value.flatMap((item) => findElements(item, name));
  if (typeof value !== 'object' || value === null) return [];
  const entries = Object.entries(value);
  return entries.flatMap(([key, child]) => key === name
    ? [...asRecords(child), ...findElements(child, name)]
    : findElements(child, name));
}

function asRecords(value: unknown): Array<Record<string, unknown>> {
  const entries = Array.isArray(value) ? value : [value];
  return entries.filter((entry): entry is Record<string, unknown> =>
    typeof entry === 'object' && entry !== null && !Array.isArray(entry));
}

function cleanMarkup(value: string): string {
  return decodeEntities(value
    .replace(/<(script|style|svg|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<\/(?:p|div|h[1-6]|li|br|tr|section|article|blockquote)>/gi, '\n')
    .replace(/<[^>]*>/g, ' '))
}

function decodeEntities(value: string): string {
  const namedEntities: Record<string, string> = {
    '&amp;': '&',
    '&apos;': "'",
    '&gt;': '>',
    '&lt;': '<',
    '&nbsp;': ' ',
    '&quot;': '"',
    '&mdash;': '—',
    '&ndash;': '–',
    '&rsquo;': '’',
    '&lsquo;': '‘',
    '&rdquo;': '”',
    '&ldquo;': '“',
    '&hellip;': '…',
  };
  return value
    .replace(/&(amp|apos|gt|lt|nbsp|quot|mdash|ndash|rsquo|lsquo|rdquo|ldquo|hellip);/gi,
      (entity) => namedEntities[entity.toLowerCase()] ?? entity)
    .replace(/&#(x[0-9a-f]{1,6}|\d{1,7});/gi, (entity, value: string) => {
      const codePoint = value[0].toLowerCase() === 'x'
        ? Number.parseInt(value.slice(1), 16)
        : Number.parseInt(value, 10);
      return codePoint > 0 && codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : entity;
    });
}

function normalizeText(value: string): string {
  return value
    .replace(/\u0000/g, ' ')
    .replace(/\r\n?/g, '\n')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function ocrLanguage(language: string | null): string {
  const normalized = language?.toLowerCase() ?? '';
  const languageCode = normalized.split(/[-_\s(]/, 1)[0];
  const trainedDataLanguage: Record<string, string> = {
    ar: 'ara', ara: 'ara', arabic: 'ara',
    de: 'deu', deu: 'deu', ger: 'deu', german: 'deu',
    en: 'eng', eng: 'eng', english: 'eng',
    es: 'spa', spa: 'spa', spanish: 'spa',
    fil: 'fil', tl: 'fil', tgl: 'fil', filipino: 'fil',
    fr: 'fra', fra: 'fra', fre: 'fra', french: 'fra',
    hi: 'hin', hin: 'hin', hindi: 'hin',
    id: 'ind', ind: 'ind', indonesian: 'ind',
    it: 'ita', ita: 'ita', italian: 'ita',
    ja: 'jpn', jpn: 'jpn', japanese: 'jpn',
    ko: 'kor', kor: 'kor', korean: 'kor',
    nl: 'nld', nld: 'nld', dutch: 'nld',
    pt: 'por', por: 'por', portuguese: 'por',
    ru: 'rus', rus: 'rus', russian: 'rus',
    th: 'tha', tha: 'tha', thai: 'tha',
    vi: 'vie', vie: 'vie', vietnamese: 'vie',
    zh: 'chi_sim', chi: 'chi_sim', chinese: 'chi_sim',
  };
  return trainedDataLanguage[languageCode] || 'eng';
}
