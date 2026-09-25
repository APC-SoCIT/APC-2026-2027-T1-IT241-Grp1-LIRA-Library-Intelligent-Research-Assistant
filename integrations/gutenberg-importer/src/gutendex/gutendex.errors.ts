export class GutendexError extends Error {
  constructor(
    message: string,
    readonly id: number,
    readonly kind: 'http' | 'timeout' | 'network' | 'malformed' | 'invalid',
    readonly status?: number,
  ) {
    super(message);
    this.name = 'GutendexError';
  }
}