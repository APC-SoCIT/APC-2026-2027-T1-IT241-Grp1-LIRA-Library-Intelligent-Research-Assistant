import { Module } from '@nestjs/common';
import { KohaModule } from '../koha/koha.module';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { SemanticSearchService } from './semantic-search.service';
import { LibrarianGuard } from '../shared/librarian.guard';
import { HttpModule } from '@nestjs/axios';
import { ResourceContentService } from './resource-content.service';

@Module({
  imports: [KohaModule, HttpModule],
  controllers: [CatalogController],
  providers: [CatalogService, SemanticSearchService, LibrarianGuard, ResourceContentService],
})
export class CatalogModule {}
