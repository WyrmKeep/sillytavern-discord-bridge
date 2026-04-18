import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, test } from 'vitest';
import { createBridgeRuntime } from '../../src/server-plugin/bridge/runtime.js';
import { resolveBridgePaths } from '../../src/server-plugin/config/paths.js';
import { parseBridgeConfig } from '../../src/server-plugin/config/schema.js';
import { readConfig, writeConfig } from '../../src/server-plugin/config/store.js';
import { buildChatFilePath, parseJsonlChat } from '../../src/server-plugin/sillytavern/chats.js';
import { readState } from '../../src/server-plugin/state/store.js';
import { encodeSwipeCustomId } from '../../src/server-plugin/discord/components.js';

describe('bridge runtime', () => {
  test('creates a forum conversation and matching ST chat file', async () => {
    const fixture = await createRuntimeFixture();
    const runtime = createBridgeRuntime({
      paths: fixture.paths,
      now: () => new Date('2026-04-18T12:00:00.000Z'),
      generateReply: async () => 'unused',
    });

    const result = await runtime.startNewConversation({
      discordUserId: 'user',
      characterAvatarFile: 'Alice.json',
      discord: fixture.discord,
    });

    const state = await readState(fixture.paths.stateFile);
    const chatFilePath = buildChatFilePath(
      fixture.paths.dataRoot,
      'default-user',
      'Alice',
      result.state.chatFileName,
    );
    const chat = parseJsonlChat(await readFile(chatFilePath, 'utf8'));

    expect(result.threadId).toBe('thread-1');
    expect(state.conversations['thread-1']?.chatFolderName).toBe('Alice');
    expect(chat[0]?.chat_metadata?.discord_bridge).toMatchObject({
      thread_id: 'thread-1',
      character_avatar_file: 'Alice.json',
    });
    expect(fixture.discord.createdThreads[0]).toMatchObject({
      forumChannelId: 'forum',
      title: 'Alice - 2026-04-18',
      firstMessage: 'Hello from Alice.',
    });
  });

  test('saves user and assistant messages for a mapped thread', async () => {
    const fixture = await createRuntimeFixture();
    const runtime = createBridgeRuntime({
      paths: fixture.paths,
      now: () => new Date('2026-04-18T12:00:00.000Z'),
      generateReply: async () => 'Hi from Claude.',
    });
    const conversation = await runtime.startNewConversation({
      discordUserId: 'user',
      characterAvatarFile: 'Alice.json',
      discord: fixture.discord,
    });

    const result = await runtime.handleThreadMessage({
      threadId: conversation.threadId,
      discordUserId: 'user',
      discordMessageId: 'user-message-1',
      content: 'Hello',
      discord: fixture.discord,
    });

    const state = await readState(fixture.paths.stateFile);
    const chatFilePath = buildChatFilePath(
      fixture.paths.dataRoot,
      'default-user',
      'Alice',
      conversation.state.chatFileName,
    );
    const chat = parseJsonlChat(await readFile(chatFilePath, 'utf8'));

    expect(result).toMatchObject({ kind: 'replied', reply: 'Hi from Claude.' });
    expect(chat.map((message) => message.mes)).toEqual([undefined, 'Hello', 'Hi from Claude.']);
    expect(state.conversations[conversation.threadId]?.lastAssistantBridgeMessageId).toBeDefined();
    expect(fixture.discord.threadMessages.at(-1)).toMatchObject({
      threadId: conversation.threadId,
      content: 'Hi from Claude.',
    });
  });

  test('regenerates an assistant message as a persisted swipe and edits Discord', async () => {
    const fixture = await createRuntimeFixture();
    let reply = 'First reply.';
    const runtime = createBridgeRuntime({
      paths: fixture.paths,
      now: () => new Date('2026-04-18T12:00:00.000Z'),
      generateReply: async () => reply,
    });
    const conversation = await runtime.startNewConversation({
      discordUserId: 'user',
      characterAvatarFile: 'Alice.json',
      discord: fixture.discord,
    });
    await runtime.handleThreadMessage({
      threadId: conversation.threadId,
      discordUserId: 'user',
      discordMessageId: 'user-message-1',
      content: 'Hello',
      discord: fixture.discord,
    });
    const stateBefore = await readState(fixture.paths.stateFile);
    const bridgeMessageId = stateBefore.conversations[conversation.threadId]?.lastAssistantBridgeMessageId;
    reply = 'Second reply.';

    const result = await runtime.handleSwipe({
      customId: encodeSwipeCustomId('swipe_regen', conversation.threadId, bridgeMessageId ?? ''),
      discordUserId: 'user',
      discord: fixture.discord,
    });

    const chatFilePath = buildChatFilePath(
      fixture.paths.dataRoot,
      'default-user',
      'Alice',
      conversation.state.chatFileName,
    );
    const chat = parseJsonlChat(await readFile(chatFilePath, 'utf8'));
    const assistant = chat[2];

    expect(result).toEqual({ kind: 'updated', selectedIndex: 1, total: 2 });
    expect(assistant?.swipes).toEqual(['First reply.', 'Second reply.']);
    expect(assistant?.mes).toBe('Second reply.');
    expect(fixture.discord.editedMessages.at(-1)).toMatchObject({
      threadId: conversation.threadId,
      content: 'Second reply.',
    });
  });

  test('saves a Discord user persona into bridge config', async () => {
    const fixture = await createRuntimeFixture();
    const runtime = createBridgeRuntime({
      paths: fixture.paths,
      now: () => new Date('2026-04-18T12:00:00.000Z'),
      generateReply: async () => 'unused',
    });

    const profile = await runtime.setPersona({
      discordUserId: 'user',
      discordDisplayName: 'Fallback Name',
      displayName: 'Rober',
      persona: 'Direct and technical.',
    });

    const config = await readConfig(fixture.paths.configFile);
    expect(profile).toEqual({
      enabled: true,
      promptName: 'Rober',
      displayName: 'Rober',
      persona: 'Direct and technical.',
    });
    expect(config.profiles.user).toEqual(profile);
  });

  test('replaces user macros in the Discord starter message', async () => {
    const fixture = await createRuntimeFixture({
      firstMes: '{{char}} greets {{user}}.',
    });
    const runtime = createBridgeRuntime({
      paths: fixture.paths,
      now: () => new Date('2026-04-18T12:00:00.000Z'),
      generateReply: async () => 'unused',
    });

    await runtime.startNewConversation({
      discordUserId: 'user',
      discordDisplayName: 'Fallback Name',
      characterAvatarFile: 'Alice.json',
      discord: fixture.discord,
    });

    expect(fixture.discord.createdThreads[0]?.firstMessage).toBe('Alice greets Friend.');
  });
});

