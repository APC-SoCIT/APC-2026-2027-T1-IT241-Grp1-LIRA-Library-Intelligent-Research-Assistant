import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AxiosError, AxiosRequestConfig } from 'axios';
import { firstValueFrom } from 'rxjs';
import { KohaIntegrationError } from './koha.exceptions';
import { KohaBiblio, KohaBiblioResponse } from './koha.types';

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
    const response = await this.request<KohaBiblioResponse>('/api/v1/biblios', {
      params: { _page: page, _per_page: limit },
    });
    return this.extractBiblios(response.data);
  }

  async getBiblio(id: number): Promise<KohaBiblio> {
    const response = await this.request<KohaBiblio>(`/api/v1/biblios/${id}`);
    if (!this.isRecord(response.data) || (!this.hasNumber(response.data, 'biblio_id') && !this.hasNumber(response.data, 'id'))) {
      throw new KohaIntegrationError('unexpected', 'Koha returned an invalid bibliographic record');
    }
    return response.data;
  }

  async searchBiblios(query: string, page: number, limit: number): Promise<KohaBiblio[]> {
    const response = await this.request<KohaBiblioResponse>('/api/v1/biblios', {
      params: { q: JSON.stringify({ 'title|author|isbn': query }), _page: page, _per_page: limit },
    });
    return this.extractBiblios(response.data);
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
