import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

interface SupabaseUser { id: string }
export type LibrarianRequest = Request & { librarianUser: SupabaseUser };

@Injectable()
export class LibrarianGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<LibrarianRequest>();
    const authorization = request.headers.authorization;
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
    if (!token) throw new UnauthorizedException('A signed-in librarian account is required');

    const user = await this.getSupabaseUser(token);
    const role = await this.getProfileRole(user.id);
    if (role !== 'librarian') throw new ForbiddenException('Librarian access is required');
    request.librarianUser = user;
    return true;
  }

  private async getSupabaseUser(token: string): Promise<SupabaseUser> {
    const url = this.config.get<string>('app.semantic.supabaseUrl', '');
    const serviceRoleKey = this.config.get<string>('app.semantic.supabaseServiceRoleKey', '');
    if (!url || !serviceRoleKey) throw new UnauthorizedException('Supabase authentication is not configured');
    const response = await fetch(`${url}/auth/v1/user`, { headers: { apikey: serviceRoleKey, Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new UnauthorizedException('Your session is invalid or expired');
    const user = await response.json() as Partial<SupabaseUser>;
    if (!user.id) throw new UnauthorizedException('Your session did not identify a user');
    return { id: user.id };
  }

  private async getProfileRole(userId: string): Promise<string | null> {
    const url = this.config.get<string>('app.semantic.supabaseUrl', '');
    const serviceRoleKey = this.config.get<string>('app.semantic.supabaseServiceRoleKey', '');
    const response = await fetch(`${url}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=role`, {
      headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, 'Accept-Profile': 'public' },
    });
    if (!response.ok) throw new UnauthorizedException('Could not verify librarian permissions');
    const profiles = await response.json() as Array<{ role?: string | null }>;
    return profiles[0]?.role ?? null;
  }
}
