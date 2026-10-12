import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AuthenticatedSupabaseUser, SupabaseUserGuard } from '../shared/supabase-user.guard';
import { PatronListsService } from './patron-lists.service';

type AuthenticatedRequest = Request & { supabaseUser: AuthenticatedSupabaseUser };

@Controller('api/lists')
@UseGuards(SupabaseUserGuard)
export class PatronListsController {
  constructor(private readonly lists: PatronListsService) {}

  @Get()
  listLists(@Req() request: AuthenticatedRequest) {
    return this.lists.listLists(request.supabaseUser);
  }

  @Post()
  createList(@Req() request: AuthenticatedRequest, @Body() body: { name: string }) {
    return this.lists.createList(request.supabaseUser, body.name);
  }

  @Put(':listId')
  renameList(@Req() request: AuthenticatedRequest, @Param('listId', ParseIntPipe) listId: number, @Body() body: { name: string }) {
    return this.lists.renameList(request.supabaseUser, listId, body.name);
  }

  @Delete(':listId')
  deleteList(@Req() request: AuthenticatedRequest, @Param('listId', ParseIntPipe) listId: number) {
    return this.lists.deleteList(request.supabaseUser, listId);
  }

  @Get('bookmarks')
  listBookmarks(@Req() request: AuthenticatedRequest) {
    return this.lists.listBookmarks(request.supabaseUser);
  }

  @Post(':listId/items/:biblioId')
  saveBookmark(
    @Req() request: AuthenticatedRequest,
    @Param('listId', ParseIntPipe) listId: number,
    @Param('biblioId', ParseIntPipe) biblioId: number,
  ) {
    return this.lists.saveBookmark(request.supabaseUser, listId, biblioId);
  }

  @Put('bookmarks/:biblioId')
  moveBookmark(@Req() request: AuthenticatedRequest, @Param('biblioId', ParseIntPipe) biblioId: number, @Body() body: { list_id: number }) {
    return this.lists.moveBookmark(request.supabaseUser, biblioId, body.list_id);
  }

  @Delete('bookmarks/:biblioId')
  removeBookmark(@Req() request: AuthenticatedRequest, @Param('biblioId', ParseIntPipe) biblioId: number) {
    return this.lists.removeBookmark(request.supabaseUser, biblioId);
  }
}
