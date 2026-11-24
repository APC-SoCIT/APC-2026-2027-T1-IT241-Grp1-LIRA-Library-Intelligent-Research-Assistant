import {
  ConflictException, Injectable, Logger, NotFoundException, ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, createHmac, randomBytes, randomUUID } from 'node:crypto';
import { ChatConversationMessageDto } from './dto/chat-history.dto';

interface EncryptedValue {
  ciphertext: string;
  iv: string;
  tag: string;
}

interface ChatSessionRow {
  id: string;
  user_id: string;
  encrypted_title: string;
  title_iv: string;
  title_tag: string;
  created_at: string;
  updated_at: string;
  expires_at: string;
}

interface ChatMessageRow {
  id: string;
  session_id: string;
  user_id: string;
  role: 'user' | 'assistant';
  encrypted_payload: string;
  payload_iv: string;
  payload_tag: string;
  created_at: string;
}

interface ChatPreferenceRow {
  user_id: string;
  save_history: boolean;
}

export interface DecryptedMessage extends ChatConversationMessageDto {
  createdAt: string;
  id: string;
}

@Injectable()
export class ChatHistoryService {
  private readonly logger = new Logger(ChatHistoryService.name);

  constructor(private readonly config: ConfigService) {}

  async getPreference(userId: string): Promise<{ saveHistory: boolean }> {
    const rows = await this.rest<ChatPreferenceRow>('chat_preferences', {
      select: 'save_history',
      user_id: `eq.${userId}`,
      limit: '1',
    });
    return { saveHistory: rows[0]?.save_history ?? true };
  }

  async setPreference(userId: string, saveHistory: boolean): Promise<{ saveHistory: boolean }> {
    const rows = await this.rest<ChatPreferenceRow>('chat_preferences', {
      on_conflict: 'user_id',
      select: 'save_history',
    }, 'POST', { user_id: userId, save_history: saveHistory }, 'resolution=merge-duplicates,return=representation');
    if (!rows[0]) throw new ServiceUnavailableException('Could not update chat privacy settings');
    return { saveHistory: rows[0].save_history };
  }

  async createSession(userId: string, title: string) {
    await this.ensureHistoryEnabled(userId);
    const id = randomUUID();
    const encryptedTitle = this.encrypt(userId, id, title);
    const rows = await this.rest<ChatSessionRow>('chat_sessions', { select: '*' }, 'POST', {
      id,
      user_id: userId,
      encrypted_title: encryptedTitle.ciphertext,
      title_iv: encryptedTitle.iv,
      title_tag: encryptedTitle.tag,
    }, 'return=representation');
    if (!rows[0]) throw new ServiceUnavailableException('Could not create chat conversation');
    return this.sessionSummary(rows[0], title);
  }

  async listSessions(userId: string) {
    const rows = await this.rest<ChatSessionRow>('chat_sessions', {
      select: '*',
      user_id: `eq.${userId}`,
      expires_at: `gt.${new Date().toISOString()}`,
      order: 'updated_at.desc',
    });
    return rows.map((row) => this.sessionSummary(row, this.decryptTitle(row, userId)));
  }

  async renameSession(userId: string, sessionId: string, title: string) {
    const encryptedTitle = this.encrypt(userId, sessionId, title);
    const rows = await this.rest<ChatSessionRow>('chat_sessions', {
      select: '*',
      id: `eq.${sessionId}`,
      user_id: `eq.${userId}`,
      expires_at: `gt.${new Date().toISOString()}`,
    }, 'PATCH', {
      encrypted_title: encryptedTitle.ciphertext,
      title_iv: encryptedTitle.iv,
      title_tag: encryptedTitle.tag,
      updated_at: new Date().toISOString(),
    }, 'return=representation');
    if (!rows[0]) throw new NotFoundException('Conversation not found');
    return this.sessionSummary(rows[0], title);
  }

  async getSession(userId: string, sessionId: string) {
    const session = await this.findSession(userId, sessionId);
    const rows = await this.rest<ChatMessageRow>('chat_messages', {
      select: '*',
      user_id: `eq.${userId}`,
      session_id: `eq.${sessionId}`,
      order: 'created_at.asc',
    });
    const messages = rows.map((row) => this.decryptMessage(row));
    return {
      session: this.sessionSummary(session, this.decryptTitle(session, userId)),
      messages,
    };
  }

  async addMessage(userId: string, sessionId: string, message: ChatConversationMessageDto) {
    await this.ensureHistoryEnabled(userId);
    await this.findSession(userId, sessionId);
    const encrypted = this.encrypt(userId, sessionId, JSON.stringify({
      role: message.role,
      content: message.content,
      ...(message.citation ? { citation: message.citation } : {}),
      ...(message.matchedKnowledge ? { matchedKnowledge: message.matchedKnowledge } : {}),
    }));
    const rows = await this.rest<ChatMessageRow>('chat_messages', { select: '*' }, 'POST', {
      session_id: sessionId,
      user_id: userId,
      role: message.role,
      encrypted_payload: encrypted.ciphertext,
      payload_iv: encrypted.iv,
      payload_tag: encrypted.tag,
    }, 'return=representation');
    if (!rows[0]) throw new ServiceUnavailableException('Could not save chat message');
    return this.decryptMessage(rows[0]);
  }

