import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { createChatDocument, appendUserMessage, appendAssistantMessage } from '../../src/server-plugin/sillytavern/chats.js';
import type { BridgeCharacter } from '../../src/server-plugin/sillytavern/characters.js';
import {
  buildHeadlessPromptMessages,
  loadSillyTavernPreset,
} from '../../src/server-plugin/generation/headless-prompt-profile.js';

const character: BridgeCharacter = {
  characterAvatarFile: 'Alice.png',
  chatFolderName: 'Alice',
  name: 'Alice',
  description: 'Character sheet for {{char}} and {{user}}.',
  personality: 'Careful.',
  scenario: 'Private scene.',
  firstMes: 'Hello.',
  alternateGreetings: [],
  mesExample: '{{user}}: example\n{{char}}: reply',
  creatorNotes: 'Creator note.',
  systemPrompt: 'Character system override.',
  postHistoryInstructions: 'Card post-history instruction.',
  tags: [],
};

describe('headless prompt profile', () => {
  test('loads an OpenAI Settings preset by filename stem', async () => {
    const dataRoot = await fixtureDataRoot();
    const presetDir = path.join(dataRoot, 'default-user', 'OpenAI Settings');
    await mkdir(presetDir, { recursive: true });
    await writeFile(
      path.join(presetDir, 'Roleplay.json'),
      JSON.stringify({ jailbreak_prompt: 'Stay in character.' }),
      'utf8',
    );

    const preset = await loadSillyTavernPreset({
      dataRoot,
      userHandle: 'default-user',
      presetName: 'Roleplay',
    });

    expect(preset.filePath).toBe(path.join(presetDir, 'Roleplay.json'));
    expect(preset.raw).toMatchObject({ jailbreak_prompt: 'Stay in character.' });
  });

  test('builds prompt manager ordered messages including jailbreak and Discord persona', async () => {
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
      name: 'Rober',
      mes: 'Hello {{char}}, it is {{user}}.',
      sendDate: '2026-04-18T12:01:00.000Z',
      discordUserId: 'user',
      discordMessageId: 'user-message',
      discordThreadId: 'thread',
    });
    appendAssistantMessage(chat, {
      name: 'Alice',
      mes: 'First reply.',
      sendDate: '2026-04-18T12:02:00.000Z',
      bridgeMessageId: 'assistant',
      discordMessageId: 'assistant-message',
      discordThreadId: 'thread',
      model: 'claude-sonnet-4-6',
    });

    const messages = buildHeadlessPromptMessages({
      preset: {
        raw: {
          main_prompt: 'Main prompt for {{char}} and {{user}}.',
          nsfw_prompt: 'Aux prompt.',
          jailbreak_prompt: 'Jailbreak after history for {{char}}.',
          prompt_order: [
            {
              character_id: 100001,
              order: [
                { identifier: 'main', enabled: true },
                { identifier: 'personaDescription', enabled: true },
                { identifier: 'charDescription', enabled: true },
                { identifier: 'chatHistory', enabled: true },
                { identifier: 'jailbreak', enabled: true },
              ],
            },
          ],
        },
        filePath: 'preset.json',
      },
      character,
      profiles: {
        user: {
          enabled: true,
          promptName: 'Rober',
          displayName: 'Rober',
          persona: '{{user}} is direct and technical.',
        },
      },
      activeDiscordUserId: 'user',
      activeDiscordDisplayName: 'Fallback',
      chat,
      options: {
        defaultCharacterAvatarFile: 'Alice.png',
        includeCreatorNotes: false,
        includePostHistoryInstructions: true,
        maxHistoryMessages: 80,
        maxReplyCharacters: 1800,
      },
    });

    expect(messages.map((message) => message.content)).toEqual([
      'Main prompt for Alice and Rober.',
      'Rober is direct and technical.',
      'Character sheet for Alice and Rober.',
      'Rober: Hello Alice, it is Rober.',
      'First reply.',
      'Jailbreak after history for Alice.\nCard post-history instruction.',
    ]);
  });
});

async function fixtureDataRoot(): Promise<string> {
  return path.join(tmpdir(), `discord-bridge-preset-${Date.now()}-${Math.random()}`);
}
