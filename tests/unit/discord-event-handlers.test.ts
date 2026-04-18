import { describe, expect, test, vi } from 'vitest';
import { attachDiscordEventHandlers } from '../../src/server-plugin/discord/event-handlers.js';
import type {
  BridgeDiscordApi,
  BridgeRuntime,
} from '../../src/server-plugin/bridge/runtime.js';
import type { BridgeCharacter } from '../../src/server-plugin/sillytavern/characters.js';

function fakeRuntime(): BridgeRuntime & {
  listCharacters: ReturnType<typeof vi.fn<() => Promise<BridgeCharacter[]>>>;
  startNewConversation: ReturnType<typeof vi.fn>;
  handleThreadMessage: ReturnType<typeof vi.fn>;
  handleSwipe: ReturnType<typeof vi.fn>;
  setPersona: ReturnType<typeof vi.fn>;
} {
  return {
    listCharacters: vi.fn(async () => [
      {
        name: 'Alice',
        characterAvatarFile: 'Alice.png',
        chatFolderName: 'Alice',
        description: '',
        personality: '',
        scenario: '',
        firstMes: '',
        alternateGreetings: [],
        mesExample: '',
        creatorNotes: '',
        systemPrompt: '',
        postHistoryInstructions: '',
        tags: [],
      },
    ]),
    getConversation: vi.fn(async () => ({
      guildId: 'guild',
      forumChannelId: 'forum',
      threadId: 'thread-1',
      starterMessageId: 'starter',
      chatFileName: 'chat.jsonl',
      chatFolderName: 'Alice',
      characterAvatarFile: 'Alice.png',
      characterName: 'Alice',
      createdByDiscordUserId: 'user-1',
      createdAt: '2026-04-18T00:00:00.000Z',
      updatedAt: '2026-04-18T00:00:00.000Z',
    })),
    startNewConversation: vi.fn(async () => ({
      threadId: 'thread-1',
      state: {} as never,
    })),
    handleThreadMessage: vi.fn(async () => ({ kind: 'replied' as const, reply: 'ok', assistantDiscordMessageId: 'msg-2' })),
    handleSwipe: vi.fn(async () => ({ kind: 'updated' as const, selectedIndex: 1, total: 2 })),
    setPersona: vi.fn(async () => ({
      enabled: true,
      promptName: 'Rober',
      displayName: 'Rober',
      persona: 'A practical operator.',
    })),
  };
}

function fakeClient() {
  const handlers = new Map<string, (...args: unknown[]) => Promise<void>>();
  return {
    handlers,
    on: vi.fn((eventName: string, handler: (...args: unknown[]) => Promise<void>) => {
      handlers.set(eventName, handler);
      return undefined;
    }),
  };
}

const discord = {} as BridgeDiscordApi;

describe('Discord event handlers', () => {
  test('responds to character autocomplete', async () => {
    const runtime = fakeRuntime();
    const client = fakeClient();
    attachDiscordEventHandlers(client, runtime, discord);

    const respond = vi.fn(async () => undefined);
    await client.handlers.get('interactionCreate')?.({
      isAutocomplete: () => true,
      commandName: 'st',
      options: { getFocused: () => 'ali' },
      respond,
    });

    expect(respond).toHaveBeenCalledWith([
      { name: 'Alice (Alice.png)', value: 'Alice.png' },
    ]);
  });

  test('starts a conversation from /st new', async () => {
    const runtime = fakeRuntime();
    const client = fakeClient();
    attachDiscordEventHandlers(client, runtime, discord);
    const deferReply = vi.fn(async () => undefined);
    const editReply = vi.fn(async () => undefined);

    await client.handlers.get('interactionCreate')?.({
      isAutocomplete: () => false,
      isChatInputCommand: () => true,
      commandName: 'st',
      user: { id: 'user-1' },
      options: {
        getSubcommand: () => 'new',
        getString: () => 'Alice.png',
      },
      deferReply,
      editReply,
    });

    expect(deferReply).toHaveBeenCalledWith({ ephemeral: true });
    expect(runtime.startNewConversation).toHaveBeenCalledWith({
      discordUserId: 'user-1',
      characterAvatarFile: 'Alice.png',
      discord,
    });
    expect(editReply).toHaveBeenCalledWith({ content: 'Created <#thread-1>.' });
  });

  test('routes normal thread messages to generation runtime', async () => {
    const runtime = fakeRuntime();
    const client = fakeClient();
    attachDiscordEventHandlers(client, runtime, discord);

    await client.handlers.get('messageCreate')?.({
      id: 'message-1',
      channelId: 'thread-1',
      content: 'Hello',
      author: { id: 'user-1', bot: false, username: 'rober' },
      member: { displayName: 'Rober' },
    });

    expect(runtime.handleThreadMessage).toHaveBeenCalledWith({
      threadId: 'thread-1',
      discordUserId: 'user-1',
      discordDisplayName: 'Rober',
      discordMessageId: 'message-1',
      content: 'Hello',
      discord,
    });
  });

  test('routes swipe buttons to the runtime', async () => {
    const runtime = fakeRuntime();
    const client = fakeClient();
    attachDiscordEventHandlers(client, runtime, discord);
    const deferUpdate = vi.fn(async () => undefined);

    await client.handlers.get('interactionCreate')?.({
      isAutocomplete: () => false,
      isChatInputCommand: () => false,
      isButton: () => true,
      customId: 'stb:v1:swipe_next:thread-1:bridge-1',
      user: { id: 'user-1' },
      deferUpdate,
    });

    expect(deferUpdate).toHaveBeenCalledTimes(1);
    expect(runtime.handleSwipe).toHaveBeenCalledWith({
      customId: 'stb:v1:swipe_next:thread-1:bridge-1',
      discordUserId: 'user-1',
      discord,
    });
  });

  test('routes /persona set to the runtime', async () => {
    const runtime = fakeRuntime();
    const client = fakeClient();
    attachDiscordEventHandlers(client, runtime, discord);
    const reply = vi.fn(async () => undefined);

    await client.handlers.get('interactionCreate')?.({
      isAutocomplete: () => false,
      isChatInputCommand: () => true,
      commandName: 'persona',
      user: { id: 'user-1', username: 'rober' },
      member: { displayName: 'Rober' },
      options: {
        getSubcommand: () => 'set',
        getString: (name: string) => (name === 'name' ? 'Rober' : 'A practical operator.'),
      },
      reply,
    });

    expect(runtime.setPersona).toHaveBeenCalledWith({
      discordUserId: 'user-1',
      discordDisplayName: 'Rober',
      displayName: 'Rober',
      persona: 'A practical operator.',
    });
    expect(reply).toHaveBeenCalledWith({
      content: 'Persona saved for Rober.',
      ephemeral: true,
    });
  });
});
