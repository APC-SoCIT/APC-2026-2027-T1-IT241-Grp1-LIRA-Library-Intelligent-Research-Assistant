import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { AuthenticatedSupabaseUser, getAuthenticatedSupabaseUser } from './supabase-user';

export type AuthenticatedUserRequest = Request & { authenticatedUser: AuthenticatedSupabaseUser };

@Injectable()
export class AuthenticatedUserGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedUserRequest>();
    request.authenticatedUser = await getAuthenticatedSupabaseUser(this.config, request.headers.authorization);
    return true;
  }
}
