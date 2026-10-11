import { EventEmitter } from 'node:events';
import { IncomingMessage, ServerResponse } from 'node:http';

describe('Vercel Node entry point lifecycle (local mocks)', () => {
  const handler = jest.fn();
  const app = {
    init: jest.fn(), close: jest.fn(),
    getHttpAdapter: () => ({ getInstance: () => handler }),
  };
  let entry: (request: IncomingMessage, response: ServerResponse) => Promise<void>;

  beforeEach(() => {
    jest.resetModules();
    handler.mockReset();
    app.init.mockReset().mockResolvedValue(undefined);
    jest.doMock('../dist/create-app', () => ({ createApp: async () => app }), { virtual: true });
    entry = jest.requireActual('../api/index.js');
  });

  afterEach(() => jest.dontMock('../dist/create-app'));

  it.each(['finish', 'close'])('keeps the invocation pending until response %s and cleans up listeners', async (event) => {
    const request = {} as IncomingMessage;
    const response = new EventEmitter() as ServerResponse;
    let settled = false;
    const promise = entry(request, response).then(() => { settled = true; });
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(handler).toHaveBeenCalledWith(request, response);
    expect(settled).toBe(false);
    response.emit(event);
    await promise;
    expect(settled).toBe(true);
    expect(response.listenerCount('finish') + response.listenerCount('close') + response.listenerCount('error')).toBe(0);
  });

  it('does not invoke Express after a client disconnects during initialization', async () => {
    await entry({ aborted: true } as IncomingMessage, new EventEmitter() as ServerResponse);
    expect(handler).not.toHaveBeenCalled();
  });
});
