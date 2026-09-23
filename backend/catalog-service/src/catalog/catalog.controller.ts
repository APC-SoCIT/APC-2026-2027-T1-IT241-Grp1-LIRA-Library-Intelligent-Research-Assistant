import { BadRequestException, Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { PaginationDto } from './dto/pagination.dto';
import { SearchCatalogDto } from './dto/search-catalog.dto';

@Controller('api/catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('books')
  listBooks(@Query() pagination: PaginationDto) {
    return this.catalog.listBooks(pagination.page, pagination.limit);
  }

  @Get('books/:id')
  getBook(@Param('id', new ParseIntPipe({ errorHttpStatusCode: 400 })) id: number) {
    if (id < 1) throw new BadRequestException('Book ID must be a positive integer');
    return this.catalog.getBook(id);
  }

  @Get('search')
  search(@Query() query: SearchCatalogDto) {
    return this.catalog.searchBooks(query.q, query.page, query.limit);
  }
}
