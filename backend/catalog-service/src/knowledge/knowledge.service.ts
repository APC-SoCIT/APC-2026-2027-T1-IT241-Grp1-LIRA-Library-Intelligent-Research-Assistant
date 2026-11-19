import { ConflictException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { KnowledgeUpdateDto, KnowledgeWriteDto } from './knowledge.dto';

interface KnowledgeRow {
  id: string;
  kind: KnowledgeWriteDto['kind'];
  category: KnowledgeWriteDto['category'];
  title: string;
  content: string;
  source_url: string | null;
  created_at: string;
  updated_at: string;
}

const columns = 'id,kind,category,title,content,source_url,created_at,updated_at';

@Injectable()
export class KnowledgeService {
  constructor(private readonly config: ConfigService) {}

  async list(page: number, limit: number) {
    const params = new URLSearchParams({ select: columns, order: 'updated_at.desc,id.asc',
      offset: String((page - 1) * limit), limit: String(limit) });
    const rows = await this.request(params);
    return { items: rows.map((row) => this.toEntry(row)), pagination: { page, limit } };
  }

  async create(input: KnowledgeWriteDto, userId: string) {
    const rows = await this.request(new URLSearchParams({ select: columns }), {
      method: 'POST', body: JSON.stringify({ ...this.toRow(input), created_by: userId, updated_by: userId }),
    });
    if (!rows[0]) throw new ServiceUnavailableException('The knowledge entry could not be saved.');
    return this.toEntry(rows[0]);
  }

  async update(id: string, input: KnowledgeUpdateDto, userId: string) {
    const params = new URLSearchParams({ id: `eq.${id}`, updated_at: `eq.${input.expectedUpdatedAt}`, select: columns });
    const rows = await this.request(params, {
      method: 'PATCH', body: JSON.stringify({ ...this.toRow(input), updated_by: userId }),
    });
    if (!rows[0]) {
      const existing = await this.request(new URLSearchParams({ id: `eq.${id}`, select: columns, limit: '1' }));
      if (!existing[0]) throw new NotFoundException('This knowledge entry no longer exists.');
      throw new ConflictException('Another librarian changed this entry. Reload the saved entry before editing again.');
    }
    return this.toEntry(rows[0]);
  }

  private toRow(input: KnowledgeWriteDto) {
    return { kind: input.kind, category: input.category, title: input.title,
      content: input.content, source_url: input.sourceUrl ?? null };
  }

  private toEntry(row: KnowledgeRow) {
    return { id: row.id, kind: row.kind, category: row.category, title: row.title,
      content: row.content, sourceUrl: row.source_url, createdAt: row.created_at, updatedAt: row.updated_at };
  }

  private async request(params: URLSearchParams, options: RequestInit = {}): Promise<KnowledgeRow[]> {
    const url = this.config.get<string>('app.semantic.supabaseUrl', '');
    const key = this.config.get<string>('app.semantic.supabaseServiceRoleKey', '');
    if (!url || !key) throw new ServiceUnavailableException('Knowledge storage is not configured.');
    try {
      const response = await fetch(`${url}/rest/v1/librarian_knowledge_entries?${params}`, {
        ...options,
        signal: AbortSignal.timeout(15000),
        headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json',
          'Accept-Profile': 'public', 'Content-Profile': 'public', Prefer: 'return=representation' },
      });
      if (!response.ok) throw new Error('Storage request failed');
      const rows: unknown = await response.json();
      if (!Array.isArray(rows)) throw new Error('Invalid storage response');
      return rows as KnowledgeRow[];
    } catch {
      throw new ServiceUnavailableException('Knowledge storage is unavailable. Check the connection and required database migrations, then try again.');
    }
  }
}
