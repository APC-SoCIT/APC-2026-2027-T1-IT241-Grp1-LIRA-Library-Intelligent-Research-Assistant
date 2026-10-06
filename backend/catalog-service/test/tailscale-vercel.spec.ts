import { promisify } from 'node:util';
import { PassThrough } from 'node:stream';
import type { getTailscaleProxy } from '../src/tailscale-vercel';

describe('Tailscale deployment proxy', () => {
  const key = 'tskey-auth-test-secret';
  const originalFlag = process.env.LIRA_USE_TAILSCALE;
  const originalKey = process.env.TS_AUTHKEY;
  const originalHttpProxy = process.env.HTTP_PROXY;
  const connected = { stdout: JSON.stringify({ BackendState: 'Running' }), stderr: '' };

  let getProxy: typeof getTailscaleProxy;
  let run: jest.Mock;
  let spawn: jest.Mock;
  let operatingSystem: jest.Mock;
  let files: {
    existsSync: jest.Mock;
    mkdirSync: jest.Mock;
    rmSync: jest.Mock;
    writeFileSync: jest.Mock;
  };
  let child: {
    exitCode: number | null;
    signalCode: string | null;
    once: jest.Mock;
    unref: jest.Mock;
    kill: jest.Mock;
    stderr: PassThrough;
  };

  beforeEach(() => {
    jest.resetModules();
    process.env.LIRA_USE_TAILSCALE = '1';
    process.env.TS_AUTHKEY = key;

    run = jest.fn().mockResolvedValue(connected);
    child = {
      exitCode: null,
      signalCode: null,
      once: jest.fn(),
      unref: jest.fn(),
      kill: jest.fn(),
      stderr: new PassThrough(),
    };
    spawn = jest.fn().mockReturnValue(child);
    operatingSystem = jest.fn().mockReturnValue('linux');
    files = {
      existsSync: jest.fn().mockReturnValue(true),
      mkdirSync: jest.fn(),
      rmSync: jest.fn(),
      writeFileSync: jest.fn(),
    };

    jest.doMock('node:child_process', () => ({
      execFile: Object.assign(jest.fn(), { [promisify.custom]: run }),
      spawn,
    }));
    jest.doMock('node:fs', () => files);
    jest.doMock('node:os', () => ({ platform: operatingSystem, tmpdir: () => '/tmp' }));
    jest.doMock('node:timers/promises', () => ({ setTimeout: jest.fn().mockResolvedValue(undefined) }));
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'info').mockImplementation(() => {});
    jest.spyOn(global, 'fetch').mockResolvedValue({ status: 200, body: null } as Response);

    getProxy = require('../src/tailscale-vercel').getTailscaleProxy;
  });

  afterEach(() => {
    if (originalFlag === undefined) delete process.env.LIRA_USE_TAILSCALE;
    else process.env.LIRA_USE_TAILSCALE = originalFlag;
    if (originalKey === undefined) delete process.env.TS_AUTHKEY;
    else process.env.TS_AUTHKEY = originalKey;
    jest.restoreAllMocks();
  });

  it('keeps ordinary local requests independent of Tailscale', async () => {
    delete process.env.LIRA_USE_TAILSCALE;
    operatingSystem.mockReturnValue('win32');
    await expect(getProxy()).resolves.toBeUndefined();
    expect(run).not.toHaveBeenCalled();
    expect(spawn).not.toHaveBeenCalled();
  });

  it('rejects enabling the Linux integration on Windows', async () => {
    operatingSystem.mockReturnValue('win32');
    await expect(getProxy()).rejects.toThrow('requires Linux');
    expect(spawn).not.toHaveBeenCalled();
  });

  it('fails before starting a daemon when its authentication key is missing', async () => {
    delete process.env.TS_AUTHKEY;
    await expect(getProxy()).rejects.toThrow('Set TS_AUTHKEY');
    expect(spawn).not.toHaveBeenCalled();
  });

  it('shares one login across concurrent requests and reuses the warm connection', async () => {
    run.mockRejectedValueOnce(new Error('not connected'))
      .mockResolvedValueOnce({ stdout: '', stderr: '' });

    const proxies = await Promise.all([getProxy(), getProxy(), getProxy()]);
    expect(proxies).toEqual(Array(3).fill({ protocol: 'http', host: '127.0.0.1', port: 1055 }));
    await expect(getProxy()).resolves.toMatchObject({ port: 1055 });
    expect(spawn).toHaveBeenCalledTimes(1);
    expect(run.mock.calls.filter((call) => call[1].includes('up'))).toHaveLength(1);
    expect(JSON.stringify(run.mock.calls)).not.toContain(key);
    expect(files.writeFileSync).toHaveBeenCalledWith(expect.any(String), key, { mode: 0o600 });
    expect(files.rmSync).toHaveBeenCalledWith(
      files.writeFileSync.mock.calls[0][0], { force: true },
    );
    expect(process.env.HTTP_PROXY).toBe(originalHttpProxy);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('cleans up the key and hides login errors, then permits a later retry', async () => {
    run.mockRejectedValueOnce(new Error('not connected'))
      .mockRejectedValueOnce(new Error('Authentication failed with ' + key))
      .mockRejectedValueOnce(new Error('not connected'))
      .mockRejectedValueOnce(new Error('not connected'))
      .mockResolvedValueOnce({ stdout: '', stderr: '' });

    await expect(getProxy()).rejects.toThrow('Tailscale login failed');
    expect(JSON.stringify((console.error as jest.Mock).mock.calls)).not.toContain(key);
    expect(files.rmSync).toHaveBeenCalledWith(
      files.writeFileSync.mock.calls[0][0], { force: true },
    );

    await expect(getProxy()).resolves.toMatchObject({ port: 1055 });
    expect(run.mock.calls.filter((call) => call[1].includes('up'))).toHaveLength(2);
  });

  it.each([
    ['NeedsMachineAuth', 'context deadline exceeded', 'Device approval is required'],
    ['NeedsLogin', 'invalid auth key', 'The auth key was rejected'],
    ['NeedsLogin', 'tag is not allowed', 'The device tag was rejected'],
    ['NeedsLogin', 'context deadline exceeded', 'Login timed out'],
  ])('reports a safe reason for login failure in state %s: %s', async (state, detail, reason) => {
    run.mockRejectedValueOnce(new Error('not connected'))
      .mockRejectedValueOnce(Object.assign(new Error('private output ' + key), {
        stderr: detail + '\n' + key + '\nhttps://login.tailscale.com/a/private-login-token',
      }))
      .mockResolvedValueOnce({ stdout: JSON.stringify({ BackendState: state }), stderr: '' });

    await expect(getProxy()).rejects.toThrow(reason);
    const output = JSON.stringify((console.error as jest.Mock).mock.calls);
    expect(output).toContain('state: ' + state);
    expect(output).not.toContain(key);
    expect(output).not.toContain('private-login-token');
    expect(files.rmSync).toHaveBeenCalledWith(
      files.writeFileSync.mock.calls[0][0], { force: true },
    );
  });

  it('recognizes authentication errors in daemon health even when the CLI only reports a timeout', async () => {
    run.mockRejectedValueOnce(new Error('not connected'))
      .mockRejectedValueOnce(new Error('context deadline exceeded'))
      .mockResolvedValueOnce({ stdout: JSON.stringify({
        BackendState: 'NeedsLogin',
        Health: ['Last login error: invalid auth key ' + key, 'https://login.tailscale.com/a/private-token'],
      }), stderr: '' });

    await expect(getProxy()).rejects.toThrow('The auth key was rejected');
    const output = JSON.stringify((console.error as jest.Mock).mock.calls);
    expect(output).toContain('auth-key-rejected');
    expect(output).toContain('Control HTTPS probe: HTTP 200');
    expect(output).not.toContain(key);
    expect(output).not.toContain('private-token');
    expect(fetch).toHaveBeenCalledWith('https://controlplane.tailscale.com/key', {
      method: 'HEAD', signal: expect.any(AbortSignal), redirect: 'manual',
    });
  });

  it('recognizes fragmented DNS errors from the daemon without logging its raw output', async () => {
    run.mockRejectedValueOnce(new Error('not connected'))
      .mockImplementationOnce(async () => {
        child.stderr.write('private credentials ' + key + '\nlookup controlplane.tailscale.com: no such');
        child.stderr.write(' host\nhttps://login.tailscale.com/a/private-token');
        throw new Error('context deadline exceeded');
      })
      .mockResolvedValueOnce({ stdout: JSON.stringify({ BackendState: 'NeedsLogin' }), stderr: '' });
    (fetch as jest.Mock).mockRejectedValueOnce(Object.assign(new Error(key), {
      cause: { code: 'ENOTFOUND' },
    }));

    await expect(getProxy()).rejects.toThrow('The daemon reported a DNS failure');
    const output = JSON.stringify((console.error as jest.Mock).mock.calls);
    expect(output).toContain('dns-failure');
    expect(output).toContain('Control HTTPS probe: ENOTFOUND');
    expect(output).not.toContain(key);
    expect(output).not.toContain('private-token');
  });

  it('reports a control connection failure separately from successful Node HTTPS access', async () => {
    run.mockRejectedValueOnce(new Error('not connected'))
      .mockImplementationOnce(async () => {
        child.stderr.write('register request: Post https://controlplane.tailscale.com/machine/register: context deadline exceeded');
        throw new Error('context deadline exceeded');
      })
      .mockResolvedValueOnce({ stdout: JSON.stringify({ BackendState: 'NeedsLogin' }), stderr: '' });

    await expect(getProxy()).rejects.toThrow('The daemon reported an outbound connection failure');
    const output = JSON.stringify((console.error as jest.Mock).mock.calls);
    expect(output).toContain('control-connection-timeout');
    expect(output).toContain('Control HTTPS probe: HTTP 200');
  });

  it('does not print unknown HTTPS errors that may contain credentials', async () => {
    run.mockRejectedValueOnce(new Error('not connected'))
      .mockRejectedValueOnce(new Error('context deadline exceeded'))
      .mockResolvedValueOnce({ stdout: JSON.stringify({ BackendState: 'NeedsLogin' }), stderr: '' });
    (fetch as jest.Mock).mockRejectedValueOnce(Object.assign(new Error(key), {
      cause: { code: key },
    }));

    await expect(getProxy()).rejects.toThrow('Control HTTPS probe: failed');
    expect(JSON.stringify((console.error as jest.Mock).mock.calls)).not.toContain(key);
  });

  it('stops a failed daemon before trying to authenticate', async () => {
    run.mockRejectedValueOnce(new Error('not connected'));
    files.existsSync.mockReturnValue(false);
    child.once.mockImplementation((_event: string, callback: () => void) => callback());

    await expect(getProxy()).rejects.toThrow('Tailscale daemon failed');
    expect(child.kill).toHaveBeenCalledWith('SIGKILL');
    expect(files.writeFileSync).not.toHaveBeenCalled();
  });

  it('bounds the startup wait and allows the next request to start a replacement', async () => {
    run.mockRejectedValueOnce(new Error('not connected'));
    files.existsSync.mockReturnValue(false);
    await expect(getProxy()).rejects.toThrow('socket did not become ready');
    expect(child.kill).toHaveBeenCalledWith('SIGKILL');

    run.mockRejectedValueOnce(new Error('not connected'))
      .mockResolvedValueOnce({ stdout: '', stderr: '' });
    files.existsSync.mockReturnValue(true);
    await expect(getProxy()).resolves.toMatchObject({ port: 1055 });
    expect(spawn).toHaveBeenCalledTimes(2);
  });
});
