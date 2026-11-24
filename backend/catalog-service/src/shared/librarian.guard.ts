import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { AuthenticatedSupabaseUser, getAuthenticatedSupabaseUser } from './supabase-user';

export type LibrarianRequest = Request & { librarianUser: AuthenticatedSupabaseUser };

@Injectable()
export class LibrarianGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<LibrarianRequest>();
    const user = await getAuthenticatedSupabaseUser(this.config, request.headers.authorization);
    const role = await this.getProfileRole(user.id);
    if (role !== 'librarian') throw new ForbiddenException('Librarian access is required');
    request.librarianUser = user;
    return true;
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
