import { Logger, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface AuthenticatedSupabaseUser {
  id: string;
}

const logger = new Logger('SupabaseUser');

export async function getAuthenticatedSupabaseUser(
  config: ConfigService,
  authorization: string | undefined,
): Promise<AuthenticatedSupabaseUser> {
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!token) throw new UnauthorizedException('A signed-in account is required');

  const url = config.get<string>('app.semantic.supabaseUrl', '');
  const serviceRoleKey = config.get<string>('app.semantic.supabaseServiceRoleKey', '');
  if (!url || !serviceRoleKey) throw new ServiceUnavailableException('Supabase authentication is not configured');

  let response: Response;
  try {
    response = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: serviceRoleKey, Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    logger.error('Supabase authentication request failed');
    throw new ServiceUnavailableException('Supabase authentication is unavailable');
  }

  if (!response.ok) throw new UnauthorizedException('Your session is invalid or expired');
  let user: Partial<AuthenticatedSupabaseUser>;
  try {
    user = await response.json() as Partial<AuthenticatedSupabaseUser>;
  } catch {
    logger.error('Supabase authentication returned an invalid response');
    throw new ServiceUnavailableException('Supabase authentication returned an invalid response');
  }
  if (typeof user.id !== 'string' || !user.id) {
    throw new UnauthorizedException('Your session did not identify a user');
  }
  return { id: user.id };
}