  async deleteSession(userId: string, sessionId: string): Promise<void> {
    const rows = await this.rest<Pick<ChatSessionRow, 'id'>>('chat_sessions', {
      user_id: `eq.${userId}`,
      id: `eq.${sessionId}`,
    }, 'DELETE', undefined, 'return=representation');
    if (rows.length === 0) throw new NotFoundException('Conversation not found');
  }

  async deleteAllSessions(userId: string): Promise<{ deleted: number }> {
    const rows = await this.rest<Pick<ChatSessionRow, 'id'>>('chat_sessions', {
      user_id: `eq.${userId}`,
      select: 'id',
    }, 'DELETE', undefined, 'return=representation');
    return { deleted: rows.length };
  }

  private async findSession(userId: string, sessionId: string): Promise<ChatSessionRow> {
    const rows = await this.rest<ChatSessionRow>('chat_sessions', {
      select: '*',
      id: `eq.${sessionId}`,
      user_id: `eq.${userId}`,
      expires_at: `gt.${new Date().toISOString()}`,
      limit: '1',
    });
    if (!rows[0]) throw new NotFoundException('Conversation not found');
    return rows[0];
  }

  private async ensureHistoryEnabled(userId: string): Promise<void> {
    const preference = await this.getPreference(userId);
    if (!preference.saveHistory) throw new ConflictException('Conversation saving is disabled for this account');
  }

  private sessionSummary(row: ChatSessionRow, title: string) {
    return {
      id: row.id,
      title,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      expiresAt: row.expires_at,
    };
  }

  private decryptTitle(row: ChatSessionRow, userId: string): string {
    return this.decrypt(userId, row.id, {
      ciphertext: row.encrypted_title,
      iv: row.title_iv,
      tag: row.title_tag,
    });
  }

  private decryptMessage(row: ChatMessageRow): DecryptedMessage {
    let payload: Partial<ChatConversationMessageDto>;
    try {
      payload = JSON.parse(this.decrypt(row.user_id, row.session_id, {
        ciphertext: row.encrypted_payload,
        iv: row.payload_iv,
        tag: row.payload_tag,
      })) as Partial<ChatConversationMessageDto>;
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      this.logger.error('Encrypted chat message payload is invalid');
      throw new ServiceUnavailableException('Stored chat conversation could not be decrypted');
    }
    if (payload.role !== row.role || typeof payload.content !== 'string') {
      this.logger.error('Encrypted chat message payload failed integrity validation');
      throw new ServiceUnavailableException('Stored chat conversation could not be decrypted');
    }
    return { ...payload as ChatConversationMessageDto, id: row.id, createdAt: row.created_at };
  }

  private encrypt(userId: string, sessionId: string, value: string): EncryptedValue {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.conversationKey(userId, sessionId), iv);
    const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return {
      ciphertext: ciphertext.toString('base64'),
      iv: iv.toString('base64'),
      tag: cipher.getAuthTag().toString('base64'),
    };
  }

  private decrypt(userId: string, sessionId: string, value: EncryptedValue): string {
    const key = this.conversationKey(userId, sessionId);
    try {
      const decipher = createDecipheriv(
        'aes-256-gcm',
        key,
        Buffer.from(value.iv, 'base64'),
      );
      decipher.setAuthTag(Buffer.from(value.tag, 'base64'));
      return Buffer.concat([
        decipher.update(Buffer.from(value.ciphertext, 'base64')),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      this.logger.error('Encrypted chat history authentication failed');
      throw new ServiceUnavailableException('Stored chat conversation could not be decrypted');
    }
  }

  private conversationKey(userId: string, sessionId: string): Buffer {
    const configuredKey = this.config.get<string>('app.chatHistory.encryptionKey', '');
    let masterKey: Buffer;
    try {
      masterKey = Buffer.from(configuredKey, 'base64');
    } catch {
      throw new ServiceUnavailableException('Chat history encryption is not configured');
    }
    if (!configuredKey || masterKey.length !== 32 || masterKey.toString('base64') !== configuredKey) {
      throw new ServiceUnavailableException('Chat history encryption is not configured');
    }
    return createHmac('sha256', masterKey)
      .update(`lira-chat-history-v1\0${userId}\0${sessionId}`)
      .digest();
  }

  private async rest<T>(
    table: string,
    params: Record<string, string>,
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET',
    body?: Record<string, unknown>,
    prefer?: string,
  ): Promise<T[]> {
    const baseUrl = this.config.get<string>('app.semantic.supabaseUrl', '');
    const serviceRoleKey = this.config.get<string>('app.semantic.supabaseServiceRoleKey', '');
    if (!baseUrl || !serviceRoleKey) {
      throw new ServiceUnavailableException('Chat history storage is not configured');
    }
    const query = new URLSearchParams(params);
    let response: Response;
    try {
      response = await fetch(`${baseUrl}/rest/v1/${table}?${query.toString()}`, {
        method,
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json',
          ...(prefer ? { Prefer: prefer } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(10000),
      });
    } catch {
      this.logger.error('Chat history storage request failed');
      throw new ServiceUnavailableException('Chat history storage is unavailable');
    }
    if (!response.ok) {
      this.logger.error(`Chat history storage returned HTTP ${response.status}`);
      throw new ServiceUnavailableException('Chat history storage request failed');
    }
    if (response.status === 204) return [];
    try {
      const responseBody = await response.text();
      return responseBody ? JSON.parse(responseBody) as T[] : [];
    } catch {
      this.logger.error('Chat history storage returned an invalid response');
      throw new ServiceUnavailableException('Chat history storage returned an invalid response');
    }
  }
}
