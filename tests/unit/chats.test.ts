import { readFile } from 'node:fs/promises';
import { describe, expect, test } from 'vitest';
import {
  appendAssistantMessage,
  appendUserMessage,
  buildChatFilePath,
  createChatDocument,
  parseJsonlChat,
  selectSwipe,
  serializeJsonlChat,
} from '../../src/server-plugin/sillytavern/chats.js';

describe('SillyTavern chat JSONL storage', () => {
  test('builds chat path without double jsonl suffix', () => {
    expect(buildChatFilePath('/data', 'default-user', 'Alice', 'stamp--thread.jsonl')).toBe(
      '/data/default-user/chats/Alice/stamp--thread.jsonl',
    );
  });

  test('creates header and appends user and assistant messages', () => {
    const chat = createChatDocument({
      guildId: 'guild',
      forumChannelId: 'forum',
      threadId: 'thread',
      characterAvatarFile: 'Alice.png',
      chatFolderName: 'Alice',
      createdByDiscordUserId: 'user',
      createdAt: '2026-04-17T12:00:00.000Z',
    });

    appendUserMessage(chat, {
      name: 'Human',
      mes: 'Hello',
      sendDate: '2026-04-17T12:00:01.000Z',
      discordUserId: 'user',
      discordMessageId: 'discord_user',
      discordThreadId: 'thread',
    });

    appendAssistantMessage(chat, {
      name: 'Alice',
      mes: 'Hi there',
      sendDate: '2026-04-17T12:00:02.000Z',
      bridgeMessageId: 'asst_1',
      discordMessageId: 'discord_asst',
      discordThreadId: 'thread',
      model: 'claude-sonnet-4-6',
    });

    expect(chat).toHaveLength(3);
    expect(chat[2]?.swipes).toEqual(['Hi there']);
    expect(chat[2]?.swipe_info).toHaveLength(1);
    expect(chat[2]?.extra?.discord_bridge?.bridge_message_id).toBe('asst_1');
  });

  test('selectSwipe keeps mes and swipe_info aligned', () => {
    const chat = createChatDocument({
      guildId: 'guild',
      forumChannelId: 'forum',
      threadId: 'thread',
      characterAvatarFile: 'Alice.png',
      chatFolderName: 'Alice',
      createdByDiscordUserId: 'user',
      createdAt: '2026-04-17T12:00:00.000Z',
    });

    const assistant = appendAssistantMessage(chat, {
      name: 'Alice',
      mes: 'First',
      sendDate: '2026-04-17T12:00:02.000Z',
      bridgeMessageId: 'asst_1',
      discordMessageId: 'discord_asst',
      discordThreadId: 'thread',
      model: 'claude-sonnet-4-6',
    });
    assistant.swipes?.push('Second');
    assistant.swipe_info?.push({ send_date: '2026-04-17T12:00:03.000Z', extra: {} });

    selectSwipe(assistant, 1);

    expect(assistant.mes).toBe('Second');
    expect(assistant.swipe_id).toBe(1);
    expect(assistant.swipes).toHaveLength(assistant.swipe_info?.length ?? 0);
  });

  test('parses and serializes JSONL chat', async () => {
    const fixture = await readFile('tests/fixtures/chats/simple-chat.jsonl', 'utf8');
    const chat = parseJsonlChat(fixture);
    const serialized = serializeJsonlChat(chat);

    expect(parseJsonlChat(serialized)).toEqual(chat);
  });
});
