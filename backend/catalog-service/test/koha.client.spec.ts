import { HttpService } from '@nestjs/axios';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { of } from 'rxjs';
import { KohaClient } from '../src/koha/koha.client';
import * as tailscale from '../src/tailscale-vercel';

describe('KohaClient transport', () => {
  const get = jest.fn();
  let client: KohaClient;

  beforeEach(() => {
    get.mockReset().mockReturnValue(of({ data: [{ biblio_id: 1, title: 'Example' }] }));
    const values: Record<string, unknown> = {
      'app.koha.baseUrl': 'http://100.118.244.66:8081',
      'app.koha.user': 'test-reader',
      'app.koha.password': 'test-password',
      'app.koha.timeoutMs': 15000,
    };
    const config = {
      getOrThrow: (name: string) => values[name],
      get: (name: string) => values[name],
    } as unknown as ConfigService;
    client = new KohaClient({ get } as unknown as HttpService, config);
  });

  afterEach(() => jest.restoreAllMocks());

  it('preserves direct local access and Koha authentication when Tailscale is disabled', async () => {
    jest.spyOn(tailscale, 'getTailscaleProxy').mockResolvedValue(undefined);
    await expect(client.getBiblios(2, 5)).resolves.toHaveLength(1);
    expect(get).toHaveBeenCalledWith('http://100.118.244.66:8081/api/v1/biblios', expect.objectContaining({
      auth: { username: 'test-reader', password: 'test-password' },
      timeout: 15000,
      params: { _page: 2, _per_page: 5 },
    }));
    expect(get.mock.calls[0][1]).not.toHaveProperty('proxy');
  });

  it('sends Koha requests through the authenticated userspace proxy', async () => {
    const proxy = { protocol: 'http', host: '127.0.0.1', port: 1055 };
    jest.spyOn(tailscale, 'getTailscaleProxy').mockResolvedValue(proxy);
    await client.getBiblios(1, 5);
    expect(get.mock.calls[0][1]).toMatchObject({ proxy });
  });

  it('does not attempt a direct request if Tailscale initialization fails', async () => {
    jest.spyOn(tailscale, 'getTailscaleProxy').mockRejectedValue(new Error('private-auth-key'));
    const logger = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    await expect(client.getBiblios(1, 5)).rejects.toMatchObject({ message: 'Koha could not be reached' });
    expect(get).not.toHaveBeenCalled();
    expect(JSON.stringify(logger.mock.calls)).not.toContain('private-auth-key');
  });
});
