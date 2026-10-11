import { execFileSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, rmdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const version = '1.102.5';
if (process.platform !== 'linux') {
  throw new Error('Run build:vercel in the Vercel Linux build; use npm run build locally.');
}

const architecture = { x64: 'amd64', arm64: 'arm64' }[process.arch];
if (!architecture) throw new Error('Unsupported CPU architecture: ' + process.arch);

const serviceRoot = fileURLToPath(new URL('../', import.meta.url));
const destination = join(serviceRoot, 'vendor/tailscale');
const publicDirectory = join(serviceRoot, 'public');
mkdirSync(destination, { recursive: true });
mkdirSync(publicDirectory, { recursive: true });
writeFileSync(join(publicDirectory, 'index.txt'), 'LIRA catalog API\n');

const downloadDirectory = mkdtempSync(join(tmpdir(), 'lira-tailscale-'));
const archive = join(downloadDirectory, 'tailscale.tgz');

try {
  const url = 'https://pkgs.tailscale.com/stable/tailscale_' + version + '_' + architecture + '.tgz';
  const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error('Tailscale download failed: HTTP ' + response.status);

  writeFileSync(archive, Buffer.from(await response.arrayBuffer()));
  execFileSync('tar', ['-xzf', archive, '-C', destination, '--strip-components=1'], {
    timeout: 30000,
  });

  for (const executable of ['tailscale', 'tailscaled']) {
    chmodSync(join(destination, executable), 0o755);
  }

  const installedVersion = execFileSync(join(destination, 'tailscale'), ['version'], {
    encoding: 'utf8',
    timeout: 10000,
  }).split('\n')[0].trim();

  if (installedVersion !== version) throw new Error('Unexpected Tailscale binary version.');
  console.log('Tailscale ' + version + ' binaries ready for ' + architecture + '.');
} finally {
  rmSync(archive, { force: true });
  rmdirSync(downloadDirectory);
}
