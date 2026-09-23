import { Module } from '@nestjs/common';
import { KohaModule } from '../koha/koha.module';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

@Module({
  imports: [KohaModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
