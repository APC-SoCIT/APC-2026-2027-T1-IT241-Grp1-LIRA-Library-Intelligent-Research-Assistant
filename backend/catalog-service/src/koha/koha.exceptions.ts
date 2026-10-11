export type KohaFailureKind = 'not-found' | 'unauthorized' | 'forbidden' | 'rate-limit' | 'bad-request' | 'unavailable' | 'unexpected';

export class KohaIntegrationError extends Error {
  constructor(
    public readonly kind: KohaFailureKind,
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'KohaIntegrationError';
  }
}
