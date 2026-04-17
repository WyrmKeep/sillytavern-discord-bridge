import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  DEFAULT_CONFIG,
  parseBridgeConfig,
  parseBridgeSecrets,
  type DiscordBridgeConfig,
  type DiscordBridgeSecrets,
} from './schema.js';

export async function readConfig(filePath: string): Promise<DiscordBridgeConfig> {
  try {
    return parseBridgeConfig(JSON.parse(await readFile(filePath, 'utf8')));
  } catch (error) {
    if (isNotFound(error)) {
      return parseBridgeConfig(DEFAULT_CONFIG);
    }
    throw error;
  }
}

export async function writeConfig(filePath: string, config: DiscordBridgeConfig): Promise<void> {
  await writeJsonAtomic(filePath, parseBridgeConfig(config));
}

export async function readSecrets(filePath: string): Promise<DiscordBridgeSecrets> {
  try {
    return parseBridgeSecrets(JSON.parse(await readFile(filePath, 'utf8')));
  } catch (error) {
    if (isNotFound(error)) {
      return {};
    }
    throw error;
  }
}

export async function writeSecrets(filePath: string, secrets: DiscordBridgeSecrets): Promise<void> {
  await writeJsonAtomic(filePath, parseBridgeSecrets(secrets));
}

async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await rename(tempPath, filePath);
}

function isNotFound(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'ENOENT'
  );
}
