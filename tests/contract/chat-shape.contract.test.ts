import { describe, expect, test } from 'vitest';
import { appendAssistantMessage, createChatDocument } from '../../src/server-plugin/sillytavern/chats.js';

describe('SillyTavern chat shape contract', () => {
  test('assistant messages keep swipe fields and bridge metadata', () => {
    const chat = createChatDocument({
      guildId: 'guild',
      forumChannelId: 'forum',
      threadId: 'thread',
      characterAvatarFile: 'Alice.png',
      chatFolderName: 'Alice',
      createdByDiscordUserId: 'user',
      createdAt: '2026-04-17T12:00:00.000Z',
    });
    const message = appendAssistantMessage(chat, {
      name: 'Alice',
      mes: 'Hello',
      sendDate: '2026-04-17T12:00:01.000Z',
      bridgeMessageId: 'asst',
      discordMessageId: 'discord',
      discordThreadId: 'thread',
      model: 'claude-sonnet-4-6',
    });

    expect(message.swipes).toEqual(['Hello']);
    expect(message.swipe_info).toHaveLength(1);
    expect(message.extra?.discord_bridge?.bridge_message_id).toBe('asst');
  });
});
