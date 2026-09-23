import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { CatalogController } from '../src/catalog/catalog.controller';
import { CatalogService } from '../src/catalog/catalog.service';

describe('CatalogController (HTTP)', () => {
  let app: INestApplication;
  const catalog = {
    listBooks: jest.fn().mockResolvedValue({ items: [], pagination: { page: 1, limit: 20 } }),
    getBook: jest.fn().mockResolvedValue({ id: 1, title: 'Title' }),
    searchBooks: jest.fn().mockResolvedValue({ items: [], pagination: { page: 1, limit: 20 } }),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [CatalogController],
      providers: [{ provide: CatalogService, useValue: catalog }],
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
});
