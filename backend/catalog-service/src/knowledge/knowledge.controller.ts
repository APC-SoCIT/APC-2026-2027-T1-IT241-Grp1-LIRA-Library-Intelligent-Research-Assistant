import { Body, Controller, Get, Header, Param, ParseUUIDPipe, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { PaginationDto } from '../catalog/dto/pagination.dto';
import { LibrarianGuard, LibrarianRequest } from '../shared/librarian.guard';
import { KnowledgeUpdateDto, KnowledgeWriteDto } from './knowledge.dto';
import { KnowledgeService } from './knowledge.service';

@Controller('api/knowledge/entries')
@UseGuards(LibrarianGuard)
export class KnowledgeController {
  constructor(private readonly knowledge: KnowledgeService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  list(@Query() query: PaginationDto) {
    return this.knowledge.list(query.page, query.limit);
  }

  @Post()
  @Header('Cache-Control', 'no-store')
  create(@Body() input: KnowledgeWriteDto, @Req() request: LibrarianRequest) {
    return this.knowledge.create(input, request.librarianUser.id);
  }

  @Put(':id')
  @Header('Cache-Control', 'no-store')
  update(@Param('id', new ParseUUIDPipe()) id: string, @Body() input: KnowledgeUpdateDto, @Req() request: LibrarianRequest) {
    return this.knowledge.update(id, input, request.librarianUser.id);
  }
}
