import { BadRequestException, Body, Controller, Delete, Get, Headers, Param, ParseIntPipe, Post, Put, Query, Req, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request, Response } from 'express';
import { once } from 'node:events';
import { finished } from 'node:stream/promises';
import { ResourceStream } from './resource.types';
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

  @Get('books/:id/resources/:resourceId/content')
  async getResourceContent(
    @Param('id', new ParseIntPipe({ errorHttpStatusCode: 400 })) id: number,
    @Param('resourceId') resourceId: string,
    @Req() request: Request,
    @Res() response: Response,
  ) {
    if (id < 1) throw new BadRequestException('Book ID must be a positive integer');
    const abort = new AbortController();
    const onAborted = () => abort.abort();
    const onClose = () => { if (!response.writableFinished) abort.abort(); };
    const onStreamError = () => {
      // A timeout/error must also interrupt a wait for downstream drain.
      if (response.headersSent && !response.destroyed) response.destroy();
    };
    const onTransferAbort = () => {
      if (response.headersSent && !response.destroyed) response.destroy();
    };
    request.once('aborted', onAborted);
    response.once('close', onClose);
    let content: ResourceStream | undefined;
    try {
      if (request.aborted || response.destroyed) { abort.abort(); return; }
      content = await this.catalog.getResourceContent(id, resourceId, abort.signal);
      content.stream.once('error', onStreamError);
      content.signal?.addEventListener('abort', onTransferAbort, { once: true });
      response.setHeader('Content-Type', content.mediaType);
      response.setHeader('Content-Disposition', `inline; filename="${content.filename}"`);
      if (content.contentLength !== null) response.setHeader('Content-Length', content.contentLength);
      response.setHeader('X-Content-Type-Options', 'nosniff');
      response.setHeader('Cache-Control', 'private, no-store');
      // Range headers are ignored; always return the complete body (200).
      response.setHeader('Accept-Ranges', 'none');
      if (content.mediaType === 'text/html') response.setHeader('Content-Security-Policy', "sandbox; default-src 'none'");
      for await (const chunk of content.stream) {
        if (abort.signal.aborted || response.destroyed) return;
        // Waiting for drain bounds buffering when a client consumes slowly.
        if (!response.write(chunk)) await once(response, 'drain', { signal: abort.signal });
      }
      const completed = finished(response, { cleanup: true });
      response.end();
      await completed;
    } catch (error) {
      if (response.headersSent || response.destroyed || abort.signal.aborted) {
        // Never append JSON or a clean EOF to a failed binary transfer.
        if (!response.destroyed) response.destroy();
        return;
      }
      for (const header of ['Content-Type', 'Content-Disposition', 'Content-Length', 'Content-Security-Policy']) {
        response.removeHeader(header);
      }
      throw error; // Nest still owns safe JSON errors before any bytes are sent.
    } finally {
      request.removeListener('aborted', onAborted);
      response.removeListener('close', onClose);
      content?.stream.removeListener('error', onStreamError);
      content?.signal?.removeEventListener('abort', onTransferAbort);
      content?.cancel();
    }
  }

  @Post('books')
  @UseGuards(LibrarianGuard)
  createBook(@Body() record: CatalogWriteDto) {
    return this.catalog.createBook(record);
  }

  @Post('books/:id/resources/upload')
  @UseGuards(LibrarianGuard)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 512_000_000 } }))
  uploadResource(
    @Param('id', new ParseIntPipe({ errorHttpStatusCode: 400 })) id: number,
    @UploadedFile() file?: { buffer: Buffer; originalname: string; mimetype: string },
  ) {
    if (id < 1) throw new BadRequestException('Book ID must be a positive integer');
    return this.catalog.uploadResource(id, file as { buffer: Buffer; originalname: string; mimetype: string });
  }

  @Post('books/:id/cover/upload')
  @UseGuards(LibrarianGuard)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 20_000_000 } }))
  uploadCover(
    @Param('id', new ParseIntPipe({ errorHttpStatusCode: 400 })) id: number,
    @UploadedFile() file?: { buffer: Buffer; originalname: string; mimetype: string },
  ) {
    if (id < 1) throw new BadRequestException('Book ID must be a positive integer');
    return this.catalog.uploadCover(id, file as { buffer: Buffer; originalname: string; mimetype: string });
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
