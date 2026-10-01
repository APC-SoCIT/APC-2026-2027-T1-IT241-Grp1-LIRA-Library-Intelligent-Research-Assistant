import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AxiosError, AxiosRequestConfig } from 'axios';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { firstValueFrom } from 'rxjs';
import { KohaIntegrationError } from './koha.exceptions';
import { KohaBiblio, KohaBiblioResponse } from './koha.types';

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
  private readonly auth: { username: string; password: string };
  private readonly timeout: number;

  constructor(
    private readonly http: HttpService,
    config: ConfigService,
  ) {
    this.baseUrl = config.getOrThrow<string>('app.koha.baseUrl');
    this.auth = {
      username: config.getOrThrow<string>('app.koha.user'),
      password: config.getOrThrow<string>('app.koha.password'),
    };
    this.timeout = config.get<number>('app.koha.timeoutMs', 5000);
  }

  async getBiblios(page: number, limit: number): Promise<KohaBiblio[]> {
    return this.getBibliosWithCategories({ params: { _page: page, _per_page: limit } });
  }

  async getBiblio(id: number): Promise<KohaBiblio> {
    const [jsonResponse, categoryMap] = await Promise.all([
      this.request<KohaBiblio>(`/api/v1/biblios/${id}`),
      this.getControlledCategories(`/api/v1/biblios/${id}`),
    ]);
    if (!this.isRecord(jsonResponse.data) || (!this.hasNumber(jsonResponse.data, 'biblio_id') && !this.hasNumber(jsonResponse.data, 'id'))) {
      throw new KohaIntegrationError('unexpected', 'Koha returned an invalid bibliographic record');
    }
    const recordId = jsonResponse.data.biblio_id ?? jsonResponse.data.id;
    return { ...jsonResponse.data, categories: categoryMap.get(recordId as number) ?? [] };
  }

  async searchBiblios(query: string, page: number, limit: number): Promise<KohaBiblio[]> {
    const searchTerm = `%${query}%`;
    return this.getBibliosWithCategories({
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

  async checkConnectivity(): Promise<void> {
    await this.getBiblio(1);
  }

  private async request<T>(path: string, options: AxiosRequestConfig = {}) {
    try {
      return await firstValueFrom(this.http.get<T>(`${this.baseUrl}${path}`, {
        ...options,
        auth: this.auth,
        timeout: this.timeout,
        headers: { Accept: 'application/json', ...options.headers },
      }));
    } catch (error: unknown) {
      throw this.toIntegrationError(error);
    }
  }

  private async getBibliosWithCategories(options: AxiosRequestConfig): Promise<KohaBiblio[]> {
    const [jsonResponse, marcResponse] = await Promise.all([
      this.request<KohaBiblioResponse>('/api/v1/biblios', options),
      this.getControlledCategories('/api/v1/biblios', options),
    ]);
    const records = this.extractBiblios(jsonResponse.data);
    return records.map((record) => {
      const id = record.biblio_id ?? record.id;
      return { ...record, categories: typeof id === 'number' ? marcResponse.get(id) ?? [] : [] };
    });
  }

  private async getControlledCategories(path: string, options: AxiosRequestConfig = {}): Promise<Map<number, string[]>> {
    try {
      const response = await this.request<string>(path, {
        ...options,
        responseType: 'text',
        headers: { ...options.headers, Accept: 'application/marcxml+xml' },
      });
      return this.extractControlledCategories(response.data);
    } catch {
      this.logger.warn('Koha MARCXML category enrichment failed; returning catalog records without categories');
      return new Map();
    }
  }

  private extractControlledCategories(marcXml: string): Map<number, string[]> {
    const validation = XMLValidator.validate(marcXml);
    if (validation !== true) {
      throw new KohaIntegrationError('unexpected', 'Koha returned invalid MARCXML');
    }

    const parsed = marcXmlParser.parse(marcXml) as Record<string, unknown>;
    const collection = this.isRecord(parsed.collection) ? parsed.collection : parsed;
    const records = this.asArray(collection.record);
    const categoriesByBiblioId = new Map<number, string[]>();

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
      for (const field of fields) {
        if (field['@_tag'] !== '650' || field['@_ind2'] !== '4') continue;
        for (const subfield of this.asArray(field.subfield)) {
          if (!this.isRecord(subfield) || subfield['@_code'] !== 'a') continue;
          const value = this.xmlText(subfield);
          const category = value ? controlledCategories.get(value.toLowerCase()) : undefined;
          if (category) categories.add(category);
        }
      }
      if (categories.size > 0) categoriesByBiblioId.set(internalId, [...categories]);
    }

    return categoriesByBiblioId;
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
    if (status === 400) return new KohaIntegrationError('bad-request', 'Koha rejected the request', status);
    if (status === 401) return new KohaIntegrationError('unauthorized', 'Koha authentication failed', status);
    if (status === 403) return new KohaIntegrationError('forbidden', 'Koha denied the request', status);
    if (status === 404) return new KohaIntegrationError('not-found', 'Koha record not found', status);
    if (status === 429) return new KohaIntegrationError('rate-limit', 'Koha rate limit exceeded', status);
    if (typeof status === 'number' && status >= 500) return new KohaIntegrationError('unavailable', 'Koha is unavailable', status);

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
}
