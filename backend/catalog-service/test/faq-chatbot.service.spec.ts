import { ConfigService } from '@nestjs/config';
import { FaqChatbotService } from '../src/chatbot/faq-chatbot.service';
import { KnowledgeService } from '../src/knowledge/knowledge.service';

describe('FaqChatbotService', () => {
  const config = {
    openRouterApiKey: 'test-openrouter-api-key',
    model: 'openai/gpt-4o-mini',
  };
  const knowledge = { listAllForAssistant: jest.fn() };
  let service: FaqChatbotService;
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    knowledge.listAllForAssistant.mockClear();
    const configService = {
      getOrThrow: jest.fn().mockReturnValue(config),
    } as unknown as ConfigService;
    knowledge.listAllForAssistant.mockResolvedValue([]);
    service = new FaqChatbotService(configService, knowledge as unknown as KnowledgeService);
    fetchSpy = jest.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('retrieves relevant seeded FAQ knowledge and sends it to OpenRouter', async () => {
    knowledge.listAllForAssistant.mockResolvedValue([{
      id: 'fine-policy',
      kind: 'faq',
      category: 'rules',
      title: 'How much is the library fine?',
      content: 'The APC Library has a penalty of Php 20.00 per book, per day for late returns.',
      sourceUrl: 'https://library.apc.edu.ph/faqs',
      createdAt: '2026-11-19T10:00:00.123456+00:00',
      updatedAt: '2026-11-20T10:00:00.123456+00:00',
    }]);
    fetchSpy.mockResolvedValue(response(200, {
      choices: [{ message: { content: 'Late returns are Php 20.00 per book, per day.' } }],
    }));

    const result = await service.answer({
      question: 'How much is a fine for late book returns?',
      language: 'en',
    });

    expect(result.answer).toBe('Late returns are Php 20.00 per book, per day.');
    expect(result.matchedKnowledge.map(({ id }) => id)).toContain('fine-policy');
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://openrouter.ai/api/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: {
          Authorization: 'Bearer test-openrouter-api-key',
          'Content-Type': 'application/json',
        },
      }),
    );
    const request = JSON.parse(String(fetchSpy.mock.calls[0][1].body));
    expect(request.model).toBe('openai/gpt-4o-mini');
    expect(request.max_tokens).toBe(450);
    expect(request.messages[0].content).toContain('Php 20.00 per book, per day');
  });

  it('does not send unrelated librarian entries when a query cannot be matched', async () => {
    knowledge.listAllForAssistant.mockResolvedValue([{
      id: 'fine-policy',
      kind: 'faq',
      category: 'rules',
      title: 'Library fines',
      content: 'Late returns cost Php 20.00 per day.',
      sourceUrl: 'https://library.apc.edu.ph/faqs',
      createdAt: '2026-11-19T10:00:00.123456+00:00',
      updatedAt: '2026-11-20T10:00:00.123456+00:00',
    }]);
    fetchSpy.mockResolvedValue(response(200, {
      choices: [{ message: { content: 'I could not find this in the library information.' } }],
    }));

    const result = await service.answer({ question: '图书馆在哪里？', language: 'zh' });

    const request = JSON.parse(String(fetchSpy.mock.calls[0][1].body));
    expect(request.messages[0].content).not.toContain('Php 20.00');
    expect(request.messages[0].content).toContain('(No relevant entries found.)');
    expect(request.messages[0].content).toContain('Reply in zh.');
    expect(result.matchedKnowledge).toEqual([]);
  });

  it('retrieves librarian knowledge, prioritizes it in context and returns its citation', async () => {
    knowledge.listAllForAssistant.mockResolvedValue([{
      id: 'entry-1',
      kind: 'policy',
      category: 'rules',
      title: 'Food and drink policy',
      content: 'Eating and drinking are not permitted in the main library.',
      sourceUrl: 'https://library.apc.edu.ph/policies/food',
      createdAt: '2026-11-19T10:00:00.123456+00:00',
      updatedAt: '2026-11-20T10:00:00.123456+00:00',
    }]);
    fetchSpy.mockResolvedValue(response(200, {
      choices: [{ message: { content: 'Food and drink are not permitted in the main library.' } }],
    }));

    const result = await service.answer({ question: 'Can I eat food inside the main library?' });

    expect(knowledge.listAllForAssistant).toHaveBeenCalledTimes(1);
    expect(result.matchedKnowledge).toEqual([{
      id: 'entry-1',
      kind: 'policy',
      category: 'rules',
      title: 'Food and drink policy',
      sourceUrl: 'https://library.apc.edu.ph/policies/food',
    }]);
    const request = JSON.parse(String(fetchSpy.mock.calls[0][1].body));
    expect(request.messages[0].content).toContain('Food and drink policy');
    expect(request.messages[0].content).toContain('Eating and drinking are not permitted in the main library.');
  });

  it('surfaces OpenRouter failures instead of returning a fabricated answer', async () => {
    fetchSpy.mockResolvedValue(response(429, { error: 'rate limited' }));

    await expect(service.answer({ question: 'How much is the library fine?' }))
      .rejects.toThrow('OpenRouter FAQ service request failed');
  });

  function response(status: number, body: unknown): Response {
    return {
      ok: status >= 200 && status < 300,
      status,
      json: jest.fn().mockResolvedValue(body),
    } as unknown as Response;
  }
});
