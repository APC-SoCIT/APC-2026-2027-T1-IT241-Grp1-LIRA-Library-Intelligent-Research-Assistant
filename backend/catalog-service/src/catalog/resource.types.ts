import { Readable } from 'node:stream';

export type ResourceFormat = 'pdf' | 'epub' | 'html' | 'text' | 'unknown';

/** Metadata for one 856 $u; $q/$y remain associated with their own field. */
export interface ResourceMetadata {
  url: string;
  formats: string[];
  labels: string[];
}

export interface BookResource {
  id: string;
  sourceUrl: string;
  format: ResourceFormat;
  label: string;
  mediaType: string | null;
  /** Backend-relative URL. Null means the destination/format is unsupported. */
  contentUrl: string | null;
}

export interface ResourceContent {
  bytes: Buffer;
  mediaType: string;
  filename: string;
  sourceUrl: string;
  resolvedUrl: string;
}

export interface ResourceStream {
  stream: Readable;
  signal: AbortSignal;
  mediaType: string;
  filename: string;
  sourceUrl: string;
  resolvedUrl: string;
  /** Length of decoded bytes, when upstream supplied an unencoded length. */
  contentLength: number | null;
  cancel(): void;
}
