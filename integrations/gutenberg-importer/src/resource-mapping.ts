import { GutendexBook } from './gutendex/gutendex.types.js';

export interface SourceResource {
  url: string;
  mediaType: string;
  label: string;
  role: 'reading' | 'cover';
  source: string;
  sourceMediaType: string;
}
export interface ResourceMapping {
  resources: SourceResource[];
  omittedFormats: { sourceMediaType: string; sourceUrl: unknown; reason: string }[];
  warnings: string[];
}
const readingTypes = ['text/html', 'text/plain', 'application/epub+zip', 'application/pdf'];
const labels: Record<string, string> = {
  'text/html': 'Read online', 'text/plain': 'Plain text', 'application/epub+zip': 'EPUB', 'application/pdf': 'PDF',
};

export function normalizeMime(value: string): string | null {
  const base = value.split(';', 1)[0]?.trim().toLowerCase() ?? '';
  return /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/u.test(base) ? base : null;
}

/** Validate metadata only. This never fetches the destination. */
export function validatedSourceUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!/^https?:\/\//iu.test(trimmed) || /[\s\\\u0000-\u001f\u007f]/u.test(trimmed)) return null;
  try {
    const url = new URL(trimmed);
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) return null;
    return url.href;
  } catch { return null; }
}

export function resourceUrlKey(value: string): string {
  const url = new URL(value);
  url.hash = '';
  return url.href;
}

export function mapResources(id: number, source: GutendexBook): ResourceMapping {
  const resources: SourceResource[] = [];
  const omittedFormats: ResourceMapping['omittedFormats'] = [];
  const warnings: string[] = [];
  const formats = source.formats;
  if (!formats || typeof formats !== 'object' || Array.isArray(formats)) {
    return { resources, omittedFormats, warnings: ['No supported reading resources supplied', 'No confirmed cover supplied'] };
  }
  const byUrl = new Map<string, { mime: string | null; sourceMime: string; rawUrl: unknown; url: string }[]>();
  for (const [sourceMime, rawUrl] of Object.entries(formats)) {
    const url = validatedSourceUrl(rawUrl);
    if (!url) { omittedFormats.push({ sourceMediaType: sourceMime, sourceUrl: rawUrl, reason: 'Invalid HTTP(S) URL or embedded credentials' }); continue; }
    const key = resourceUrlKey(url);
    const entries = byUrl.get(key) ?? [];
    entries.push({ mime: normalizeMime(sourceMime), sourceMime, rawUrl, url });
    byUrl.set(key, entries);
  }
  for (const entries of byUrl.values()) {
    const types = new Set(entries.map((entry) => entry.mime));
    if (types.size !== 1) {
      for (const entry of entries) omittedFormats.push({ sourceMediaType: entry.sourceMime, sourceUrl: entry.rawUrl, reason: 'Conflicting MIME metadata for the same URL' });
      warnings.push(`Conflicting MIME metadata: ${entries[0]?.url}`);
      continue;
    }
    const entry = entries.sort((a, b) => compare(a.sourceMime, b.sourceMime) || compare(a.url, b.url))[0];
    if (!entry) continue;
    const cover = entry.mime === 'image/jpeg' && isGutenbergCover(id, entry.url);
    if (entry.mime && (readingTypes.includes(entry.mime) || cover)) {
      resources.push({ url: entry.url, mediaType: entry.mime, label: cover ? 'Cover image' : labels[entry.mime] ?? '',
        role: cover ? 'cover' : 'reading', source: `Gutendex formats[${JSON.stringify(entry.sourceMime)}]`, sourceMediaType: entry.sourceMime });
    } else {
      omittedFormats.push({ sourceMediaType: entry.sourceMime, sourceUrl: entry.rawUrl,
        reason: entry.mime?.startsWith('image/') ? 'Image has no confirmed Gutenberg cover role' : 'Unsupported or invalid MIME type' });
    }
  }
  resources.sort((a, b) => resourceOrder(a) - resourceOrder(b) || compare(a.url, b.url));
  omittedFormats.sort((a, b) => compare(a.sourceMediaType, b.sourceMediaType) || compare(String(a.sourceUrl), String(b.sourceUrl)));
  if (!resources.some((resource) => resource.role === 'reading')) warnings.push('No supported reading resources supplied');
  if (!resources.some((resource) => resource.role === 'cover')) warnings.push('No confirmed cover supplied');
  return { resources, omittedFormats, warnings };
}

// Gutenberg cache cover entries must be supplied by Gutendex; never construct one.
function isGutenbergCover(id: number, value: string): boolean {
  const url = new URL(value);
  return ['www.gutenberg.org', 'gutenberg.org'].includes(url.hostname) && !url.port && !url.search && !url.hash
    && new RegExp(`^/cache/epub/${id}/pg${id}\\.cover\\.(medium|small)\\.jpg$`, 'u').test(url.pathname);
}
function resourceOrder(resource: SourceResource): number {
  return resource.role === 'cover' ? readingTypes.length : readingTypes.indexOf(resource.mediaType);
}
function compare(left: string, right: string): number { return left < right ? -1 : left > right ? 1 : 0; }
