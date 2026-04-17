import path from 'node:path';
import { pathToFileURL } from 'node:url';

export type SillyTavernImportResolver = {
  rootDir: string;
};

export function resolveSillyTavernInternal(rootDir: string, relativePath: string): string {
  return pathToFileURL(path.join(rootDir, relativePath)).href;
}

export async function importSillyTavernInternal<T>(
  resolver: SillyTavernImportResolver,
  relativePath: string,
): Promise<T> {
  return (await import(resolveSillyTavernInternal(resolver.rootDir, relativePath))) as T;
}

export function detectSillyTavernRoot(pluginDir = process.cwd()): string {
  let current = path.resolve(pluginDir);
  for (let index = 0; index < 5; index += 1) {
    if (path.basename(current) === 'SillyTavern') {
      return current;
    }
    current = path.dirname(current);
  }
  return process.cwd();
}
