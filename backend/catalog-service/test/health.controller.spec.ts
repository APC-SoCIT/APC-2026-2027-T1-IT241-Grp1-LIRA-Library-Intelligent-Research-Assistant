import { Test } from '@nestjs/testing';
import { HealthController } from '../src/health/health.controller';
import { HealthService } from '../src/health/health.service';

describe('HealthController', () => {
  it('returns service health', async () => {
    const module = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: HealthService, useValue: { serviceHealth: () => ({ status: 'ok' }) } }],
    }).compile();
    expect(module.get(HealthController).getHealth()).toEqual({ status: 'ok' });
  });

  it('returns a safe 503 when Koha is unreachable', async () => {
    const module = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: HealthService, useValue: { kohaHealth: jest.fn().mockRejectedValue(new Error('private')) } }],
    }).compile();
    await expect(module.get(HealthController).getKohaHealth()).rejects.toMatchObject({ status: 503 });
  });
});
