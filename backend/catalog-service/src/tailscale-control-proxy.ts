import { createServer, Server } from 'node:http';
import { createConnection, Socket } from 'node:net';

type Dial = (options: { host: string; port: number }) => Socket;
let starting: Promise<string> | undefined;

// Only the local Tailscale daemon uses this proxy. Node resolves the upstream
// name; the daemon keeps its end-to-end TLS/Noise connection inside the tunnel.
export function createTailscaleControlProxy(dial: Dial = createConnection): Server {
  const server = createServer((_request, response) => {
    response.writeHead(405).end();
  });
  server.on('connect', (request, client, head) => {
    let destination: URL;
    try {
      destination = new URL('http://' + request.url);
    } catch {
      client.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
      return;
    }
    const host = destination.hostname;
    const tailscaleHost = host.endsWith('.tailscale.com') || host.endsWith('.tailscale.io');
    if (!tailscaleHost || destination.port !== '443' || destination.username ||
      destination.password || destination.pathname !== '/' || destination.search || destination.hash) {
      client.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
      return;
    }

    let established = false;
    const upstream = dial({ host, port: 443 });
    const timer = setTimeout(() => upstream.destroy(Object.assign(
      new Error('Tailscale control proxy connection timed out'), { code: 'ETIMEDOUT' },
    )), 10000);
    timer.unref();
    upstream.once('connect', () => {
      clearTimeout(timer);
      established = true;
      client.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      if (head.length) upstream.write(head);
      client.pipe(upstream);
      upstream.pipe(client);
    });
    upstream.on('error', (error: NodeJS.ErrnoException) => {
      const code = ['ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'ECONNRESET',
        'ETIMEDOUT', 'ENETUNREACH', 'EHOSTUNREACH'].includes(error.code ?? '')
        ? error.code : 'connection failed';
      console.error(`Tailscale control proxy: ${host} (${code}).`);
      if (!established && !client.destroyed && !client.writableEnded) {
        client.end('HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\n\r\n');
      } else {
        client.destroy();
      }
    });
    upstream.once('close', () => {
      clearTimeout(timer);
      if (!established && !client.destroyed && !client.writableEnded) {
        client.end('HTTP/1.1 504 Gateway Timeout\r\nConnection: close\r\n\r\n');
      }
    });
    client.on('error', () => upstream.destroy());
    client.once('close', () => upstream.destroy());
  });
  return server;
}

export function startTailscaleControlProxy(): Promise<string> {
  if (!starting) {
    starting = new Promise<string>((resolve, reject) => {
      const server = createTailscaleControlProxy();
      server.once('error', () => reject(new Error('Tailscale control proxy could not listen.')));
      server.listen(0, '127.0.0.1', () => {
        const address = server.address();
        if (!address || typeof address === 'string') {
          server.close();
          reject(new Error('Tailscale control proxy has no listening address.'));
          return;
        }
        server.unref();
        resolve(`http://127.0.0.1:${address.port}`);
      });
    }).catch((error: unknown) => {
      starting = undefined;
      throw error;
    });
  }
  return starting;
}
