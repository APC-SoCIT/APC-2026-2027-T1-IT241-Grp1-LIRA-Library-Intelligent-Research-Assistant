import { ChildProcess, execFile, spawn } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { platform, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { promisify } from 'node:util';
import type { AxiosProxyConfig } from 'axios';
import { startTailscaleControlProxy } from './tailscale-control-proxy';

const run = promisify(execFile);
const directory = join(tmpdir(), 'lira-tailscale');
const socket = join(directory, 'tailscaled.sock');
const authKeyFile = join(directory, 'authkey');
const binary = (name: string) => resolve(__dirname, '../vendor/tailscale', name);

let daemon: ChildProcess | undefined;
let daemonFailed = false;
let connecting: Promise<void> | undefined;
const diagnostics = new Set<string>();

function recordDiagnostics(detail: string): void {
  // Match known failure categories without printing daemon logs, credentials,
  // private node keys, or interactive login URLs.
  const categories: [string, RegExp][] = [
    ['auth-key-rejected', /invalid.*(?:auth|key)|(?:auth|key).*(?:invalid|expired|revoked|not found)|not a valid key/i],
    ['tag-rejected', /tag.*(?:invalid|not permitted|not allowed|unauthorized)/i],
    ['device-approval-required', /needs? (?:machine )?approval|pending approval/i],
    ['dns-failure', /no such host|server misbehaving|temporary failure in name resolution|dns.*(?:failed|timeout|unreachable)/i],
    ['tls-failure', /x509:|certificate.*(?:unknown|expired|invalid)|tls handshake.*(?:failed|timeout)/i],
    ['network-failure', /network is unreachable|no route to host|connection refused|connection reset|operation not permitted|permission denied/i],
    ['control-connection-timeout', /(?:controlplane|login)\.tailscale\.com.*(?:deadline exceeded|timed? out|timeout)/i],
    ['tailnet-lock', /tailnet lock.*(?:sign|reject|fail)|node key.*(?:unsigned|not signed)/i],
  ];
  for (const [category, pattern] of categories) {
    if (pattern.test(detail)) diagnostics.add(category);
  }
}

async function controlHttpsProbe(): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  timer.unref();
  try {
    // Public endpoint only; never send the auth key or follow a redirect.
    const response = await fetch('https://controlplane.tailscale.com/key', {
      method: 'HEAD', signal: controller.signal, redirect: 'manual',
    });
    await response.body?.cancel();
    return `HTTP ${response.status}`;
  } catch (error: unknown) {
    if (controller.signal.aborted) return 'timeout';
    const failure = error as { cause?: { code?: unknown }; code?: unknown } | null;
    const code = failure?.cause?.code ?? failure?.code;
    const safeCodes = ['ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT',
      'ENETUNREACH', 'EHOSTUNREACH', 'CERT_HAS_EXPIRED', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
      'DEPTH_ZERO_SELF_SIGNED_CERT', 'SELF_SIGNED_CERT_IN_CHAIN', 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
      'UND_ERR_CONNECT_TIMEOUT'];
    return typeof code === 'string' && safeCodes.includes(code) ? code : 'failed';
  } finally {
    clearTimeout(timer);
  }
}

async function backendState(): Promise<string | undefined> {
  try {
    const { stdout } = await run(binary('tailscale'), [
      '--socket=' + socket, 'status', '--json',
    ], { timeout: 5000 });
    const status = JSON.parse(stdout) as { BackendState?: unknown; Health?: unknown };
    if (Array.isArray(status.Health)) {
      for (const health of status.Health) {
        if (typeof health === 'string') recordDiagnostics(health.slice(0, 8192));
      }
    }
    const state = status.BackendState;
    // Only return known state names, never arbitrary daemon output.
    return typeof state === 'string' &&
      ['NoState', 'NeedsLogin', 'NeedsMachineAuth', 'Stopped', 'Starting', 'Running'].includes(state)
      ? state : undefined;
  } catch {
    return undefined;
  }
}

async function isConnected(): Promise<boolean> {
  return await backendState() === 'Running';
}

