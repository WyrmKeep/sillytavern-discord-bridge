import { describe, expect, test } from 'vitest';
import { moveSwipeSelection } from '../../src/server-plugin/discord/interactions.js';
import { appendAssistantMessage, createChatDocument } from '../../src/server-plugin/sillytavern/chats.js';

describe('regenerate and swipe flow', () => {
  test('previous/next updates selected swipe on same assistant message', () => {
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
      sendDate: '2026-04-17T12:00:01.000Z',
      bridgeMessageId: 'asst',
      discordMessageId: 'discord',
      discordThreadId: 'thread',
      model: 'claude-sonnet-4-6',
    });
    assistant.swipes?.push('Second');
    assistant.swipe_info?.push({ send_date: '2026-04-17T12:00:02.000Z', extra: {} });

    expect(moveSwipeSelection(chat, 'asst', 1)).toBe(1);
    expect(assistant.mes).toBe('Second');
  });
});
