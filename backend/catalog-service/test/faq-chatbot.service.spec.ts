import { ConfigService } from '@nestjs/config';
import { FaqChatbotService } from '../src/chatbot/faq-chatbot.service';

describe('FaqChatbotService', () => {
  const config = {
    openRouterApiKey: 'test-openrouter-api-key',
    model: 'openai/gpt-4o-mini',
  };
  let service: FaqChatbotService;
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    const configService = {
      getOrThrow: jest.fn().mockReturnValue(config),
    } as unknown as ConfigService;
    service = new FaqChatbotService(configService);
    fetchSpy = jest.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('retrieves relevant official FAQ guidance and sends it to OpenRouter', async () => {
    fetchSpy.mockResolvedValue(response(200, {
      choices: [{ message: { content: 'Late returns are Php 20.00 per book, per day.' } }],
    }));

    const result = await service.answer({
      question: 'How much is a fine for late book returns?',
      language: 'en',
    });

    expect(result.answer).toBe('Late returns are Php 20.00 per book, per day.');
    expect(result.sourceUrl).toBe('https://library.apc.edu.ph/faqs');
    expect(result.matchedFaqs.map(({ id }) => id)).toContain('borrow-fine');
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

  it('uses the official FAQ corpus when a query cannot be matched lexically', async () => {
    fetchSpy.mockResolvedValue(response(200, {
      choices: [{ message: { content: 'I could not find this in the APC Library FAQs.' } }],
    }));

    const result = await service.answer({ question: '图书馆在哪里？', language: 'zh' });

    const request = JSON.parse(String(fetchSpy.mock.calls[0][1].body));
    expect(request.messages[0].content).toContain('Where is the APC Library located?');
    expect(request.messages[0].content).toContain('Reply in zh.');
    expect(result.matchedFaqs).toEqual([]);
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
