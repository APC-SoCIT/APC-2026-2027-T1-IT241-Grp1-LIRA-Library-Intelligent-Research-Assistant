import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AxiosError, AxiosRequestConfig } from 'axios';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { firstValueFrom } from 'rxjs';
import { getTailscaleProxy } from '../tailscale-vercel';
import { KohaIntegrationError } from './koha.exceptions';
import { KohaBiblio, KohaBiblioResponse } from './koha.types';
import { ResourceMetadata } from '../catalog/resource.types';

interface MarcEnrichment {
  categories: string[];
  resources: ResourceMetadata[];
  coverUrl: string | null;
}

const controlledCategories = new Map([
  'Psychology',
  'Engineering',
  'Computer Science',
  'Literature',
  'Photography',
  'Accounting',
  'Architecture',
  'Business & Economics',
  'History',
].map((category) => [category.toLowerCase(), category]));

const marcXmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseTagValue: false,
  trimValues: true,
});

@Injectable()
export class KohaClient {
  private readonly logger = new Logger(KohaClient.name);
  private readonly baseUrl: string;
  private readonly uploadUrl: string;
  private readonly uploadCategory: string;
  private readonly uploadCookie: string;
  private readonly uploadCsrfToken: string;
  private readonly uploadAuth: { username: string; password: string };
  private readonly auth: { username: string; password: string };
  private readonly timeout: number;
  private sessionCookie = '';
  private sessionCsrfToken = '';

  constructor(
    private readonly http: HttpService,
    config: ConfigService,
  ) {
    this.baseUrl = config.getOrThrow<string>('app.koha.baseUrl');
    this.uploadUrl = config.get<string>('app.koha.uploadUrl') || `${this.baseUrl}/cgi-bin/koha/tools/upload-file.pl`;
    this.uploadCategory = config.get<string>('app.koha.uploadCategory') || 'LIRA';
    this.uploadCookie = config.get<string>('app.koha.uploadCookie') || '';
    this.uploadCsrfToken = config.get<string>('app.koha.uploadCsrfToken') || '';
    this.auth = {
      username: config.getOrThrow<string>('app.koha.user'),
      password: config.getOrThrow<string>('app.koha.password'),
    };
    this.uploadAuth = {
      username: config.get<string>('app.koha.uploadUser') || this.auth.username,
      password: config.get<string>('app.koha.uploadPassword') || this.auth.password,
    };
    this.timeout = config.get<number>('app.koha.timeoutMs', 5000);
  }

  async getBiblios(page: number, limit: number, orderBy?: string): Promise<KohaBiblio[]> {
    return this.getEnrichedBiblios({
      params: {
        _page: page,
        _per_page: limit,
        ...(orderBy ? { _order_by: orderBy } : {}),
      },
    });
  }

  async getBiblio(id: number): Promise<KohaBiblio> {
    const [jsonResponse, enrichment] = await Promise.all([
      this.request<KohaBiblio>(`/api/v1/biblios/${id}`),
      this.getMarcEnrichment(`/api/v1/biblios/${id}`),
    ]);
    if (!this.isRecord(jsonResponse.data) || (!this.hasNumber(jsonResponse.data, 'biblio_id') && !this.hasNumber(jsonResponse.data, 'id'))) {
      throw new KohaIntegrationError('unexpected', 'Koha returned an invalid bibliographic record');
    }
    const recordId = jsonResponse.data.biblio_id ?? jsonResponse.data.id;
    return { ...jsonResponse.data, categories: enrichment.get(recordId as number)?.categories ?? [],
      resources: enrichment.get(recordId as number)?.resources ?? [], cover_url: enrichment.get(recordId as number)?.coverUrl ?? null };
  }

  async searchBiblios(query: string, page: number, limit: number): Promise<KohaBiblio[]> {
    const searchTerm = `%${query}%`;
    return this.getEnrichedBiblios({
      params: {
        q: JSON.stringify({
          '-or': [
            { title: { '-like': searchTerm } },
            { author: { '-like': searchTerm } },
            { isbn: { '-like': searchTerm } },
          ],
        }),
        _page: page,
        _per_page: limit,
      },
    });
  }

