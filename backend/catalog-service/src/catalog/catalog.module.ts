import { Module } from '@nestjs/common';
import { KohaModule } from '../koha/koha.module';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { SemanticSearchService } from './semantic-search.service';
import { LibrarianGuard } from '../shared/librarian.guard';

@Module({
  imports: [KohaModule],
  controllers: [CatalogController],
  providers: [CatalogService, SemanticSearchService, LibrarianGuard],
})
export class CatalogModule {}
