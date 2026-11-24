import { Module } from '@nestjs/common';
import { KohaModule } from '../koha/koha.module';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { SemanticSearchService } from './semantic-search.service';
import { LibrarianGuard } from '../shared/librarian.guard';
import { HttpModule } from '@nestjs/axios';
import { ResourceContentService } from './resource-content.service';
import { BookSummaryController, LibrarianBookSummaryController } from './book-summary.controller';
import { BookSummaryExtractor } from './book-summary-extractor';
import { BookSummaryService } from './book-summary.service';
import { AuthenticatedUserGuard } from '../shared/authenticated-user.guard';

@Module({
  imports: [KohaModule, HttpModule],
  controllers: [CatalogController, BookSummaryController, LibrarianBookSummaryController],
  providers: [CatalogService, SemanticSearchService, LibrarianGuard, ResourceContentService, BookSummaryService, BookSummaryExtractor, AuthenticatedUserGuard],
})
export class CatalogModule {}
