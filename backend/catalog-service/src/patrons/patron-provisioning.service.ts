import { Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { KohaClient } from '../koha/koha.client';
import { AuthenticatedSupabaseUser } from '../shared/supabase-user.guard';

interface StudentProfile {
  first_name?: string | null;
  middle_initial?: string | null;
  last_name?: string | null;
  suffix?: string | null;
  full_name?: string | null;
  school?: string | null;
  role?: string | null;
  koha_patron_id?: number | null;
}

@Injectable()
export class PatronProvisioningService {
  constructor(private readonly koha: KohaClient, private readonly config: ConfigService) {}

  async ensurePatron(user: AuthenticatedSupabaseUser): Promise<{ patronId: number; created: boolean }> {
    const url = this.config.get<string>('app.semantic.supabaseUrl', '');
    const key = this.config.get<string>('app.semantic.supabaseServiceRoleKey', '');
    if (!url || !key || !user.email) throw new UnauthorizedException('Account provisioning is not configured');
    const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
    const profileResponse = await fetch(`${url}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=*`, { headers });
    if (!profileResponse.ok) throw new ServiceUnavailableException('Could not load your LIRA profile');
    const profiles = await profileResponse.json() as StudentProfile[];
    const profile = profiles[0];
    if (!profile) throw new ServiceUnavailableException('Your LIRA profile has not been created yet');
    const role = profile.role || 'student';
    if (role !== 'student' && role !== 'librarian') {
      throw new UnauthorizedException('Only student and librarian accounts can be provisioned as Koha patrons');
    }
    if (profile.koha_patron_id && Number.isInteger(Number(profile.koha_patron_id))) {
      return { patronId: Number(profile.koha_patron_id), created: false };
    }

    const metadata = user.user_metadata ?? {};
    const fullName = String(profile.full_name || metadata.full_name || '').trim();
    const nameParts = fullName.split(/\s+/).filter(Boolean);
    const firstName = String(profile.first_name || metadata.first_name || nameParts[0] || '').trim();
    const surname = String(profile.last_name || metadata.last_name || (nameParts.length > 1 ? nameParts.slice(1).join(' ') : '')).trim();
    if (!firstName || !surname) throw new ServiceUnavailableException('Add your first and last name to your LIRA profile before linking Koha');

    const cardnumber = `LIRA${user.id.replace(/-/g, '').slice(0, 28)}`;
    const existing = await this.koha.findPatronByCardnumber(cardnumber);
    const categoryId = role === 'librarian'
      ? this.config.get<string>('app.koha.librarianPatronCategoryId', '')
      : this.config.get<string>('app.koha.patronCategoryId', 'ST');
    if (!existing && !categoryId) throw new ServiceUnavailableException('Set KOHA_LIBRARIAN_CATEGORY_ID to the Koha category for librarian patron accounts');
    const patron = existing ?? await this.koha.createPatron({
      cardnumber,
      userid: `lira-${user.id.replace(/-/g, '')}`,
      firstname: firstName,
      surname,
      email: user.email,
      category_id: categoryId,
      library_id: this.config.get<string>('app.koha.patronLibraryId', 'APC'),
      ...(profile.middle_initial || metadata.middle_initial ? { initials: String(profile.middle_initial || metadata.middle_initial).trim() } : {}),
      ...(profile.suffix || metadata.suffix ? { other_name: String(profile.suffix || metadata.suffix).trim() } : {}),
    });
    const rawId = patron.patron_id ?? patron.borrowernumber;
    const patronId = Number(rawId);
    if (!Number.isSafeInteger(patronId) || patronId < 1) throw new ServiceUnavailableException('Koha did not return a valid patron ID');

    const update = await fetch(`${url}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}`, {
      method: 'PATCH', headers: { ...headers, Prefer: 'return=minimal' },
      body: JSON.stringify({ koha_patron_id: patronId, updated_at: new Date().toISOString() }),
    });
    if (!update.ok) throw new ServiceUnavailableException('Koha patron was created, but LIRA could not save the link; contact a librarian before retrying');
    return { patronId, created: !existing };
  }
}
