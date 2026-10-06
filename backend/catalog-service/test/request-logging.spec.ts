import { Controller, Get, INestApplication, Logger, ServiceUnavailableException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { RequestLoggingInterceptor } from '../src/shared/request-logging.interceptor';

@Controller('logging-test')
class LoggingTestController {
  @Get('ok')
  ok() { return { ok: true }; }

  @Get('unavailable')
  unavailable() { throw new ServiceUnavailableException('Catalog unavailable'); }
}

describe('Completed HTTP request logging', () => {
  let app: INestApplication;
  let log: jest.SpyInstance;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ controllers: [LoggingTestController] }).compile();
    app = module.createNestApplication();
    app.useGlobalInterceptors(new RequestLoggingInterceptor());
    await app.init();
  });

  beforeEach(() => { log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {}); });
  afterEach(() => { log.mockRestore(); });
  afterAll(async () => { await app.close(); });

  it.each([
    ['ok', 200],
    ['unavailable', 503],
  ])('logs the final response status for %s', async (route, status) => {
    await request(app.getHttpServer()).get('/logging-test/' + route).expect(status);
    expect(log).toHaveBeenCalledWith(expect.stringMatching(
      new RegExp(`^GET /logging-test/${route} ${status} \\d+ms$`),
    ));
    expect(log).toHaveBeenCalledTimes(1);
  });
});
