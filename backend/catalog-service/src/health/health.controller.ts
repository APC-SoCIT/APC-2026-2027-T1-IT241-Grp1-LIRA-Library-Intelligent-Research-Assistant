import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  getHealth() {
    return this.health.serviceHealth();
  }

  @Get('koha')
  async getKohaHealth() {
    try {
      return await this.health.kohaHealth();
    } catch {
      throw new ServiceUnavailableException({ status: 'error', koha: 'unreachable' });
    }
  }
}
