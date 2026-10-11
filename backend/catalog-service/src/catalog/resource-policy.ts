export const DEFAULT_RESOURCE_BYTES = 64_000_000;
export const MAX_RESOURCE_BYTES = 512_000_000;
export const MAX_READER_BYTES = 4_000_000;
export const DEFAULT_RESOURCE_ORIGINS = [
  'https://www.gutenberg.org', 'https://gutenberg.org',
  'http://www.gutenberg.org', 'http://gutenberg.org',
];

export function defaultOpacUrl(baseUrl: string): string {
  const url = new URL(baseUrl);
  url.port = '8080';
  return url.origin;
}
