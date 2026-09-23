import { Module } from '@nestjs/common';
import { KohaModule } from '../koha/koha.module';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';

@Module({
  imports: [KohaModule],
  controllers: [CatalogController],
  providers: [CatalogService],
})
export class CatalogModule {}
