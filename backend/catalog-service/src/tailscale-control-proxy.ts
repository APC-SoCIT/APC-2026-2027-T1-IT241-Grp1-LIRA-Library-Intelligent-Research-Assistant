import { createServer, Server } from 'node:http';
import { createConnection, Socket } from 'node:net';

type Dial = (options: { host: string; port: number }) => Socket;
let starting: Promise<string> | undefined;
type ProxyStats = {
  requests: number; established: number; failed: number; sent: number; received: number;
  controlRequests: number; controlEstablished: number; controlSent: number; controlReceived: number;
};
type ControlProxyServer = Server & { controlStats: () => ProxyStats };
let activeServer: ControlProxyServer | undefined;

export function getTailscaleControlProxyStats(): string {
  if (!activeServer) return 'not started';
  const stats = activeServer.controlStats();
  return `requests=${stats.requests}, established=${stats.established}, failed=${stats.failed}, ` +
    `sent=${stats.sent}, received=${stats.received}; controlRequests=${stats.controlRequests}, ` +
    `controlEstablished=${stats.controlEstablished}, controlSent=${stats.controlSent}, controlReceived=${stats.controlReceived}`;
}

// Only the local Tailscale daemon uses this proxy. Node resolves the upstream
// name; the daemon keeps its end-to-end TLS/Noise connection inside the tunnel.
export function createTailscaleControlProxy(dial: Dial = createConnection): ControlProxyServer {
  const stats: ProxyStats = {
    requests: 0, established: 0, failed: 0, sent: 0, received: 0,
    controlRequests: 0, controlEstablished: 0, controlSent: 0, controlReceived: 0,
  };
  const server = createServer((_request, response) => {
    response.writeHead(405).end();
  });
  server.on('connect', (request, client, head) => {
    stats.requests++;
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

    const isControl = host === 'controlplane.tailscale.com' || host === 'login.tailscale.com';
    if (isControl) stats.controlRequests++;
    let established = false;
    const upstream = dial({ host, port: 443 });
    const timer = setTimeout(() => upstream.destroy(Object.assign(
      new Error('Tailscale control proxy connection timed out'), { code: 'ETIMEDOUT' },
    )), 10000);
    timer.unref();
    upstream.once('connect', () => {
      clearTimeout(timer);
      established = true;
      stats.established++;
      if (isControl) stats.controlEstablished++;
      console.info(`Tailscale control proxy: tunnel established to ${host}.`);
      client.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      if (head.length) {
        stats.sent += head.length;
        if (isControl) stats.controlSent += head.length;
        upstream.write(head);
      }
      client.on('data', (chunk: Buffer) => {
        stats.sent += chunk.length;
        if (isControl) stats.controlSent += chunk.length;
      });
      upstream.on('data', (chunk: Buffer) => {
        stats.received += chunk.length;
        if (isControl) stats.controlReceived += chunk.length;
      });
      client.pipe(upstream);
      upstream.pipe(client);
    });
    upstream.on('error', (error: NodeJS.ErrnoException) => {
      stats.failed++;
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
  return Object.assign(server, { controlStats: () => ({ ...stats }) });
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
        activeServer = server;
        resolve(`http://127.0.0.1:${address.port}`);
      });
    }).catch((error: unknown) => {
      starting = undefined;
      throw error;
    });
  }
  return starting;
}
