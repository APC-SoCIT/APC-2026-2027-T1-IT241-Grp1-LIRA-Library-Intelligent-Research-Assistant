import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { AuthenticatedSupabaseUser, getAuthenticatedSupabaseUser } from '../shared/supabase-user';

export type ChatHistoryRequest = Request & { chatUser: AuthenticatedSupabaseUser };

@Injectable()
export class ChatHistoryGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<ChatHistoryRequest>();
    request.chatUser = await getAuthenticatedSupabaseUser(this.config, request.headers.authorization);
    return true;
  }
}
