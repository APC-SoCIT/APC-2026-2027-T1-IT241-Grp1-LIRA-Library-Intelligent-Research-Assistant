import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { KohaClient } from './koha.client';

@Module({
  imports: [HttpModule],
  providers: [KohaClient],
  exports: [KohaClient],
})
export class KohaModule {}
