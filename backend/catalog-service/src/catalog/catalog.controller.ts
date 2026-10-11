import { BadRequestException, Body, Controller, Delete, Get, Headers, Param, ParseIntPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { CatalogWriteDto } from './dto/catalog-write.dto';
import { PaginationDto } from './dto/pagination.dto';
import { SearchCatalogDto } from './dto/search-catalog.dto';
import { LibrarianGuard } from '../shared/librarian.guard';

@Controller('api/catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('books')
  listBooks(@Query() pagination: PaginationDto) {
    return this.catalog.listBooks(pagination.page, pagination.limit);
  }

  @Get('new-arrivals')
  listNewArrivals(@Query() pagination: PaginationDto) {
    return this.catalog.listNewArrivals(pagination.page, pagination.limit);
  }

  @Get('books/:id')
  getBook(@Param('id', new ParseIntPipe({ errorHttpStatusCode: 400 })) id: number) {
    if (id < 1) throw new BadRequestException('Book ID must be a positive integer');
    return this.catalog.getBook(id);
  }

  @Get('books/:id/content')
  getBookContent(@Param('id', new ParseIntPipe({ errorHttpStatusCode: 400 })) id: number) {
    if (id < 1) throw new BadRequestException('Book ID must be a positive integer');
    return this.catalog.getBookContent(id);
  }

  @Post('books')
  @UseGuards(LibrarianGuard)
  createBook(@Body() record: CatalogWriteDto) {
    return this.catalog.createBook(record);
  }

  @Put('books/:id')
  @UseGuards(LibrarianGuard)
  updateBook(
    @Param('id', new ParseIntPipe({ errorHttpStatusCode: 400 })) id: number,
    @Body() record: CatalogWriteDto,
  ) {
    if (id < 1) throw new BadRequestException('Book ID must be a positive integer');
    return this.catalog.updateBook(id, record);
  }

  @Delete('books/:id')
  @UseGuards(LibrarianGuard)
  deleteBook(@Param('id', new ParseIntPipe({ errorHttpStatusCode: 400 })) id: number) {
    if (id < 1) throw new BadRequestException('Book ID must be a positive integer');
    return this.catalog.deleteBook(id);
  }

  @Get('search')
  search(@Query() query: SearchCatalogDto) {
    return this.catalog.searchBooks(query.q, query.page, query.limit, query.mode);
  }

  @Post('semantic/reindex')
  reindexSemanticCatalog(@Headers('x-semantic-index-key') indexKey?: string) {
    return this.catalog.reindexSemanticCatalog(indexKey);
  }
}
