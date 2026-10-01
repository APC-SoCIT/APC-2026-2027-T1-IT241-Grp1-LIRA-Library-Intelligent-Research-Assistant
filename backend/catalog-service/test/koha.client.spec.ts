import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { AxiosRequestConfig } from 'axios';
import { of, throwError } from 'rxjs';
import { KohaClient } from '../src/koha/koha.client';

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