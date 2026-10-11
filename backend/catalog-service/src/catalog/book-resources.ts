import { createHash } from 'node:crypto';
import { BookResource, ResourceFormat, ResourceMetadata } from './resource.types';

export const resourceMediaTypes: Record<Exclude<ResourceFormat, 'unknown'>, string> = {
  pdf: 'application/pdf', epub: 'application/epub+zip', html: 'text/html', text: 'text/plain',
};

export function mediaTypeFormat(value: string): ResourceFormat {
  const normalized = value.split(';')[0].trim().toLowerCase();
  switch (normalized) {
    case 'pdf': case 'application/pdf': return 'pdf';
    case 'epub': case 'application/epub+zip': return 'epub';
    case 'html': case 'htm': case 'text/html': case 'application/xhtml+xml': return 'html';
    case 'txt': case 'text': case 'plain text': case 'text/plain': return 'text';
    default: return 'unknown';
  }
}

function canonicalUrl(value: string): string {
  try {
    const url = new URL(value.trim());
    url.hash = '';
    return url.href;
  } catch {
    return value.trim();
  }
}

export function buildBookResources(metadata: ResourceMetadata[] = [], legacyUrl?: string | null): BookResource[] {
  const entries = new Map<string, ResourceMetadata>();
  for (const entry of [...metadata, ...(legacyUrl ?? '').split('|').map((url) => ({ url, formats: [], labels: [] }))]) {
    const url = canonicalUrl(entry.url);
    if (!url) continue;
    const existing = entries.get(url);
    entries.set(url, {
      url,
      formats: [...new Set([...(existing?.formats ?? []), ...entry.formats].map((value) => value.trim()).filter(Boolean))],
      labels: [...new Set([...(existing?.labels ?? []), ...entry.labels].map((value) => value.trim()).filter(Boolean))],
    });
  }

  return [...entries.values()].map(({ url, formats, labels }) => {
    let format: ResourceFormat = 'unknown';
    let mediaType: string | null = null;
    if (formats.length) {
      const recognized = new Set(formats.map(mediaTypeFormat).filter((value) => value !== 'unknown'));
      if (recognized.size === 1) format = [...recognized][0];
      const mimeTypes = [...new Set(formats.map((value) => value.split(';')[0].trim().toLowerCase())
        .filter((value) => /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/.test(value)))];
      if (recognized.size === 0 && mimeTypes.length === 1) mediaType = mimeTypes[0];
    } else {
      try {
        const extension = new URL(url).pathname.match(/\.(pdf|epub|html?|txt|text)(?:\.(?:utf-8|images|noimages))?$/i)?.[1];
        if (extension) format = mediaTypeFormat(extension);
      } catch { /* Invalid URLs remain visible but cannot be retrieved. */ }
    }
    if (format !== 'unknown') mediaType = resourceMediaTypes[format];
    return {
      id: createHash('sha256').update(url).digest('hex'),
      sourceUrl: url,
      format,
      label: labels[0] ?? (format === 'unknown' ? 'Online resource' : `${format === 'text' ? 'Plain text' : format.toUpperCase()} resource`),
      mediaType,
      contentUrl: null,
    };
  });
}
