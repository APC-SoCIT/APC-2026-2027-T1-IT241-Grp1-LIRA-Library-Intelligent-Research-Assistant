import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { CatalogController } from '../src/catalog/catalog.controller';
import { CatalogService } from '../src/catalog/catalog.service';
import { LibrarianGuard } from '../src/shared/librarian.guard';
import { ConfigService } from '@nestjs/config';
import { pdfBytes, epubBytes } from './resource-fixtures';
import { Readable } from 'node:stream';

describe('CatalogController (HTTP)', () => {
  let app: INestApplication;
  const catalog = {
    listBooks: jest.fn().mockResolvedValue({ items: [], pagination: { page: 1, limit: 20 } }),
    getBook: jest.fn().mockResolvedValue({ id: 1, title: 'Title' }),
    searchBooks: jest.fn().mockResolvedValue({ items: [], pagination: { page: 1, limit: 20 } }),
    getBookContent: jest.fn().mockResolvedValue({ content: 'Text', sourceUrl: 'https://www.gutenberg.org/a.txt', resolvedUrl: 'https://www.gutenberg.org/a.txt' }),
    getResourceContent: jest.fn(),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [CatalogController],
      providers: [
        { provide: CatalogService, useValue: catalog },
        { provide: LibrarianGuard, useValue: { canActivate: () => true } },
        { provide: ConfigService, useValue: {} },
      ],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await app.init();
  });

  afterAll(async () => app.close());

  it('lists books', () => request(app.getHttpServer()).get('/api/catalog/books?page=2&limit=10').expect(200));
  it('gets a book', () => request(app.getHttpServer()).get('/api/catalog/books/1').expect(200));
  it('searches books', () => request(app.getHttpServer()).get('/api/catalog/search?q=programming').expect(200));
  it('rejects an invalid book ID', () => request(app.getHttpServer()).get('/api/catalog/books/not-a-number').expect(400));
  it('rejects an empty search', () => request(app.getHttpServer()).get('/api/catalog/search?q=   ').expect(400));

  it('keeps the legacy content endpoint as JSON', async () => {
    const response = await request(app.getHttpServer()).get('/api/catalog/books/1/content').expect(200);
    expect(response.headers['content-type']).toMatch(/application\/json/);
    expect(response.body).toEqual({ content: 'Text', sourceUrl: 'https://www.gutenberg.org/a.txt', resolvedUrl: 'https://www.gutenberg.org/a.txt' });
  });

  it.each([
    ['application/pdf', 'safe.pdf', pdfBytes],
    ['application/epub+zip', 'safe.epub', epubBytes],
  ])('serves %s as binary with inline headers and full-body range semantics', async (mediaType, filename, bytes) => {
    catalog.getResourceContent.mockResolvedValue({ stream: Readable.from([bytes]), mediaType, filename,
      contentLength: (bytes as Buffer).length, cancel: jest.fn() });
    const response = await request(app.getHttpServer())
      .get(`/api/catalog/books/1/resources/${'a'.repeat(64)}/content`)
      .set('Range', 'bytes=0-4')
      .buffer(true)
      .parse((res, done) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => done(null, Buffer.concat(chunks)));
        res.on('error', done);
      })
      .expect(200);
    expect(response.body.equals(bytes as Buffer)).toBe(true);
    expect(response.headers).toMatchObject({
      'content-type': mediaType,
      'content-length': String((bytes as Buffer).length),
      'content-disposition': `inline; filename="${filename}"`,
      'x-content-type-options': 'nosniff',
      'cache-control': 'private, no-store',
      'accept-ranges': 'none',
    });
    expect(response.headers).not.toHaveProperty('content-range');
  });

  it('rejects nonpositive book IDs on the resource route', () => request(app.getHttpServer())
    .get(`/api/catalog/books/0/resources/${'a'.repeat(64)}/content`).expect(400));
});
