import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { AxiosRequestConfig } from 'axios';
import { of } from 'rxjs';
import { buildBookResources } from '../src/catalog/book-resources';
import { KohaClient } from '../src/koha/koha.client';

describe('MARC 856 resources', () => {
  const config = {
    getOrThrow: (key: string) => ({
      'app.koha.baseUrl': 'http://koha.example.test',
      'app.koha.user': 'reader', 'app.koha.password': 'password',
    })[key],
    get: () => 5000,
  } as unknown as ConfigService;

  async function read(fields: string, list = false) {
    const xml = `<record><controlfield tag="001">77</controlfield>${fields}</record>`;
    const get = jest.fn((_url: string, options: AxiosRequestConfig) => of({
      data: options.headers?.Accept === 'application/marcxml+xml' ? xml
        : (list ? [{ biblio_id: 77, url: 'https://www.gutenberg.org/legacy.txt' }] : { biblio_id: 77, url: 'https://www.gutenberg.org/legacy.txt' }),
    }));
    const client = new KohaClient({ get } as unknown as HttpService, config);
    const book = list ? (await client.getBiblios(1, 20))[0] : await client.getBiblio(77);
    expect(get).toHaveBeenCalledTimes(2);
    return { record: book, resources: buildBookResources(book.resources, book.url) };
  }

  it('keeps labels and explicit formats within their 856 field, including repeated subfields', async () => {
    const { record, resources } = await read(`
      <datafield tag="650" ind2="4"><subfield code="a">Literature</subfield></datafield>
      <datafield tag="856"><subfield code="u">https://www.gutenberg.org/one.pdf</subfield><subfield code="q">text/html</subfield><subfield code="y">Read online</subfield></datafield>
      <datafield tag="856"><subfield code="u">http://koha.example.test:8080/cgi-bin/koha/opac-retrieve-file.pl?id=alpha</subfield><subfield code="u">http://koha.example.test:8080/cgi-bin/koha/opac-retrieve-file.pl?id=beta</subfield><subfield code="q">PDF</subfield><subfield code="q">application/epub+zip</subfield><subfield code="y">Portable edition</subfield><subfield code="y">Reflowable edition</subfield></datafield>`, true);
    expect(record.categories).toEqual(['Literature']);
    expect(record.url).toBe('https://www.gutenberg.org/legacy.txt');
    expect(resources.map(({ format, label, mediaType }) => ({ format, label, mediaType }))).toEqual([
      { format: 'html', label: 'Read online', mediaType: 'text/html' },
      { format: 'pdf', label: 'Portable edition', mediaType: 'application/pdf' },
      { format: 'epub', label: 'Reflowable edition', mediaType: 'application/epub+zip' },
      { format: 'text', label: 'Plain text resource', mediaType: 'text/plain' },
    ]);
  });

  it('shares a single format/label across repeated URLs and ignores fields without a URL', async () => {
    const { resources } = await read(`
      <datafield tag="856"><subfield code="q">PDF</subfield><subfield code="y">Unused</subfield></datafield>
      <datafield tag="856"><subfield code="u">https://www.gutenberg.org/a</subfield><subfield code="u">https://www.gutenberg.org/b</subfield><subfield code="q">text/plain; charset=utf-8</subfield><subfield code="y">Text edition</subfield></datafield>`);
    expect(resources.slice(0, 2)).toEqual([
      expect.objectContaining({ format: 'text', label: 'Text edition' }),
      expect.objectContaining({ format: 'text', label: 'Text edition' }),
    ]);
    expect(resources).toHaveLength(3);
  });

  it('preserves missing slots when pairing, and leaves opaque hashes unknown', async () => {
    const { resources } = await read(`
      <datafield tag="856"><subfield code="u">https://www.gutenberg.org/empty</subfield><subfield code="u">https://www.gutenberg.org/full</subfield><subfield code="q"></subfield><subfield code="q">EPUB</subfield><subfield code="y"></subfield><subfield code="y">Named</subfield></datafield>
      <datafield tag="856"><subfield code="u">http://koha.example.test:8080/cgi-bin/koha/opac-retrieve-file.pl?id=opaquehash</subfield></datafield>`);
    expect(resources.slice(0, 3)).toEqual([
      expect.objectContaining({ format: 'unknown', label: 'Online resource', mediaType: null }),
      expect.objectContaining({ format: 'epub', label: 'Named' }),
      expect.objectContaining({ format: 'unknown', mediaType: null }),
    ]);
  });

  it('does not guess when repeated formats conflict or counts cannot be paired', async () => {
    const { resources } = await read(`
      <datafield tag="856"><subfield code="u">https://www.gutenberg.org/a.pdf</subfield><subfield code="u">https://www.gutenberg.org/b.epub</subfield><subfield code="u">https://www.gutenberg.org/c</subfield><subfield code="q">PDF</subfield><subfield code="q">EPUB</subfield></datafield>`);
    expect(resources.slice(0, 3).map((resource) => resource.format)).toEqual(['unknown', 'unknown', 'unknown']);
  });

  it('merges duplicate URLs predictably and keeps identifiers stable across field order/labels', async () => {
    const a = '<datafield tag="856"><subfield code="u">https://www.gutenberg.org/a#chapter</subfield></datafield>';
    const b = '<datafield tag="856"><subfield code="u">https://www.gutenberg.org/a</subfield><subfield code="q">PDF</subfield><subfield code="y">PDF edition</subfield></datafield>';
    const c = '<datafield tag="856"><subfield code="u">https://www.gutenberg.org/a</subfield><subfield code="y">Later label</subfield></datafield>';
    const first = (await read(a + b + c)).resources;
    const reordered = (await read(c + b + a)).resources;
    expect(first).toHaveLength(2);
    expect(first[0]).toMatchObject({ label: 'PDF edition', format: 'pdf', sourceUrl: 'https://www.gutenberg.org/a' });
    expect(reordered[0].id).toBe(first[0].id);
    expect(first[0].id).toMatch(/^[a-f0-9]{64}$/);
  });

  it('falls back to path extensions only without explicit metadata and retains other MIME types', () => {
    const resources = buildBookResources([
      { url: 'https://www.gutenberg.org/file.pdf', formats: ['image/jpeg'], labels: [] },
      { url: 'invalid', formats: [], labels: [] },
    ], 'https://www.gutenberg.org/a.EPUB?download=1|https://www.gutenberg.org/a.htm|https://www.gutenberg.org/a.txt|https://www.gutenberg.org/a.pdf');
    expect(resources.map((resource) => resource.format)).toEqual(['unknown', 'unknown', 'epub', 'html', 'text', 'pdf']);
    expect(resources[0].mediaType).toBe('image/jpeg');
    expect(buildBookResources([], 'https://www.gutenberg.org/a.txt.utf-8|https://www.gutenberg.org/a.html.images')
      .map((resource) => resource.format)).toEqual(['text', 'html']);
  });

  it('retains JSON URL fallback on malformed MARCXML', async () => {
    const get = jest.fn((_url: string, options: AxiosRequestConfig) => of({
      data: options.headers?.Accept === 'application/marcxml+xml' ? '<record>' : { biblio_id: 77, url: 'https://www.gutenberg.org/fallback.txt' },
    }));
    const record = await new KohaClient({ get } as unknown as HttpService, config).getBiblio(77);
    expect(record).toMatchObject({ categories: [], resources: [], url: 'https://www.gutenberg.org/fallback.txt' });
    expect(buildBookResources(record.resources, record.url)[0].format).toBe('text');
  });
});
