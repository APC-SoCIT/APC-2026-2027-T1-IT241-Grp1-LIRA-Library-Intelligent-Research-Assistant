import { once } from 'node:events';
import { createServer as createTcpServer, createConnection, Server as TcpServer, Socket } from 'node:net';
import { Server as HttpServer } from 'node:http';
import { createTailscaleControlProxy } from '../src/tailscale-control-proxy';

describe('Tailscale control HTTPS tunnel', () => {
  const servers: Array<TcpServer | HttpServer> = [];
  const sockets = new Set<Socket>();

  async function listen(server: TcpServer | HttpServer): Promise<number> {
    servers.push(server);
    server.on('connection', (socket: Socket) => sockets.add(socket));
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Missing test address');
    return address.port;
  }

  function client(port: number): Socket {
    const socket = createConnection({ host: '127.0.0.1', port });
    sockets.add(socket);
    return socket;
  }

  afterEach(async () => {
    for (const socket of sockets) socket.destroy();
    sockets.clear();
    await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
    jest.restoreAllMocks();
  });

  it('preserves opaque encrypted bytes, including CONNECT head bytes, through the Node tunnel', async () => {
    const echoPort = await listen(createTcpServer((socket) => socket.pipe(socket)));
    const dial = jest.fn(() => createConnection({ host: '127.0.0.1', port: echoPort }));
    const proxy = createTailscaleControlProxy(dial);
    const port = await listen(proxy);
    const socket = client(port);
    const payload = Buffer.from([0x16, 0x03, 0x03, 0x00, 0xff, 0x7f]);
    const echoed = new Promise<Buffer>((resolve, reject) => {
      let received = Buffer.alloc(0);
      socket.on('error', reject);
      socket.on('data', (chunk: Buffer) => {
        received = Buffer.concat([received, chunk]);
        const boundary = received.indexOf('\r\n\r\n');
        if (boundary >= 0 && received.length >= boundary + 4 + payload.length) {
          expect(received.subarray(0, boundary).toString()).toContain('200 Connection Established');
          resolve(received.subarray(boundary + 4));
        }
      });
    });
    socket.write(Buffer.concat([
      Buffer.from('CONNECT controlplane.tailscale.com:443 HTTP/1.1\r\nHost: controlplane.tailscale.com:443\r\n\r\n'),
      payload,
    ]));
    await expect(echoed).resolves.toEqual(payload);
    expect(dial).toHaveBeenCalledWith({ host: 'controlplane.tailscale.com', port: 443 });
    expect(proxy.controlStats()).toEqual({
      requests: 1, established: 1, failed: 0, sent: payload.length, received: payload.length,
      controlRequests: 1, controlEstablished: 1, controlSent: payload.length, controlReceived: payload.length,
    });
  });

  it.each([
    'example.com:443',
    '127.0.0.1:443',
    'controlplane.tailscale.com:80',
    'controlplane.tailscale.com.evil.example:443',
    'user:password@controlplane.tailscale.com:443',
  ])('refuses disallowed CONNECT destination %s before dialing', async (destination) => {
    const dial = jest.fn();
    const port = await listen(createTailscaleControlProxy(dial));
    const socket = client(port);
    const response = new Promise<string>((resolve, reject) => {
      let received = '';
      socket.on('data', (chunk: Buffer) => { received += chunk.toString(); });
      socket.on('end', () => resolve(received));
      socket.on('error', reject);
    });
    socket.end(`CONNECT ${destination} HTTP/1.1\r\nHost: ${destination}\r\n\r\n`);
    await expect(response).resolves.toContain('403 Forbidden');
    expect(dial).not.toHaveBeenCalled();
  });

  it('returns a bounded failure response without logging an upstream error message', async () => {
    const upstream = new Socket();
    sockets.add(upstream);
    const secret = 'tskey-auth-private-test-secret';
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    const dial = jest.fn(() => {
      setImmediate(() => upstream.destroy(Object.assign(new Error(secret), { code: 'ENOTFOUND' })));
      return upstream;
    });
    const port = await listen(createTailscaleControlProxy(dial));
    const socket = client(port);
    const response = new Promise<string>((resolve, reject) => {
      let received = '';
      socket.on('data', (chunk: Buffer) => { received += chunk.toString(); });
      socket.on('end', () => resolve(received));
      socket.on('error', reject);
    });
    socket.write('CONNECT controlplane.tailscale.com:443 HTTP/1.1\r\nHost: controlplane.tailscale.com:443\r\n\r\n');
    await expect(response).resolves.toContain('502 Bad Gateway');
    expect(log).toHaveBeenCalledWith('Tailscale control proxy: controlplane.tailscale.com (ENOTFOUND).');
    expect(JSON.stringify(log.mock.calls)).not.toContain(secret);
  });
});
