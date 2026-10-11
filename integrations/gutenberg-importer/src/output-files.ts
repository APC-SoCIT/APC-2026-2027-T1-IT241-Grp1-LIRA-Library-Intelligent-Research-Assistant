import { lstat, mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

/** Exclusive outputs also protect symlink/hardlink aliases to inputs. */
export async function checkNewOutputs(paths: string[]): Promise<void> {
  const keys = paths.map((path) => process.platform === 'win32' ? resolve(path).toLowerCase() : resolve(path));
  if (new Set(keys).size !== paths.length) throw new Error('Output MARCXML and report paths must differ');
  for (const path of paths) {
    try { await lstat(path); }
    catch (error: unknown) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue; throw error; }
    throw new Error(`Output already exists; choose a new path (inputs are never overwritten): ${path}`);
  }
}
export async function writeNewOutput(path: string, value: string): Promise<void> {
  await mkdir(dirname(resolve(path)), { recursive: true });
  await writeFile(path, value, { encoding: 'utf8', flag: 'wx' });
}
