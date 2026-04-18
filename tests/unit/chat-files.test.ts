import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, test } from 'vitest';
import {
  ChatFileConflictError,
  loadChatFile,
  saveChatFile,
} from '../../src/server-plugin/sillytavern/chat-files.js';
import {
  appendUserMessage,
  createChatDocument,
} from '../../src/server-plugin/sillytavern/chats.js';

describe('chat file persistence', () => {
  test('writes and reloads ST JSONL chat documents', async () => {
    const file = path.join(tmpdir(), `discord-bridge-chat-${Date.now()}`, 'Alice', 'chat.jsonl');
    const chat = createChatDocument({
      guildId: 'guild',
      forumChannelId: 'forum',
      threadId: 'thread',
      characterAvatarFile: 'Alice.png',
      chatFolderName: 'Alice',
      createdByDiscordUserId: 'user',
      createdAt: '2026-04-18T12:00:00.000Z',
    });
    appendUserMessage(chat, {
      name: 'Human',
      mes: 'Hello',
      sendDate: '2026-04-18T12:00:01.000Z',
      discordUserId: 'user',
      discordMessageId: 'message',
      discordThreadId: 'thread',
    });

    await saveChatFile(file, chat);
    const loaded = await loadChatFile(file);

    expect(loaded.chat).toEqual(chat);
    expect(loaded.fingerprint).toMatchObject({ exists: true });
  });

  test('rejects stale writes when the file changed after load', async () => {
    const dir = path.join(tmpdir(), `discord-bridge-chat-conflict-${Date.now()}`);
    const file = path.join(dir, 'Alice', 'chat.jsonl');
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, '{"chat_metadata":{}}\n', 'utf8');

    const loaded = await loadChatFile(file);
    await writeFile(file, '{"chat_metadata":{},"changed":true}\n', 'utf8');

    await expect(saveChatFile(file, loaded.chat, loaded.fingerprint)).rejects.toBeInstanceOf(
      ChatFileConflictError,
    );
  });
});
