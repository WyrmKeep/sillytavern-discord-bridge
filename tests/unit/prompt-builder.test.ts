import { describe, expect, test } from 'vitest';
import { createChatDocument, appendAssistantMessage, appendUserMessage } from '../../src/server-plugin/sillytavern/chats.js';
import { buildBridgePrompt, fallbackStarterMessage } from '../../src/server-plugin/generation/prompt-builder.js';
import type { BridgeCharacter } from '../../src/server-plugin/sillytavern/characters.js';

const character: BridgeCharacter = {
  characterAvatarFile: 'Alice.png',
  chatFolderName: 'Alice',
  name: 'Alice',
  description: 'A precise assistant.',
  personality: 'Careful.',
  scenario: 'A private bridge.',
  firstMes: '',
  alternateGreetings: [],
  mesExample: 'Example text.',
  creatorNotes: 'Creator note.',
  systemPrompt: 'System prompt.',
  postHistoryInstructions: 'Post history.',
  tags: [],
};

describe('prompt builder', () => {
  test('honors creator notes and post-history settings', () => {
    const prompt = buildBridgePrompt({
      character,
      profiles: {},
      chat: createChatDocument({
        guildId: 'guild',
        forumChannelId: 'forum',
        threadId: 'thread',
        characterAvatarFile: 'Alice.png',
        chatFolderName: 'Alice',
        createdByDiscordUserId: 'user',
        createdAt: '2026-04-17T12:00:00.000Z',
      }),
      options: {
        includeCreatorNotes: true,
        includePostHistoryInstructions: true,
        maxHistoryMessages: 80,
        maxReplyCharacters: 1000,
      },
    });

    expect(prompt.system.join('\n')).toContain('Creator note.');
    expect(prompt.system.join('\n')).toContain('Post history.');
  });

  test('formats user messages by profile prompt name and uses selected assistant swipe', () => {
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
      name: 'Display',
      mes: 'Hello',
      sendDate: '2026-04-17T12:00:01.000Z',
      discordUserId: 'user',
      discordMessageId: 'msg',
      discordThreadId: 'thread',
    });
    const assistant = appendAssistantMessage(chat, {
      name: 'Alice',
      mes: 'First',
      sendDate: '2026-04-17T12:00:02.000Z',
      bridgeMessageId: 'asst',
      discordMessageId: 'asst_msg',
      discordThreadId: 'thread',
      model: 'claude-sonnet-4-6',
    });
    assistant.swipes = ['First', 'Second'];
    assistant.swipe_id = 1;

    const prompt = buildBridgePrompt({
      character,
      profiles: {
        user: {
          enabled: true,
          promptName: 'Human',
          displayName: 'Display',
          persona: 'A tester.',
        },
      },
      chat,
      options: {
        includeCreatorNotes: false,
        includePostHistoryInstructions: false,
        maxHistoryMessages: 80,
        maxReplyCharacters: 1000,
      },
    });

    expect(prompt.messages).toEqual([
      { role: 'user', content: 'Human: Hello' },
      { role: 'assistant', content: 'Second' },
    ]);
  });

  test('uses a documented fallback for empty first messages', () => {
    expect(fallbackStarterMessage(character)).toBe('Alice is ready to begin.');
  });
});
