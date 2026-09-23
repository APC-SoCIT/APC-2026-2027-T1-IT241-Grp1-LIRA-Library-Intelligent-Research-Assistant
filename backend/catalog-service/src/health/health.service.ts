import { Injectable, Logger } from '@nestjs/common';
import { KohaClient } from '../koha/koha.client';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(private readonly koha: KohaClient) {}

  serviceHealth() {
    return { status: 'ok' };
  }

  async kohaHealth(): Promise<{ status: 'ok'; koha: 'reachable' }> {
    try {
      await this.koha.checkConnectivity();
      return { status: 'ok', koha: 'reachable' };
    } catch (error: unknown) {
      this.logger.warn('Koha connectivity check failed');
      throw error;
    }
  }
}
