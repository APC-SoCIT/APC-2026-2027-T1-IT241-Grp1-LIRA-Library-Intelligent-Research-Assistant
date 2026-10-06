import { ChildProcess, execFile, spawn } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { platform, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { promisify } from 'node:util';
import type { AxiosProxyConfig } from 'axios';

const run = promisify(execFile);
const directory = join(tmpdir(), 'lira-tailscale');
const socket = join(directory, 'tailscaled.sock');
const authKeyFile = join(directory, 'authkey');
const binary = (name: string) => resolve(__dirname, '../vendor/tailscale', name);

let daemon: ChildProcess | undefined;
let daemonFailed = false;
let connecting: Promise<void> | undefined;

async function isConnected(): Promise<boolean> {
  try {
    const { stdout } = await run(binary('tailscale'), [
      '--socket=' + socket, 'status', '--json',
    ], { timeout: 5000 });
    return JSON.parse(stdout).BackendState === 'Running';
  } catch {
    return false;
  }
}

function failDaemon(message: string): never {
  daemonFailed = true;
  daemon?.kill('SIGKILL');
  throw new Error(message);
}

async function connect(key: string): Promise<void> {
  if (await isConnected()) return;

  if (!daemon || daemon.exitCode !== null || daemon.signalCode !== null || daemonFailed) {
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    rmSync(socket, { force: true });
    daemonFailed = false;

    daemon = spawn(binary('tailscaled'), [
      '--tun=userspace-networking',
      '--state=mem:',
      '--statedir=' + directory,
      '--socket=' + socket,
      '--outbound-http-proxy-listen=127.0.0.1:1055',
    ], { stdio: 'ignore' });

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
  } catch {
    // Keep child-process errors and their output out of logs and HTTP responses.
    throw new Error('Tailscale login failed. Check auth key, tags, expiry and device approval.');
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
