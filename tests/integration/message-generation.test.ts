import { describe, expect, test } from 'vitest';
import { createChatDocument } from '../../src/server-plugin/sillytavern/chats.js';
import { runMessageGenerationFlow } from '../../src/server-plugin/discord/conversation.js';

describe('message generation flow', () => {
  test('saves user turn, calls generator, and saves assistant turn', async () => {
    const chat = createChatDocument({
      guildId: 'guild',
      forumChannelId: 'forum',
      threadId: 'thread',
      characterAvatarFile: 'Alice.png',
      chatFolderName: 'Alice',
      createdByDiscordUserId: 'user',
      createdAt: '2026-04-17T12:00:00.000Z',
    });

    const result = await runMessageGenerationFlow({
      chat,
      user: {
        discordUserId: 'user',
        discordMessageId: 'user_msg',
        discordThreadId: 'thread',
        promptName: 'Human',
        content: 'Hello',
        sendDate: '2026-04-17T12:00:01.000Z',
      },
      assistant: {
        name: 'Alice',
        bridgeMessageId: 'asst_1',
        discordMessageId: 'asst_msg',
        sendDate: '2026-04-17T12:00:02.000Z',
      },
      generate: async () => 'Hi.',
    });

    expect(result.reply).toBe('Hi.');
    expect(chat).toHaveLength(3);
    expect(chat[1]?.is_user).toBe(true);
    expect(chat[2]?.extra?.discord_bridge?.bridge_message_id).toBe('asst_1');
  });
});
