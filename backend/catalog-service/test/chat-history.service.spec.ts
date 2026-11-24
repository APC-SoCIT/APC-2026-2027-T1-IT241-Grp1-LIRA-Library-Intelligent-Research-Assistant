import { ConflictException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatHistoryService } from '../src/chatbot/chat-history.service';

describe('Encrypted chat history storage', () => {
  const ownerId = '8f7abcf2-04f0-4ab1-a32a-e98a25cf5b5b';
  const otherUserId = '39604179-4a81-4abc-9e01-524829946125';
  const key = Buffer.alloc(32, 7).toString('base64');
  let service: ChatHistoryService;
  let fetchSpy: jest.SpyInstance;
  let sessions: Array<Record<string, unknown>>;
  let messages: Array<Record<string, unknown>>;
  let preferences: Array<Record<string, unknown>>;

  beforeEach(() => {
    sessions = [];
    messages = [];
    preferences = [];
    const config = {
      get: (name: string, fallback: string) => ({
        'app.semantic.supabaseUrl': 'https://supabase.example.test',
        'app.semantic.supabaseServiceRoleKey': 'service-role-test-key',
        'app.chatHistory.encryptionKey': key,
      }[name] ?? fallback),
    } as ConfigService;
    service = new ChatHistoryService(config);
    fetchSpy = jest.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = new URL(String(input));
      const table = url.pathname.split('/').at(-1);
      const method = init?.method ?? 'GET';
      const userFilter = url.searchParams.get('user_id')?.replace('eq.', '');
      const sessionFilter = url.searchParams.get('session_id')?.replace('eq.', '');
      const idFilter = url.searchParams.get('id')?.replace('eq.', '');
      let result: Array<Record<string, unknown>> = [];

      if (table === 'chat_preferences' && method === 'GET') {
        result = preferences.filter((row) => row.user_id === userFilter);
      } else if (table === 'chat_preferences' && method === 'POST') {
        const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
        const existing = preferences.find((row) => row.user_id === body.user_id);
        if (existing) Object.assign(existing, body);
        else preferences.push(body);
        result = [existing ?? body];
      } else if (table === 'chat_sessions' && method === 'POST') {
        const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
        const now = new Date().toISOString();
        const row = {
          ...body,
          created_at: now,
          updated_at: now,
          expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        };
        sessions.push(row);
        result = [row];
      } else if (table === 'chat_sessions' && method === 'GET') {
        result = sessions.filter((row) => row.user_id === userFilter && (!idFilter || row.id === idFilter));
      } else if (table === 'chat_sessions' && method === 'PATCH') {
        const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
        result = sessions.filter((row) => row.user_id === userFilter && row.id === idFilter);
        result.forEach((row) => Object.assign(row, body));
      } else if (table === 'chat_sessions' && method === 'DELETE') {
        result = sessions.filter((row) => row.user_id === userFilter && (!idFilter || row.id === idFilter));
        sessions = sessions.filter((row) => !result.includes(row));
        messages = messages.filter((row) => !result.some((session) => session.id === row.session_id));
      } else if (table === 'chat_messages' && method === 'POST') {
        const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
        const row = { ...body, id: `message-${messages.length + 1}`, created_at: new Date().toISOString() };
        messages.push(row);
        result = [row];
      } else if (table === 'chat_messages' && method === 'GET') {
        result = messages.filter((row) => row.user_id === userFilter && row.session_id === sessionFilter);
      } else {
        throw new Error(`Unexpected storage request: ${method} ${table}`);
      }
      return response(200, result);
    });
  });

  afterEach(() => fetchSpy.mockRestore());

  it('encrypts titles and message content while round-tripping citations and sources', async () => {
    const title = 'Research question about a private topic';
    const session = await service.createSession(ownerId, title);
    const citation = {
      style: 'APA 7',
      text: 'Author (2024). Book. https://example.test/book',
      title: 'Book',
      url: 'https://example.test/book',
      missingFields: [],
    };
    const source = {
      id: 'entry-1',
      kind: 'policy' as const,
      category: 'rules' as const,
      title: 'Library policy',
      sourceUrl: 'https://example.test/policy',
    };
    const message = {
      role: 'assistant' as const,
      content: 'A private assistant response',
      citation,
      matchedKnowledge: [source],
    };

    await service.addMessage(ownerId, session.id, message);
    const stored = JSON.stringify({ sessions, messages });
    expect(stored).not.toContain(title);
    expect(stored).not.toContain(message.content);
    expect(stored).not.toContain(citation.text);

    await expect(service.getSession(ownerId, session.id)).resolves.toMatchObject({
      session: { id: session.id, title },
      messages: [{ ...message, id: 'message-1' }],
    });
  });

  it('does not expose another account’s conversation', async () => {
    const session = await service.createSession(ownerId, 'Private chat');
    await expect(service.getSession(otherUserId, session.id)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('renames an owner-scoped conversation while keeping its title encrypted', async () => {
    const session = await service.createSession(ownerId, 'Old title');

    await expect(service.renameSession(ownerId, session.id, 'New title')).resolves.toMatchObject({
      id: session.id,
      title: 'New title',
    });

    expect(JSON.stringify(sessions)).not.toContain('New title');
    await expect(service.listSessions(ownerId)).resolves.toMatchObject([
      { id: session.id, title: 'New title' },
    ]);
    const renameCall = fetchSpy.mock.calls.find(([, options]) => options?.method === 'PATCH');
    expect(renameCall).toBeDefined();
    expect(new URL(String(renameCall?.[0])).searchParams.get('user_id')).toBe(`eq.${ownerId}`);
    expect(new URL(String(renameCall?.[0])).searchParams.get('id')).toBe(`eq.${session.id}`);
  });

  it('deletes only the selected owner’s conversation and its messages', async () => {
    const session = await service.createSession(ownerId, 'Delete me');
    await service.addMessage(ownerId, session.id, { role: 'user', content: 'Private message' });

    await service.deleteSession(ownerId, session.id);

    expect(sessions).toHaveLength(0);
    expect(messages).toHaveLength(0);
    const deletion = fetchSpy.mock.calls.find(([, options]) => options?.method === 'DELETE');
    expect(deletion).toBeDefined();
    expect(new URL(String(deletion?.[0])).searchParams.get('user_id')).toBe(`eq.${ownerId}`);
    await expect(service.getSession(ownerId, session.id)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects altered ciphertext instead of returning modified chat content', async () => {
    const session = await service.createSession(ownerId, 'Integrity check');
    await service.addMessage(ownerId, session.id, { role: 'user', content: 'Original message' });
    const ciphertext = Buffer.from(String(messages[0].encrypted_payload), 'base64');
    ciphertext[0] ^= 1;
    messages[0].encrypted_payload = ciphertext.toString('base64');

    await expect(service.getSession(ownerId, session.id)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('defaults to saving but blocks server-side writes when privacy mode is enabled', async () => {
    await expect(service.getPreference(ownerId)).resolves.toEqual({ saveHistory: true });
    await service.setPreference(ownerId, false);

    await expect(service.createSession(ownerId, 'Must not persist')).rejects.toBeInstanceOf(ConflictException);
    expect(sessions).toHaveLength(0);
  });

  function response(status: number, body: unknown): Response {
    return {
      ok: status >= 200 && status < 300,
      status,
      text: async () => JSON.stringify(body),
    } as Response;
  }
});
