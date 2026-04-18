import { describe, expect, test, vi } from 'vitest';
import {
  createDiscordBotRuntime,
  type DiscordBotClient,
} from '../../src/server-plugin/discord/lifecycle.js';
import { parseBridgeConfig, type DiscordBridgeConfig } from '../../src/server-plugin/config/schema.js';

function enabledConfig(enabled: boolean, overrides: Partial<DiscordBridgeConfig['discord']> = {}): DiscordBridgeConfig {
  return parseBridgeConfig({
    version: 1,
    enabled,
    sillyTavernUserHandle: 'default-user',
    discord: {
      clientId: '123',
      guildId: '456',
      forumChannelId: '789',
      createForumIfMissing: false,
      forumName: 'SillyTavern',
      defaultForumTagIds: [],
      ...overrides,
    },
    access: {
      allowlistedUserIds: [],
      adminUserIds: [],
    },
    profiles: {},
    defaults: {
      defaultCharacterAvatarFile: '',
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
  });
}

function fakeClient(): DiscordBotClient & {
  login: ReturnType<typeof vi.fn<(token: string) => Promise<string>>>;
  destroy: ReturnType<typeof vi.fn<() => void>>;
} {
  let ready = false;
  return {
    user: { tag: 'Bridge#0001' },
    isReady: () => ready,
    login: vi.fn(async (_token: string) => {
      ready = true;
      return 'logged-in';
    }),
    destroy: vi.fn(() => {
      ready = false;
    }),
  };
}

describe('Discord bot lifecycle', () => {
  test('does not create a client when the bridge is disabled', async () => {
    const createClient = vi.fn(fakeClient);
    const runtime = createDiscordBotRuntime({
      createClient,
      readConfig: async () => enabledConfig(false),
      readSecrets: async () => ({ discordBotToken: 'token' }),
    });

    const status = await runtime.reconcile();

    expect(status.state).toBe('disabled');
    expect(createClient).not.toHaveBeenCalled();
  });

  test('does not create a client when the bot token is missing', async () => {
    const createClient = vi.fn(fakeClient);
    const runtime = createDiscordBotRuntime({
      createClient,
      readConfig: async () => enabledConfig(true),
      readSecrets: async () => ({}),
    });

    const status = await runtime.reconcile();

    expect(status.state).toBe('missing-token');
    expect(createClient).not.toHaveBeenCalled();
  });

  test('logs in when the bridge is enabled and a token exists', async () => {
    const client = fakeClient();
    const runtime = createDiscordBotRuntime({
      createClient: () => client,
      readConfig: async () => enabledConfig(true),
      readSecrets: async () => ({ discordBotToken: 'token' }),
      registerCommands: async () => undefined,
    });

    const status = await runtime.reconcile();

    expect(client.login).toHaveBeenCalledWith('token');
    expect(status.state).toBe('ready');
    expect(status.ready).toBe(true);
    expect(status.userTag).toBe('Bridge#0001');
  });

  test('registers guild slash commands before reporting ready', async () => {
    const client = fakeClient();
    const registerCommands = vi.fn(async () => undefined);
    const runtime = createDiscordBotRuntime({
      createClient: () => client,
      readConfig: async () => enabledConfig(true),
      readSecrets: async () => ({ discordBotToken: 'token' }),
      registerCommands,
    });

    const status = await runtime.reconcile();

    expect(registerCommands).toHaveBeenCalledWith({
      token: 'token',
      clientId: '123',
      guildId: '456',
    });
    expect(status.state).toBe('ready');
  });

  test('re-registers guild slash commands when the target guild changes', async () => {
    let guildId = '456';
    const client = fakeClient();
    const registerCommands = vi.fn(async () => undefined);
    const runtime = createDiscordBotRuntime({
      createClient: () => client,
      readConfig: async () => enabledConfig(true, { guildId }),
      readSecrets: async () => ({ discordBotToken: 'token' }),
      registerCommands,
    });

    await runtime.reconcile();
    guildId = '999';
    await runtime.reconcile();

    expect(client.login).toHaveBeenCalledTimes(1);
    expect(registerCommands).toHaveBeenCalledTimes(2);
    expect(registerCommands).toHaveBeenLastCalledWith({
      token: 'token',
      clientId: '123',
      guildId: '999',
    });
  });

  test('recovers status after command registration fails and later succeeds', async () => {
    const client = fakeClient();
    let shouldFail = true;
    const runtime = createDiscordBotRuntime({
      createClient: () => client,
      readConfig: async () => enabledConfig(true),
      readSecrets: async () => ({ discordBotToken: 'token' }),
      registerCommands: async () => {
        if (shouldFail) {
          throw new Error('missing applications.commands scope');
        }
      },
    });

    const failed = await runtime.reconcile();
    shouldFail = false;
    const recovered = await runtime.reconcile();

    expect(failed.state).toBe('error');
    expect(recovered.state).toBe('ready');
    expect(recovered.ready).toBe(true);
  });

  test('restarts the client when the saved token changes', async () => {
    let token = 'old-token';
    const firstClient = fakeClient();
    const secondClient = fakeClient();
    const createClient = vi.fn<() => DiscordBotClient>()
      .mockReturnValueOnce(firstClient)
      .mockReturnValueOnce(secondClient);
    const runtime = createDiscordBotRuntime({
      createClient,
      readConfig: async () => enabledConfig(true),
      readSecrets: async () => ({ discordBotToken: token }),
      registerCommands: async () => undefined,
    });

    await runtime.reconcile();
    token = 'new-token';
    await runtime.reconcile();

    expect(firstClient.destroy).toHaveBeenCalledTimes(1);
    expect(secondClient.login).toHaveBeenCalledWith('new-token');
  });

  test('stops and destroys the active client', async () => {
    const client = fakeClient();
    const runtime = createDiscordBotRuntime({
      createClient: () => client,
      readConfig: async () => enabledConfig(true),
      readSecrets: async () => ({ discordBotToken: 'token' }),
      registerCommands: async () => undefined,
    });

    await runtime.reconcile();
    const status = await runtime.stop();

    expect(client.destroy).toHaveBeenCalledTimes(1);
    expect(status.state).toBe('stopped');
  });
});
