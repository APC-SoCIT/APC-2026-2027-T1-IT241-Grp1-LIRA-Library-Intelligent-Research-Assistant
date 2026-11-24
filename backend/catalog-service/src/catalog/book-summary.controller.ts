import {
  Body, Controller, Get, Header, Param, ParseIntPipe, ParseUUIDPipe, Post, Put, Query, Req, UseGuards,
} from '@nestjs/common';
import {
  BookSummaryListQueryDto, BookSummaryResourceDto, ReviewBookSummaryDto,
} from './book-summary.dto';
import { BookSummaryService } from './book-summary.service';
import { AuthenticatedUserGuard, AuthenticatedUserRequest } from '../shared/authenticated-user.guard';
import { LibrarianGuard, LibrarianRequest } from '../shared/librarian.guard';

@Controller('api/catalog/books/:bookId/summaries')
export class BookSummaryController {
  constructor(private readonly summaries: BookSummaryService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  getSummary(
    @Param('bookId', ParseIntPipe) bookId: number,
    @Query() query: BookSummaryResourceDto,
  ) {
    return this.summaries.getSummary(bookId, query.resourceId);
  }

  @Post()
  @UseGuards(AuthenticatedUserGuard)
  @Header('Cache-Control', 'no-store')
  generateSummary(
    @Param('bookId', ParseIntPipe) bookId: number,
    @Body() input: BookSummaryResourceDto,
    @Req() request: AuthenticatedUserRequest,
  ) {
    return this.summaries.generateSummary(bookId, input.resourceId, request.authenticatedUser.id);
  }
}

@Controller('api/librarian/book-summaries')
@UseGuards(LibrarianGuard)
export class LibrarianBookSummaryController {
  constructor(private readonly summaries: BookSummaryService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  listSummaries(@Query() query: BookSummaryListQueryDto) {
    return this.summaries.listSummaries(query.status);
  }

  @Put(':id')
  @Header('Cache-Control', 'no-store')
  review(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: ReviewBookSummaryDto,
    @Req() request: LibrarianRequest,
  ) {
    return this.summaries.reviewSummary(id, request.librarianUser.id, input);
  }
}
