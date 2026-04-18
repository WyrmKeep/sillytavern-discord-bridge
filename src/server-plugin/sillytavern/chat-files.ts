import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseJsonlChat, serializeJsonlChat, type ChatDocument } from './chats.js';

export type ChatFileFingerprint = {
  exists: boolean;
  size: number;
  mtimeMs: number;
};

export type LoadedChatFile = {
  chat: ChatDocument;
  fingerprint: ChatFileFingerprint;
};

export class ChatFileConflictError extends Error {
  constructor(filePath: string) {
    super(`Chat file changed before save: ${filePath}`);
    this.name = 'ChatFileConflictError';
  }
}

export async function loadChatFile(filePath: string): Promise<LoadedChatFile> {
  const [content, fingerprint] = await Promise.all([
    readFile(filePath, 'utf8'),
    fingerprintChatFile(filePath),
  ]);

  return {
    chat: parseJsonlChat(content),
    fingerprint,
  };
}

export async function saveChatFile(
  filePath: string,
  chat: ChatDocument,
  expectedFingerprint?: ChatFileFingerprint,
): Promise<ChatFileFingerprint> {
  if (expectedFingerprint) {
    const current = await fingerprintChatFile(filePath);
    if (!sameFingerprint(current, expectedFingerprint)) {
      throw new ChatFileConflictError(filePath);
    }
  }

  await mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tempPath, serializeJsonlChat(chat), 'utf8');
  await rename(tempPath, filePath);
  return fingerprintChatFile(filePath);
}

export async function fingerprintChatFile(filePath: string): Promise<ChatFileFingerprint> {
  try {
    const stats = await stat(filePath);
    return {
      exists: true,
      size: stats.size,
      mtimeMs: stats.mtimeMs,
    };
  } catch (error) {
    if (isNotFound(error)) {
      return {
        exists: false,
        size: 0,
        mtimeMs: 0,
      };
    }
    throw error;
  }
}

function sameFingerprint(left: ChatFileFingerprint, right: ChatFileFingerprint): boolean {
  return left.exists === right.exists && left.size === right.size && left.mtimeMs === right.mtimeMs;
}

function isNotFound(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'ENOENT'
  );
}
