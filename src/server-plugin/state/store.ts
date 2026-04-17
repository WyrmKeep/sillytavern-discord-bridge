import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { bridgeStateSchema, type ConversationState, type DiscordBridgeState } from './schema.js';

export type CreateConversationInput = Omit<
  ConversationState,
  'chatFolderName' | 'createdAt' | 'updatedAt'
> & {
  createdAt?: string;
  updatedAt?: string;
};

export function emptyState(): DiscordBridgeState {
  return {
    version: 1,
    conversations: {},
  };
}

export function createConversationState(input: CreateConversationInput): ConversationState {
  const now = new Date().toISOString();
  return {
    ...input,
    chatFolderName: path.parse(input.characterAvatarFile).name,
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? input.createdAt ?? now,
  };
}

export async function readState(filePath: string): Promise<DiscordBridgeState> {
  try {
    const text = await readFile(filePath, 'utf8');
    return bridgeStateSchema.parse(JSON.parse(text));
  } catch (error) {
    if (isNotFound(error)) {
      return emptyState();
    }
    throw error;
  }
}

export async function writeState(filePath: string, state: DiscordBridgeState): Promise<void> {
  const parsed = bridgeStateSchema.parse(state);
  await mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8');
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