async function createRuntimeFixture(options: { firstMes?: string } = {}) {
  const dataRoot = path.join(tmpdir(), `discord-bridge-runtime-${Date.now()}-${Math.random()}`);
  const paths = resolveBridgePaths(dataRoot);
  await writeConfig(
    paths.configFile,
    parseBridgeConfig({
      version: 1,
      enabled: true,
      sillyTavernUserHandle: 'default-user',
      discord: {
        clientId: 'client',
        guildId: 'guild',
        forumChannelId: 'forum',
        createForumIfMissing: false,
        forumName: 'SillyTavern',
        defaultForumTagIds: ['tag'],
      },
      access: {
        allowlistedUserIds: ['user'],
        adminUserIds: ['user'],
      },
      profiles: {
        user: {
          enabled: true,
          promptName: 'Human',
          displayName: 'Friend',
          persona: 'A test participant.',
        },
      },
      defaults: {
        defaultCharacterAvatarFile: 'Alice.json',
        maxHistoryMessages: 80,
        maxReplyCharacters: 1800,
        includeCreatorNotes: false,
        includePostHistoryInstructions: true,
      },
      behavior: {
        ignoreBotMessages: true,
        rejectNonAllowlistedUsers: 'silent',
        attachmentMode: 'ignore-with-note',
        conversationTitleFormat: '{{character}} - {{date}}',
      },
    }),
  );
  const charactersDir = path.join(dataRoot, 'default-user', 'characters');
  await mkdir(charactersDir, { recursive: true });
  await writeFile(
    path.join(charactersDir, 'Alice.json'),
    JSON.stringify({
      data: {
        name: 'Alice',
        description: 'A test character.',
        first_mes: options.firstMes ?? 'Hello from Alice.',
      },
    }),
    'utf8',
  );

  const discord = new FakeDiscordApi();
  return { paths, discord };
}

class FakeDiscordApi {
  createdThreads: Array<{
    forumChannelId: string;
    title: string;
    firstMessage: string;
    appliedTagIds: string[];
  }> = [];
  threadMessages: Array<{ threadId: string; content: string }> = [];
  editedMessages: Array<{ threadId: string; messageId: string; content: string }> = [];
  private messageCounter = 0;

  async createForumThread(input: {
    forumChannelId: string;
    title: string;
    firstMessage: string;
    appliedTagIds: string[];
  }) {
    this.createdThreads.push(input);
    return { threadId: 'thread-1', starterMessageId: 'starter-1' };
  }

  async sendThreadMessage(input: { threadId: string; content: string }) {
    this.messageCounter += 1;
    this.threadMessages.push(input);
    return { messageId: `assistant-message-${this.messageCounter}` };
  }

  async editMessage(input: { threadId: string; messageId: string; content: string }) {
    this.editedMessages.push(input);
    return undefined;
  }
}
