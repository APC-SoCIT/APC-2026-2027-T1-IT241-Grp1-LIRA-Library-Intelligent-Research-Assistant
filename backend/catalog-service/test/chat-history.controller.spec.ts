import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { ChatHistoryController } from '../src/chatbot/chat-history.controller';
import { ChatHistoryGuard } from '../src/chatbot/chat-history.guard';
import { ChatHistoryService } from '../src/chatbot/chat-history.service';

describe('Authenticated chat history API', () => {
  const userId = '8f7abcf2-04f0-4ab1-a32a-e98a25cf5b5b';
  const history = {
    addMessage: jest.fn().mockResolvedValue({ id: 'message-id' }),
    getPreference: jest.fn().mockResolvedValue({ saveHistory: true }),
    listSessions: jest.fn().mockResolvedValue([]),
    renameSession: jest.fn().mockResolvedValue({ title: 'Updated title' }),
  };
  let app: INestApplication;
  let fetchSpy: jest.SpyInstance;

  beforeAll(async () => {
    const config = {
      get: (name: string, fallback: string) => ({
        'app.semantic.supabaseUrl': 'https://supabase.example.test',
        'app.semantic.supabaseServiceRoleKey': 'service-role-test-key',
      }[name] ?? fallback),
    };
    const module = await Test.createTestingModule({
      controllers: [ChatHistoryController],
      providers: [
        ChatHistoryGuard,
        { provide: ConfigService, useValue: config },
        { provide: ChatHistoryService, useValue: history },
      ],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await app.init();
  });

  beforeEach(() => {
    history.getPreference.mockClear();
    history.listSessions.mockClear();
    history.addMessage.mockClear();
    history.renameSession.mockClear();
    fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue(response(200, { id: userId }));
  });

  afterEach(() => fetchSpy.mockRestore());
  afterAll(async () => app.close());

  it('derives the history owner from the verified Supabase session', async () => {
    await request(app.getHttpServer())
      .get('/api/chatbot/conversations')
      .set('Authorization', 'Bearer valid-student-token')
      .expect(200, []);

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://supabase.example.test/auth/v1/user',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer valid-student-token' }) }),
    );
    expect(history.listSessions).toHaveBeenCalledWith(userId);
  });

  it('accepts and preserves chatbot source kind/category metadata', async () => {
    const conversationId = 'c65a394c-0459-4484-ae8c-52233c16beab';
    const message = {
      role: 'assistant',
      content: 'Check the library policy.',
      matchedKnowledge: [{
        id: 'd03f9d4c-9e7b-4e56-9f4f-4bb62aacec39',
        kind: 'policy',
        category: 'rules',
        title: 'Library policy',
        sourceUrl: null,
      }],
    };

    await request(app.getHttpServer())
      .post(`/api/chatbot/conversations/${conversationId}/messages`)
      .set('Authorization', 'Bearer valid-student-token')
      .send(message)
      .expect(201);

    expect(history.addMessage).toHaveBeenCalledWith(userId, conversationId, expect.objectContaining({
      matchedKnowledge: [expect.objectContaining({ kind: 'policy', category: 'rules' })],
    }));
  });

  it('renames a conversation using the verified account owner', async () => {
    const conversationId = 'c65a394c-0459-4484-ae8c-52233c16beab';

    await request(app.getHttpServer())
      .put(`/api/chatbot/conversations/${conversationId}`)
      .set('Authorization', 'Bearer valid-student-token')
      .send({ title: 'Updated title' })
      .expect(200, { title: 'Updated title' });

    expect(history.renameSession).toHaveBeenCalledWith(userId, conversationId, 'Updated title');
  });

  it('rejects missing and invalid sessions before reading history', async () => {
    await request(app.getHttpServer()).get('/api/chatbot/preferences').expect(401);
    expect(fetchSpy).not.toHaveBeenCalled();

    fetchSpy.mockResolvedValueOnce(response(401, {}));
    await request(app.getHttpServer())
      .get('/api/chatbot/preferences')
      .set('Authorization', 'Bearer expired-token')
      .expect(401);
    expect(history.getPreference).not.toHaveBeenCalled();
  });

  function response(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  }
});