async function loginFailure(error: unknown): Promise<Error> {
  const state = await backendState();
  const failure = error as { message?: unknown; stderr?: unknown; code?: unknown; killed?: unknown } | null;
  const detail = [failure?.message, failure?.stderr]
    .filter((value): value is string => typeof value === 'string').join('\n');
  recordDiagnostics(detail);
  let reason = 'Check auth key, tags, expiry and device approval.';

  if (state === 'NeedsMachineAuth' || diagnostics.has('device-approval-required')) {
    reason = 'Device approval is required. Approve lira-vercel in Tailscale Machines or use a pre-approved auth key.';
  } else if (diagnostics.has('auth-key-rejected')) {
    reason = 'The auth key was rejected. Replace TS_AUTHKEY with a valid reusable auth key in Vercel Production and redeploy.';
  } else if (diagnostics.has('tag-rejected')) {
    reason = 'The device tag was rejected. Check tag:lira-backend ownership and the auth key tags.';
  } else if (diagnostics.has('dns-failure')) {
    reason = 'The daemon reported a DNS failure. Check outbound DNS access from the deployed runtime.';
  } else if (diagnostics.has('tls-failure')) {
    reason = 'The daemon reported a TLS failure. Check certificate trust in the deployed runtime.';
  } else if (diagnostics.has('network-failure') || diagnostics.has('control-connection-timeout')) {
    reason = 'The daemon reported an outbound connection failure. Check connectivity to the Tailscale control service.';
  } else if (failure?.killed === true || failure?.code === 'ETIMEDOUT' || /deadline exceeded|timed? out|timeout/i.test(detail)) {
    reason = 'Login timed out. Check device approval and connectivity to the Tailscale control service.';
  }

  // Child-process output can contain keys or login URLs. Emit fixed messages only.
  const probe = await controlHttpsProbe();
  return new Error(`Tailscale login failed${state ? ` (state: ${state})` : ''}. ${reason} ` +
    `Diagnostics: ${[...diagnostics].sort().join(', ') || 'no recognized daemon error'}. ` +
    `Control HTTPS probe: ${probe}.`);
}

function failDaemon(message: string): never {
  daemonFailed = true;
  daemon?.kill('SIGKILL');
  throw new Error(message);
}

async function connect(key: string): Promise<void> {
  diagnostics.clear();
  if (await isConnected()) return;

  if (!daemon || daemon.exitCode !== null || daemon.signalCode !== null || daemonFailed) {
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    rmSync(socket, { force: true });
    daemonFailed = false;

    const controlProxy = await startTailscaleControlProxy();
    const daemonEnvironment: NodeJS.ProcessEnv = {
      ...process.env,
      HTTP_PROXY: controlProxy,
      HTTPS_PROXY: controlProxy,
      http_proxy: controlProxy,
      https_proxy: controlProxy,
      NO_PROXY: 'localhost,127.0.0.1,::1',
      no_proxy: 'localhost,127.0.0.1,::1',
      // The local proxy tunnels HTTPS only; avoid the port-80 control fast path.
      TS_FORCE_NOISE_443: 'true',
    };
    // The daemon receives its key through the private file during `tailscale up`.
    delete daemonEnvironment.TS_AUTHKEY;

    daemon = spawn(binary('tailscaled'), [
      '--tun=userspace-networking',
      '--state=mem:',
      '--statedir=' + directory,
      '--socket=' + socket,
      '--outbound-http-proxy-listen=127.0.0.1:1055',
    ], { stdio: ['ignore', 'ignore', 'pipe'], env: daemonEnvironment });

    const startedDaemon = daemon;
    let logTail = '';
    daemon.stderr?.on('data', (chunk: Buffer) => {
      if (daemon !== startedDaemon) return;
      // Keep only a small window so fragmented error messages can be recognized.
      logTail = (logTail + chunk.toString('utf8')).slice(-8192);
      recordDiagnostics(logTail);
    });

    daemon.once('error', () => { daemonFailed = true; });
    daemon.unref();
  }

  for (let attempt = 0; attempt < 50 && !existsSync(socket); attempt++) {
    if (daemonFailed || daemon.exitCode !== null || daemon.signalCode !== null) {
      failDaemon('Tailscale daemon failed. Check bundled binaries and executable permissions.');
    }
    await delay(100);
  }

  if (!existsSync(socket)) failDaemon('Tailscale socket did not become ready.');

  try {
    // Pass a private temporary file so the key is absent from process arguments.
    writeFileSync(authKeyFile, key, { mode: 0o600 });
    await run(binary('tailscale'), [
      '--socket=' + socket, 'up',
      '--auth-key=file:' + authKeyFile,
      '--hostname=lira-vercel',
      '--accept-dns=false',
      '--timeout=45s',
    ], { timeout: 50000 });
  } catch (error: unknown) {
    throw await loginFailure(error);
  } finally {
    rmSync(authKeyFile, { force: true });
  }

  if (!await isConnected()) throw new Error('Tailscale did not connect.');
  console.info('Tailscale connected for Koha requests.');
}

export async function getTailscaleProxy(): Promise<AxiosProxyConfig | undefined> {
  if (process.env.LIRA_USE_TAILSCALE !== '1') return undefined;
  if (platform() !== 'linux') {
    throw new Error('Tailscale deployment integration requires Linux; disable it for local development.');
  }

  const key = process.env.TS_AUTHKEY?.trim();
  if (!key) throw new Error('Set TS_AUTHKEY in the backend Vercel project.');

  if (!connecting) {
    connecting = connect(key).catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : 'Tailscale connection failed.');
      throw error;
    }).finally(() => { connecting = undefined; });
  }

  await connecting;
  return { protocol: 'http', host: '127.0.0.1', port: 1055 };
}
