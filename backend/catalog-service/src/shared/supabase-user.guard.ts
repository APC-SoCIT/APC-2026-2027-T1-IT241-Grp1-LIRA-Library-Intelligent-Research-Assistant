import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

export interface AuthenticatedSupabaseUser { id: string; email?: string; user_metadata?: Record<string, unknown> }

@Injectable()
export class SupabaseUserGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { supabaseUser?: AuthenticatedSupabaseUser }>();
    const token = request.headers.authorization?.startsWith('Bearer ')
      ? request.headers.authorization.slice(7).trim() : '';
    if (!token) throw new UnauthorizedException('A signed-in account is required');

    const url = this.config.get<string>('app.semantic.supabaseUrl', '');
    const serviceRoleKey = this.config.get<string>('app.semantic.supabaseServiceRoleKey', '');
    if (!url || !serviceRoleKey) throw new UnauthorizedException('Supabase authentication is not configured');
    const response = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: serviceRoleKey, Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new UnauthorizedException('Your session is invalid or expired');
    const user = await response.json() as AuthenticatedSupabaseUser;
    if (!user.id || !user.email) throw new UnauthorizedException('Your account has no email address');
    request.supabaseUser = user;
    return true;
  }
}
