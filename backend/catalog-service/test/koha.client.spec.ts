import { HttpService } from '@nestjs/axios';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AxiosRequestConfig } from 'axios';
import { of, throwError } from 'rxjs';
import { KohaClient } from '../src/koha/koha.client';
import * as tailscale from '../src/tailscale-vercel';

describe('KohaClient MARC categories', () => {
  it('merges controlled local 650 categories into JSON records by Koha biblionumber', async () => {
    const marcXml = `<?xml version="1.0" encoding="UTF-8"?>
      <collection xmlns="http://www.loc.gov/MARC21/slim">
        <record>
          <controlfield tag="001">PG1342</controlfield>
          <datafield tag="999" ind1=" " ind2=" "><subfield code="c">440</subfield></datafield>
          <datafield tag="650" ind1=" " ind2="0"><subfield code="a">Computer Science</subfield></datafield>
          <datafield tag="650" ind1=" " ind2="4"><subfield code="a">Literature</subfield></datafield>
          <datafield tag="650" ind1=" " ind2="4"><subfield code="a">literature</subfield></datafield>
          <datafield tag="650" ind1=" " ind2="4"><subfield code="a">Other local term</subfield></datafield>
        </record>
      </collection>`;
    const get = jest.fn((_url: string, options: AxiosRequestConfig) => {
      const headers = options.headers as Record<string, string>;
      const data = headers.Accept === 'application/marcxml+xml'
        ? marcXml
        : [{ biblio_id: 440, title: 'Pride and Prejudice' }];
      return of({ data });
    });
    const http = { get } as unknown as HttpService;
    const configValues: Record<string, string> = {
      'app.koha.baseUrl': 'http://koha.example.test',
      'app.koha.user': 'catalog-reader',
      'app.koha.password': 'test-password',
    };
    const config = {
      getOrThrow: jest.fn((key: string) => configValues[key]),
      get: jest.fn().mockReturnValue(5000),
    } as unknown as ConfigService;
    const client = new KohaClient(http, config);

    await expect(client.getBiblios(1, 20)).resolves.toMatchObject([
      { biblio_id: 440, categories: ['Literature'] },
    ]);
    expect(get).toHaveBeenCalledTimes(2);
    expect(get.mock.calls.map(([, options]) => (options.headers as Record<string, string>).Accept)).toEqual([
      'application/json',
      'application/marcxml+xml',
    ]);
  });

  it('returns JSON catalog records when an optional MARCXML page fails', async () => {
    const get = jest.fn((_url: string, options: AxiosRequestConfig) => {
      const headers = options.headers as Record<string, string>;
      if (headers.Accept === 'application/marcxml+xml') {
        return throwError(() => ({ response: { status: 500 } }));
      }
      return of({ data: [{ biblio_id: 301, title: 'Catalog record' }] });
    });
    const http = { get } as unknown as HttpService;
    const configValues: Record<string, string> = {
      'app.koha.baseUrl': 'http://koha.example.test',
      'app.koha.user': 'catalog-reader',
      'app.koha.password': 'test-password',
    };
    const config = {
      getOrThrow: jest.fn((key: string) => configValues[key]),
      get: jest.fn().mockReturnValue(5000),
    } as unknown as ConfigService;
    const client = new KohaClient(http, config);

    await expect(client.getBiblios(4, 100)).resolves.toEqual([
      { biblio_id: 301, title: 'Catalog record', categories: [] },
    ]);
  });
});

describe('KohaClient Tailscale transport', () => {
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
