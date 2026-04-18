import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, test, vi } from 'vitest';
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

  test('lists only characters with configured exposed SillyTavern tags', async () => {
    const fixture = await createRuntimeFixture({ exposedCharacterTags: ['discord'] });
    await writeCharacter(fixture.paths.dataRoot, 'Bob.json', 'Bob');
    await writeTags(fixture.paths.dataRoot, {
      'Alice.json': ['tag-discord'],
      'Bob.json': ['tag-private'],
    });
    const runtime = createBridgeRuntime({
      paths: fixture.paths,
      now: () => new Date('2026-04-18T12:00:00.000Z'),
      generateReply: async () => 'unused',
    });

    await expect(runtime.listCharacters()).resolves.toEqual([
      expect.objectContaining({ characterAvatarFile: 'Alice.json' }),
    ]);
  });

  test('rejects manually entered unexposed character filenames for new conversations', async () => {
    const fixture = await createRuntimeFixture({ exposedCharacterTags: ['discord'] });
    await writeCharacter(fixture.paths.dataRoot, 'Bob.json', 'Bob');
    await writeTags(fixture.paths.dataRoot, {
      'Alice.json': ['tag-discord'],
      'Bob.json': ['tag-private'],
    });
    const runtime = createBridgeRuntime({
      paths: fixture.paths,
      now: () => new Date('2026-04-18T12:00:00.000Z'),
      generateReply: async () => 'unused',
    });

    await expect(runtime.startNewConversation({
      discordUserId: 'user',
      characterAvatarFile: 'Bob.json',
      discord: fixture.discord,
    })).rejects.toThrow(/not exposed/i);
  });

  test('continues existing conversations after the exposed tag is removed', async () => {
    const fixture = await createRuntimeFixture({ exposedCharacterTags: ['discord'] });
    await writeTags(fixture.paths.dataRoot, {
      'Alice.json': ['tag-discord'],
    });
    const runtime = createBridgeRuntime({
      paths: fixture.paths,
      now: () => new Date('2026-04-18T12:00:00.000Z'),
      generateReply: async () => 'Hi after tag removal.',
    });
    const conversation = await runtime.startNewConversation({
      discordUserId: 'user',
      characterAvatarFile: 'Alice.json',
      discord: fixture.discord,
    });
    await writeTags(fixture.paths.dataRoot, {});

    const result = await runtime.handleThreadMessage({
      threadId: conversation.threadId,
      discordUserId: 'user',
      discordMessageId: 'user-message-1',
      content: 'Still there?',
      discord: fixture.discord,
    });

    expect(result).toMatchObject({ kind: 'replied', reply: 'Hi after tag removal.' });
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

  test('shows message activity feedback and cleans it up after a reply is sent', async () => {
    const fixture = await createRuntimeFixture();
    const activityTimers = createActivityTimers();
    let resolveReply: (reply: string) => void = () => undefined;
    const replyPromise = new Promise<string>((resolve) => {
      resolveReply = resolve;
    });
    const runtime = createBridgeRuntime({
      paths: fixture.paths,
      now: () => new Date('2026-04-18T12:00:00.000Z'),
      generateReply: async () => replyPromise,
      activityTimers,
    } as never);
    const conversation = await runtime.startNewConversation({
      discordUserId: 'user',
      characterAvatarFile: 'Alice.json',
      discord: fixture.discord,
    });

    const pending = runtime.handleThreadMessage({
      threadId: conversation.threadId,
      discordUserId: 'user',
      discordMessageId: 'user-message-1',
      content: 'Hello',
      discord: fixture.discord,
    });
    await vi.waitFor(() => {
      expect(fixture.discord.typingEvents).toEqual([conversation.threadId]);
      expect(fixture.discord.addedReactions).toContainEqual({
        threadId: conversation.threadId,
        messageId: 'user-message-1',
        emoji: '\u{23F3}',
      });
      expect(activityTimers.setInterval).toHaveBeenCalledWith(expect.any(Function), 8000);
    });

    activityTimers.fireAll();
    expect(fixture.discord.typingEvents).toEqual([conversation.threadId, conversation.threadId]);

    resolveReply('Hi from Claude.');
    await pending;

    expect(activityTimers.clearInterval).toHaveBeenCalledWith('timer-1');
    expect(fixture.discord.removedReactions).toContainEqual({
      threadId: conversation.threadId,
      messageId: 'user-message-1',
      emoji: '\u{23F3}',
    });
  });

  test('clears typing feedback and marks the source message on generation errors', async () => {
    const fixture = await createRuntimeFixture();
    const activityTimers = createActivityTimers();
    const runtime = createBridgeRuntime({
      paths: fixture.paths,
      now: () => new Date('2026-04-18T12:00:00.000Z'),
      generateReply: async () => {
        throw new Error('generation failed');
      },
      activityTimers,
    } as never);
    const conversation = await runtime.startNewConversation({
      discordUserId: 'user',
      characterAvatarFile: 'Alice.json',
      discord: fixture.discord,
    });

    await expect(runtime.handleThreadMessage({
      threadId: conversation.threadId,
      discordUserId: 'user',
      discordMessageId: 'user-message-1',
      content: 'Hello',
      discord: fixture.discord,
    })).rejects.toThrow(/generation failed/i);

    expect(activityTimers.clearInterval).toHaveBeenCalledWith('timer-1');
    expect(fixture.discord.removedReactions).toContainEqual({
      threadId: conversation.threadId,
      messageId: 'user-message-1',
      emoji: '\u{23F3}',
    });
    expect(fixture.discord.addedReactions).toContainEqual({
      threadId: conversation.threadId,
      messageId: 'user-message-1',
      emoji: '\u{274C}',
    });
  });

  test('does not let activity feedback permission errors block generation', async () => {
    const fixture = await createRuntimeFixture();
    fixture.discord.failActivityCalls = true;
    const runtime = createBridgeRuntime({
      paths: fixture.paths,
      now: () => new Date('2026-04-18T12:00:00.000Z'),
      generateReply: async () => 'Hi despite activity failures.',
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

    expect(result).toMatchObject({ kind: 'replied', reply: 'Hi despite activity failures.' });
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

  test('generates through the configured headless ST preset and backend endpoint', async () => {
    const fixture = await createRuntimeFixture({ presetName: 'Roleplay' });
    await writeHeadlessGenerationFixtures(fixture.paths.dataRoot);
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === 'http://127.0.0.1:8000/csrf-token') {
        return new Response(JSON.stringify({ token: 'csrf-token' }), {
          headers: {
            'content-type': 'application/json',
            'set-cookie': 'session=value; Path=/; HttpOnly',
          },
        });
      }

      expect(url).toBe('http://127.0.0.1:8000/api/backends/chat-completions/generate');
      const body = JSON.parse(String(init?.body)) as {
        messages: Array<{ role: string; content: string }>;
        assistant_prefill?: string;
        custom_prompt_post_processing?: string;
        proxy_password?: string;
      };
      const promptText = body.messages.map((message) => message.content).join('\n');
      expect(promptText).toContain('Jailbreak after Friend and Alice: 240.');
      expect(promptText).not.toContain('{{');
      expect(body.custom_prompt_post_processing).toBeUndefined();
      expect(body.messages.map((message) => message.content)).not.toContain('Assistant prefill.');
      expect(body.assistant_prefill).toBe('Assistant prefill.');
      expect(body.proxy_password).toBe('proxy-secret');
      return new Response('Generated by ST.');
    });
    const runtime = createBridgeRuntime({
      paths: fixture.paths,
      now: () => new Date('2026-04-18T12:00:00.000Z'),
      fetchImpl,
      sillyTavernBaseUrl: 'http://127.0.0.1:8000',
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

    expect(result).toMatchObject({ kind: 'replied', reply: 'Generated by ST.' });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
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

async function createRuntimeFixture(options: {
  firstMes?: string;
  presetName?: string;
  exposedCharacterTags?: string[];
} = {}) {
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
        exposedCharacterTags: options.exposedCharacterTags ?? [],
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
      generation: {
        promptMode: 'headless-st-preset',
        sillyTavernPresetName: options.presetName ?? '',
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
        showTypingIndicator: true,
        processingReactionEmoji: '\u{23F3}',
        errorReactionEmoji: '\u{274C}',
      },
    }),
  );
  await writeCharacter(dataRoot, 'Alice.json', 'Alice', options.firstMes ?? 'Hello from Alice.');

  const discord = new FakeDiscordApi();
  return { paths, discord };
}

async function writeCharacter(
  dataRoot: string,
  avatarFile: string,
  name: string,
  firstMes = `Hello from ${name}.`,
): Promise<void> {
  const charactersDir = path.join(dataRoot, 'default-user', 'characters');
  await mkdir(charactersDir, { recursive: true });
  await writeFile(
    path.join(charactersDir, avatarFile),
    JSON.stringify({
      data: {
        name,
        description: `A test character named ${name}.`,
        first_mes: firstMes,
      },
    }),
    'utf8',
  );
}

async function writeTags(dataRoot: string, tagMap: Record<string, string[]>): Promise<void> {
  const userRoot = path.join(dataRoot, 'default-user');
  await mkdir(userRoot, { recursive: true });
  await writeFile(
    path.join(userRoot, 'tags.json'),
    JSON.stringify({
      tags: [
        { id: 'tag-discord', name: 'Discord' },
        { id: 'tag-private', name: 'Private' },
      ],
      tag_map: tagMap,
    }),
    'utf8',
  );
}

async function writeHeadlessGenerationFixtures(dataRoot: string): Promise<void> {
  const userRoot = path.join(dataRoot, 'default-user');
  await mkdir(path.join(userRoot, 'OpenAI Settings'), { recursive: true });
  await writeFile(
    path.join(userRoot, 'settings.json'),
    JSON.stringify({
      main_api: 'openai',
      oai_settings: {
        chat_completion_source: 'claude',
        reverse_proxy: 'http://example.invalid/v1/claude',
        proxy_password: 'proxy-secret',
        claude_model: 'claude-sonnet-4-6',
        openai_max_tokens: 400,
        temp_openai: 0.7,
        top_p_openai: 1,
        top_k_openai: 40,
        assistant_prefill: 'Assistant prefill.',
        use_sysprompt: true,
      },
    }),
    'utf8',
  );
  await writeFile(
    path.join(userRoot, 'OpenAI Settings', 'Roleplay.json'),
    JSON.stringify({
      prompts: [
        {
          identifier: 'jailbreak',
          role: 'system',
          content: [
            {
              type: 'text',
              text: 'Jailbreak after {{user}} and {{char}}: {{random:240,240,240}}.',
            },
          ],
        },
      ],
      prompt_order: [
        {
          character_id: 100001,
          order: [
            { identifier: 'main', enabled: true },
            { identifier: 'chatHistory', enabled: true },
            { identifier: 'jailbreak', enabled: true },
          ],
        },
      ],
    }),
    'utf8',
  );
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
  typingEvents: string[] = [];
  addedReactions: Array<{ threadId: string; messageId: string; emoji: string }> = [];
  removedReactions: Array<{ threadId: string; messageId: string; emoji: string }> = [];
  failActivityCalls = false;
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

  async startTyping(threadId: string) {
    if (this.failActivityCalls) {
      throw new Error('missing typing permission');
    }
    this.typingEvents.push(threadId);
  }

  async addReaction(input: { threadId: string; messageId: string; emoji: string }) {
    if (this.failActivityCalls) {
      throw new Error('missing reaction permission');
    }
    this.addedReactions.push(input);
  }

  async removeReaction(input: { threadId: string; messageId: string; emoji: string }) {
    if (this.failActivityCalls) {
      throw new Error('missing reaction permission');
    }
    this.removedReactions.push(input);
  }
}

function createActivityTimers() {
  const callbacks: Array<() => void> = [];
  const timers = {
    setInterval: vi.fn((callback: () => void, _milliseconds: number) => {
      callbacks.push(callback);
      return `timer-${callbacks.length}`;
    }),
    clearInterval: vi.fn(),
    fireAll: () => {
      for (const callback of callbacks) {
        callback();
      }
    },
  };
  return timers;
}