  async createBiblio(record: Record<string, unknown>): Promise<KohaBiblio> {
    const response = await this.writeRequest<KohaBiblio>('POST', '/api/v1/biblios', record);
    return response.data;
  }

  async updateBiblio(id: number, record: Record<string, unknown>): Promise<KohaBiblio> {
    const response = await this.writeRequest<KohaBiblio>('PUT', `/api/v1/biblios/${id}`, record);
    return response.data;
  }

  async deleteBiblio(id: number): Promise<void> {
    try {
      const proxy = await getTailscaleProxy();
      await firstValueFrom(this.http.delete(`${this.baseUrl}/api/v1/biblios/${id}`, {
        ...(proxy ? { proxy } : {}),
        auth: this.auth,
        timeout: this.timeout,
        headers: { Accept: 'application/json' },
      }));
    } catch (error: unknown) {
      throw this.toIntegrationError(error);
    }
  }

  async uploadFile(file: Buffer, filename: string, contentType: string): Promise<string> {
    const session = await this.getUploadSession();
    const boundary = `----LIRA-${Math.random().toString(16).slice(2)}`;
    const cleanedFilename = filename.replace(/["\\\r\n]/g, '_');
    const extension = cleanedFilename.match(/\.[a-z0-9]{1,10}$/i)?.[0] ?? '';
    const stem = extension ? cleanedFilename.slice(0, -extension.length) : cleanedFilename;
    const safeFilename = `${stem || 'upload'}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}${extension}`;
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="csrf_token"\r\n\r\n${session.csrfToken}\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="uploadfile"; filename="${safeFilename}"\r\nContent-Type: ${contentType}\r\n\r\n`),
      file,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);
    const url = new URL(this.uploadUrl);
    url.searchParams.set('public', '1');
    url.searchParams.set('category', this.uploadCategory);
    try {
      const proxy = await getTailscaleProxy();
      const response = await firstValueFrom(this.http.post<string>(url.href, body, {
        ...(proxy ? { proxy } : {}), auth: this.auth, timeout: this.timeout,
        responseType: 'text', maxContentLength: 1024 * 1024, maxBodyLength: body.length,
        headers: { Accept: 'application/json', Cookie: session.cookie, 'Content-Type': `multipart/form-data; boundary=${boundary}` },
      }));
      let payload: unknown;
      try { payload = JSON.parse(response.data); } catch { throw new KohaIntegrationError('unexpected', 'Koha upload returned invalid JSON'); }
      const result = payload as { status?: string; fileid?: string | number; errors?: unknown };
      const rawFileId = typeof result.fileid === 'string' || typeof result.fileid === 'number' ? String(result.fileid).trim() : '';
      const returnedId = rawFileId.split(',')[0]?.trim().replace(/^['"]|['"]$/g, '') ?? '';
      if (result.status !== 'done' || !returnedId || !/^[a-zA-Z0-9._-]{1,200}$/.test(returnedId)) {
        const responseDetail = result.errors
          ? ` (${JSON.stringify(result.errors).slice(0, 200)})`
          : ` (fileid=${rawFileId || 'missing'}; keys=${Object.keys(payload as object).join(',') || 'none'})`;
        throw new KohaIntegrationError('unexpected', `Koha upload returned status '${result.status ?? 'unknown'}'${responseDetail}`);
      }
      return /^[a-f0-9]{32}$/i.test(returnedId)
        ? returnedId
        : await this.resolveUploadHash(returnedId, session.cookie);
    } catch (error: unknown) {
      if (error instanceof KohaIntegrationError) throw error;
      throw this.toIntegrationError(error);
    }
  }

  /**
   * Koha's upload CGI returns the UploadedFile database id, while the public
   * OPAC retrieval CGI expects the file's hashvalue. Resolve the id through
   * the authenticated upload search page before writing the 856$u URL.
   */
  private async resolveUploadHash(fileId: string, cookie: string): Promise<string> {
    try {
      const url = new URL('/cgi-bin/koha/tools/upload.pl', this.uploadUrl);
      url.searchParams.set('op', 'search');
      url.searchParams.set('id', fileId);
      const proxy = await getTailscaleProxy();
      const response = await firstValueFrom(this.http.get<string>(url.href, {
        ...(proxy ? { proxy } : {}),
        timeout: this.timeout,
        responseType: 'text',
        headers: { Accept: 'text/html', Cookie: cookie },
      }));
      const hashes = [...response.data.matchAll(/\b[a-f0-9]{32}\b/gi)].map((match) => match[0]);
      const hash = hashes[0];
      if (hash) return hash;
      throw new KohaIntegrationError('unexpected', `Koha upload returned fileid=${fileId}, but no hashvalue was found`);
    } catch (error: unknown) {
      if (error instanceof KohaIntegrationError) throw error;
      throw this.toIntegrationError(error);
    }
  }

  private async getUploadSession(): Promise<{ cookie: string; csrfToken: string }> {
    if (this.uploadCookie && this.uploadCsrfToken) return { cookie: this.uploadCookie, csrfToken: this.uploadCsrfToken };
    if (this.sessionCookie && this.sessionCsrfToken) return { cookie: this.sessionCookie, csrfToken: this.sessionCsrfToken };

    try {
      const proxy = await getTailscaleProxy();
      const loginPage = await firstValueFrom(this.http.get<string>(`${this.baseUrl}/cgi-bin/koha/mainpage.pl`, {
        ...(proxy ? { proxy } : {}), timeout: this.timeout, responseType: 'text', headers: { Accept: 'text/html' },
      }));
      const initialCookies = this.cookiesFrom(loginPage.headers['set-cookie']);
      const loginCsrf = this.htmlInput(loginPage.data, 'csrf_token');
      const loginBody = new URLSearchParams({
        csrf_token: loginCsrf, login_op: 'cud-login', koha_login_context: 'intranet',
        login_userid: this.uploadAuth.username, login_password: this.uploadAuth.password, branch: '',
      }).toString();
      const loginResponse = await firstValueFrom(this.http.post<string>(`${this.baseUrl}/cgi-bin/koha/mainpage.pl`, loginBody, {
        ...(proxy ? { proxy } : {}), timeout: this.timeout, responseType: 'text', maxRedirects: 0,
        validateStatus: (status) => status >= 200 && status < 400,
        auth: this.uploadAuth,
        headers: { Accept: 'text/html', 'Content-Type': 'application/x-www-form-urlencoded', ...(initialCookies ? { Cookie: initialCookies } : {}) },
      }));
      const loginCookies = this.mergeCookies(initialCookies, this.cookiesFrom(loginResponse.headers['set-cookie']));
      if (!loginCookies) throw new KohaIntegrationError('unauthorized', 'Koha staff login did not create a session');

      const uploadPage = await firstValueFrom(this.http.get<string>(`${this.baseUrl}/cgi-bin/koha/tools/upload.pl?op=search`, {
        ...(proxy ? { proxy } : {}), timeout: this.timeout, responseType: 'text', headers: { Accept: 'text/html', Cookie: loginCookies },
      }));
      const cookies = this.mergeCookies(loginCookies, this.cookiesFrom(uploadPage.headers['set-cookie']));
      const csrfToken = this.htmlMeta(uploadPage.data) || this.htmlInput(uploadPage.data, 'csrf_token') || loginCsrf;
      if (!cookies || !csrfToken) throw new KohaIntegrationError('forbidden', 'Koha staff session did not provide an upload CSRF token');
      this.sessionCookie = cookies;
      this.sessionCsrfToken = csrfToken;
      return { cookie: cookies, csrfToken };
    } catch (error: unknown) {
      if (error instanceof KohaIntegrationError) throw error;
      throw this.toIntegrationError(error);
    }
  }

  private cookiesFrom(setCookie: string[] | undefined): string {
    return (setCookie ?? []).map((value) => value.split(';', 1)[0]).filter(Boolean).join('; ');
  }

  private mergeCookies(...values: string[]): string {
    const merged = new Map<string, string>();
    values.join(';').split(';').map((value) => value.trim()).filter(Boolean).forEach((value) => {
      const separator = value.indexOf('=');
      if (separator > 0) merged.set(value.slice(0, separator), value);
    });
    return [...merged.values()].join('; ');
  }

  private htmlInput(html: string, name: string): string {
    const match = html.match(new RegExp(`<input[^>]+name=["']${name}["'][^>]+value=["']([^"']*)["']`, 'i'))
      ?? html.match(new RegExp(`<input[^>]+value=["']([^"']*)["'][^>]+name=["']${name}["']`, 'i'));
    return match?.[1] ?? '';
  }

  private htmlMeta(html: string): string {
    const match = html.match(/<meta[^>]+name=["']csrf-token["'][^>]+content=["']([^"']*)["']/i)
      ?? html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']csrf-token["']/i);
    return match?.[1] ?? '';
  }

  async checkConnectivity(): Promise<void> {
    await this.getBiblio(1);
  }

  private async request<T>(path: string, options: AxiosRequestConfig = {}) {
    try {
      const proxy = await getTailscaleProxy();
      return await firstValueFrom(this.http.get<T>(`${this.baseUrl}${path}`, {
        ...options,
        ...(proxy ? { proxy } : {}),
        auth: this.auth,
        timeout: this.timeout,
        headers: { Accept: 'application/json', ...options.headers },
      }));
    } catch (error: unknown) {
      throw this.toIntegrationError(error);
    }
  }

  private async writeRequest<T>(method: 'POST' | 'PUT', path: string, data: Record<string, unknown>) {
    try {
      const proxy = await getTailscaleProxy();
      return await firstValueFrom(this.http.request<T>({
        method,
        url: `${this.baseUrl}${path}`,
        data,
        ...(proxy ? { proxy } : {}),
        auth: this.auth,
        timeout: this.timeout,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/marc-in-json',
          'x-record-schema': 'MARC21',
          'x-confirm-not-duplicate': '1',
        },
      }));
    } catch (error: unknown) {
      throw this.toIntegrationError(error);
    }
  }

  private async getEnrichedBiblios(options: AxiosRequestConfig): Promise<KohaBiblio[]> {
    const [jsonResponse, marcResponse] = await Promise.all([
      this.request<KohaBiblioResponse>('/api/v1/biblios', options),
      this.getMarcEnrichment('/api/v1/biblios', options),
    ]);
    const records = this.extractBiblios(jsonResponse.data);
    return records.map((record) => {
      const id = record.biblio_id ?? record.id;
      const enrichment = typeof id === 'number' ? marcResponse.get(id) : undefined;
      return { ...record, categories: enrichment?.categories ?? [], resources: enrichment?.resources ?? [],
        ...(enrichment?.coverUrl ? { cover_url: enrichment.coverUrl } : {}) };
    });
  }

  private async getMarcEnrichment(path: string, options: AxiosRequestConfig = {}): Promise<Map<number, MarcEnrichment>> {
    try {
      const response = await this.request<string>(path, {
        ...options,
        responseType: 'text',
        headers: { ...options.headers, Accept: 'application/marcxml+xml' },
      });
      const enrichment = this.extractMarcEnrichment(response.data);
      await this.resolveLegacyUploadUrls(enrichment);
      return enrichment;
    } catch {
      this.logger.warn('Koha MARCXML enrichment failed; returning JSON catalog metadata');
      return new Map();
    }
  }

  private extractMarcEnrichment(marcXml: string): Map<number, MarcEnrichment> {
    const validation = XMLValidator.validate(marcXml);
    if (validation !== true) {
      throw new KohaIntegrationError('unexpected', 'Koha returned invalid MARCXML');
    }

    const parsed = marcXmlParser.parse(marcXml) as Record<string, unknown>;
    const collection = this.isRecord(parsed.collection) ? parsed.collection : parsed;
    const records = this.asArray(collection.record);
    const enrichmentByBiblioId = new Map<number, MarcEnrichment>();

    for (const rawRecord of records) {
      if (!this.isRecord(rawRecord)) continue;
      const fields = this.asArray(rawRecord.datafield).filter((field): field is Record<string, unknown> => this.isRecord(field));
      const controlFields = this.asArray(rawRecord.controlfield).filter((field): field is Record<string, unknown> => this.isRecord(field));
      const idField = fields.find((field) => field['@_tag'] === '999');
      const idSubfield = idField && this.asArray(idField.subfield)
        .find((field): field is Record<string, unknown> => this.isRecord(field) && field['@_code'] === 'c');
      const controlNumber = controlFields.find((field) => field['@_tag'] === '001');
      const internalId = this.positiveInteger(this.xmlText(idSubfield) ?? this.xmlText(controlNumber));
      if (internalId === undefined) continue;

      const categories = new Set<string>();
      const resources: ResourceMetadata[] = [];
      let coverUrl: string | null = null;
      for (const field of fields) {
        if (field['@_tag'] === '856') {
          const subfields = this.asArray(field.subfield).filter((value): value is Record<string, unknown> => this.isRecord(value));
          const values = (code: string) => subfields.filter((value) => value['@_code'] === code)
            .map((value) => this.xmlText(value) ?? '');
          const urls = values('u');
          const formats = values('q');
          const labels = values('y');
          // Equal counts pair by position; otherwise metadata is shared only
          // within this 856 field. Preserve blank slots before pairing.
          urls.forEach((url, index) => {
            if (!url) return;
            const explicitCover = [...values('3'), ...labels].some((value) => value.toLowerCase().includes('cover image'));
            const imageUrl = /\.(?:jpe?g|png|webp|gif)(?:[?#]|$)/i.test(url);
            if (explicitCover || imageUrl) coverUrl ??= url;
            resources.push({ url,
              formats: (formats.length === urls.length ? [formats[index]] : formats).filter(Boolean),
              labels: (labels.length === urls.length ? [labels[index]] : labels).filter(Boolean),
            });
          });
        }
        if (field['@_tag'] !== '650' || field['@_ind2'] !== '4') continue;
        for (const subfield of this.asArray(field.subfield)) {
          if (!this.isRecord(subfield) || subfield['@_code'] !== 'a') continue;
          const value = this.xmlText(subfield);
          const category = value ? controlledCategories.get(value.toLowerCase()) : undefined;
          if (category) categories.add(category);
        }
      }
      enrichmentByBiblioId.set(internalId, { categories: [...categories], resources, coverUrl });
    }

    return enrichmentByBiblioId;
  }

  /**
   * Older records may contain the numeric UploadedFile database id in their
   * 856$u URL. Koha's OPAC retrieval CGI requires the file hashvalue, so
   * repair those URLs while reading the record as well as for new uploads.
   */
  private async resolveLegacyUploadUrls(enrichment: Map<number, MarcEnrichment>): Promise<void> {
    for (const value of enrichment.values()) {
      for (const resource of value.resources) {
        const resolved = await this.resolveLegacyUploadUrl(resource.url);
        if (!resolved) continue;
        resource.url = resolved;
        if (value.coverUrl) value.coverUrl = value.coverUrl === resource.url ? resolved : value.coverUrl;
      }
      if (value.coverUrl) {
        const resolvedCover = await this.resolveLegacyUploadUrl(value.coverUrl);
        if (resolvedCover) value.coverUrl = resolvedCover;
      }
    }
  }

  private async resolveLegacyUploadUrl(sourceUrl: string): Promise<string | undefined> {
    try {
      const url = new URL(sourceUrl);
      if (!/\/cgi-bin\/koha\/opac-retrieve-file\.pl$/i.test(url.pathname)) return undefined;
      const id = url.searchParams.get('id') ?? '';
      if (!/^\d+$/.test(id)) return undefined;
      const session = await this.getUploadSession();
      const hash = await this.resolveUploadHash(id, session.cookie);
      url.searchParams.set('id', hash);
      return url.href;
    } catch (error: unknown) {
      if (error instanceof KohaIntegrationError) {
        this.logger.warn(`Unable to resolve legacy Koha upload ${sourceUrl}: ${error.message}`);
      }
      return undefined;
    }
  }

  private asArray(value: unknown): unknown[] {
    if (value === undefined || value === null) return [];
    return Array.isArray(value) ? value : [value];
  }

  private xmlText(value: Record<string, unknown> | undefined): string | undefined {
    if (!value) return undefined;
    if (typeof value['#text'] === 'string') return value['#text'].trim();
    return undefined;
  }

  private positiveInteger(value: string | undefined): number | undefined {
    if (!value || !/^\d+$/.test(value)) return undefined;
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
  }

  private extractBiblios(payload: KohaBiblioResponse): KohaBiblio[] {
    if (Array.isArray(payload)) return payload;
    if (this.isRecord(payload) && Array.isArray(payload.biblios)) return payload.biblios;
    if (this.isRecord(payload) && Array.isArray(payload.items)) return payload.items;
    throw new KohaIntegrationError('unexpected', 'Koha returned an invalid catalog response');
  }

  private toIntegrationError(error: unknown): KohaIntegrationError {
    const axiosError = error as AxiosError;
    const status = axiosError.response?.status;
    if (status === 400) {
      const detail = this.safeKohaErrorDetail(axiosError.response?.data);
      return new KohaIntegrationError('bad-request', detail ? `Koha rejected the request: ${detail}` : 'Koha rejected the request', status);
    }
    if (status === 401) {
      const detail = this.safeKohaErrorDetail(axiosError.response?.data);
      return new KohaIntegrationError('unauthorized', detail ? `Koha authentication failed: ${detail}` : 'Koha authentication failed', status);
    }
    if (status === 403) {
      const detail = this.safeKohaErrorDetail(axiosError.response?.data);
      return new KohaIntegrationError('forbidden', detail ? `Koha denied the request: ${detail}` : 'Koha denied the request; check editcatalogue and upload permissions', status);
    }
    if (status === 404) return new KohaIntegrationError('not-found', 'Koha record not found', status);
    if (status === 429) return new KohaIntegrationError('rate-limit', 'Koha rate limit exceeded', status);
    if (typeof status === 'number' && status >= 500) {
      const detail = this.safeKohaErrorDetail(axiosError.response?.data);
      return new KohaIntegrationError('unavailable', detail ? `Koha returned an internal error: ${detail}` : 'Koha is unavailable', status);
    }

    const code = axiosError.code;
    if (code === 'ECONNABORTED' || code === 'ETIMEDOUT') {
      this.logger.warn('Koha request timed out');
      return new KohaIntegrationError('unavailable', 'Koha request timed out');
    }

    this.logger.error(`Koha request failed${code ? ` (${code})` : ''}`);
    return new KohaIntegrationError('unavailable', 'Koha could not be reached');
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }

  private hasNumber(value: Record<string, unknown>, key: string): boolean {
    return typeof value[key] === 'number';
  }

  private safeKohaErrorDetail(value: unknown): string {
    if (typeof value === 'string') return value.replace(/\s+/g, ' ').trim().slice(0, 300);
    if (!this.isRecord(value)) return '';
    for (const key of ['error', 'message', 'error_description', 'errors']) {
      const candidate = value[key];
      if (typeof candidate === 'string') return candidate.replace(/\s+/g, ' ').trim().slice(0, 300);
      if (Array.isArray(candidate)) return candidate.map((item) => typeof item === 'string' ? item : JSON.stringify(item)).join('; ').slice(0, 300);
    }
    return '';
  }
}
