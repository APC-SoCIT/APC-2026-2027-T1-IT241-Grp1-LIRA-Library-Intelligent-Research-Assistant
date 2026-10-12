import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { KohaClient } from '../koha/koha.client';
import { KohaIntegrationError } from '../koha/koha.exceptions';
import { AuthenticatedSupabaseUser } from '../shared/supabase-user.guard';
import { PatronProvisioningService } from './patron-provisioning.service';

@Injectable()
export class PatronListsService {
  private readonly legacyMigrationByPatron = new Map<number, Promise<void>>();

  constructor(
    private readonly koha: KohaClient,
    private readonly provisioning: PatronProvisioningService,
    private readonly config: ConfigService,
  ) {}

  private async patronContext(user: AuthenticatedSupabaseUser): Promise<{ patronId: number; path: string }> {
    const { patronId } = await this.provisioning.ensurePatron(user);
    await this.migrateLegacyLists(user, patronId);
    return { patronId, path: `/patrons/${encodeURIComponent(patronId)}` };
  }

  private async requestKohaLists<T>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, data?: Record<string, unknown>): Promise<T> {
    try {
      return await this.koha.requestLiraLists<T>(method, path, data);
    } catch (error: unknown) {
      if (error instanceof KohaIntegrationError) {
        throw new ServiceUnavailableException(`Koha reading lists: ${error.message}`);
      }
      throw error;
    }
  }

  private async migrateLegacyLists(user: AuthenticatedSupabaseUser, patronId: number): Promise<void> {
    if (this.legacyMigrationByPatron.has(patronId)) return this.legacyMigrationByPatron.get(patronId);
    const migration = this.performLegacyMigration(user, patronId).finally(() => this.legacyMigrationByPatron.delete(patronId));
    this.legacyMigrationByPatron.set(patronId, migration);
    return migration;
  }

  private async performLegacyMigration(user: AuthenticatedSupabaseUser, patronId: number): Promise<void> {
    const supabaseUrl = this.config.get<string>('app.semantic.supabaseUrl', '');
    const serviceKey = this.config.get<string>('app.semantic.supabaseServiceRoleKey', '');
    if (!supabaseUrl || !serviceKey) return;
    const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' };
    const profileUrl = `${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=koha_lists_migrated_at`;
    const profileResponse = await fetch(profileUrl, { headers });
    if (!profileResponse.ok) {
      const detail = await profileResponse.text();
      if (/koha_lists_migrated_at|42703|PGRST204/i.test(detail)) {
        throw new ServiceUnavailableException('Run supabase/migrations/202610130002_koha_lists_migration_marker.sql in Supabase before loading reading lists');
      }
      throw new ServiceUnavailableException('Could not check whether your saved lists have been moved to Koha');
    }
    const profileRows = await profileResponse.json() as Array<{ koha_lists_migrated_at?: string | null }>;
    if (profileRows[0]?.koha_lists_migrated_at) return;

    const [legacyListsResponse, legacyBookmarksResponse] = await Promise.all([
      fetch(`${supabaseUrl}/rest/v1/reading_lists?user_id=eq.${encodeURIComponent(user.id)}&select=id,name&order=created_at.asc`, { headers }),
      fetch(`${supabaseUrl}/rest/v1/bookmarks?user_id=eq.${encodeURIComponent(user.id)}&select=list_id,book_id&order=created_at.asc`, { headers }),
    ]);
    let legacyLists: Array<{ id: number; name: string }>;
    let legacyBookmarks: Array<{ list_id: number; book_id: number }>;
    if (!legacyListsResponse.ok || !legacyBookmarksResponse.ok) {
      const [listsError, bookmarksError] = await Promise.all([
        legacyListsResponse.clone().text(),
        legacyBookmarksResponse.clone().text(),
      ]);
      const bothTablesRemoved = !legacyListsResponse.ok && !legacyBookmarksResponse.ok
        && /PGRST205|42P01|could not find the table|relation .* does not exist/i.test(listsError)
        && /PGRST205|42P01|could not find the table|relation .* does not exist/i.test(bookmarksError);
      if (!bothTablesRemoved) {
        throw new ServiceUnavailableException('Could not load your existing saved lists for transfer');
      }
      legacyLists = [];
      legacyBookmarks = [];
    } else {
      [legacyLists, legacyBookmarks] = await Promise.all([
        legacyListsResponse.json() as Promise<Array<{ id: number; name: string }>>,
        legacyBookmarksResponse.json() as Promise<Array<{ list_id: number; book_id: number }>>,
      ]);
    }
    const path = `/patrons/${encodeURIComponent(patronId)}`;
    const kohaLists = await this.requestKohaLists<Array<{ id: number; name: string }>>('GET', `${path}/lists`);
    const listIds = new Map<number, number>();
    for (const oldList of legacyLists) {
      let destination = kohaLists.find((list) => list.name.toLocaleLowerCase() === oldList.name.toLocaleLowerCase());
      if (!destination) {
        destination = await this.requestKohaLists<{ id: number; name: string }>('POST', `${path}/lists`, { name: oldList.name });
        kohaLists.push(destination);
      }
      listIds.set(oldList.id, destination.id);
    }
    for (const oldBookmark of legacyBookmarks) {
      const listId = listIds.get(oldBookmark.list_id);
      if (!listId || !Number.isSafeInteger(Number(oldBookmark.book_id)) || Number(oldBookmark.book_id) < 1) continue;
      await this.requestKohaLists('PUT', `${path}/lists/${listId}/items/${Number(oldBookmark.book_id)}`);
    }

    const markerResponse = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}`, {
      method: 'PATCH', headers: { ...headers, Prefer: 'return=minimal' },
      body: JSON.stringify({ koha_lists_migrated_at: new Date().toISOString() }),
    });
    if (!markerResponse.ok) throw new ServiceUnavailableException('Your lists were copied, but LIRA could not record the migration status');
  }

  async listLists(user: AuthenticatedSupabaseUser) {
    const { path } = await this.patronContext(user);
    return this.requestKohaLists('GET', `${path}/lists`);
  }

  async createList(user: AuthenticatedSupabaseUser, name: string) {
    const { path } = await this.patronContext(user);
    return this.requestKohaLists('POST', `${path}/lists`, { name });
  }

  async renameList(user: AuthenticatedSupabaseUser, listId: number, name: string) {
    const { path } = await this.patronContext(user);
    return this.requestKohaLists('PUT', `${path}/lists/${listId}`, { name });
  }

  async deleteList(user: AuthenticatedSupabaseUser, listId: number) {
    const { path } = await this.patronContext(user);
    return this.requestKohaLists('DELETE', `${path}/lists/${listId}`);
  }

  async listBookmarks(user: AuthenticatedSupabaseUser) {
    const { path } = await this.patronContext(user);
    return this.requestKohaLists('GET', `${path}/bookmarks`);
  }

  async saveBookmark(user: AuthenticatedSupabaseUser, listId: number, biblioId: number) {
    const { path } = await this.patronContext(user);
    return this.requestKohaLists('PUT', `${path}/lists/${listId}/items/${biblioId}`);
  }

  async moveBookmark(user: AuthenticatedSupabaseUser, biblioId: number, listId: number) {
    const { path } = await this.patronContext(user);
    return this.requestKohaLists('PUT', `${path}/bookmarks/${biblioId}`, { list_id: listId });
  }

  async removeBookmark(user: AuthenticatedSupabaseUser, biblioId: number) {
    const { path: patronPath } = await this.patronContext(user);
    const lists = await this.requestKohaLists<Array<{ id: number }>>('GET', `${patronPath}/lists`);
    await Promise.all(lists.map((list) => this.requestKohaLists(
      'DELETE', `${patronPath}/lists/${list.id}/items/${biblioId}`,
    )));
  }
}
