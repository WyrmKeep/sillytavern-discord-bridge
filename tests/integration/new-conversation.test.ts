import { describe, expect, test } from 'vitest';
import { createNewConversation } from '../../src/server-plugin/discord/conversation.js';

describe('new conversation flow', () => {
  test('creates thread state, chat document, and starter payload', () => {
    const result = createNewConversation({
      guildId: 'guild',
      forumChannelId: 'forum',
      threadId: 'thread',
      starterMessageId: 'starter',
      characterAvatarFile: 'Alice.png',
      characterName: 'Alice',
      firstMes: 'Hello from Alice.',
      createdByDiscordUserId: 'user',
      createdAt: '2026-04-17T12:00:00.000Z',
    });

    expect(result.state.chatFolderName).toBe('Alice');
    expect(result.state.chatFileName).toBe('20260417T120000000Z--thread.jsonl');
    expect(result.chat[0]?.chat_metadata?.discord_bridge).toMatchObject({
      thread_id: 'thread',
      chat_folder_name: 'Alice',
    });
    expect(result.starterMessages).toEqual(['Hello from Alice.']);
  });
});
