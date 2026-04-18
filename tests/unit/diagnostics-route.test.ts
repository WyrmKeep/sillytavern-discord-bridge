import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import settingsFixture from '../fixtures/settings/st-claude-reverse-proxy.json' with { type: 'json' };
import { afterEach, describe, expect, test, vi } from 'vitest';
import { registerDiagnosticRoutes } from '../../src/server-plugin/routes/diagnostics.js';
import { resolveBridgePaths } from '../../src/server-plugin/config/paths.js';
import { writeConfig } from '../../src/server-plugin/config/store.js';
import { parseBridgeConfig } from '../../src/server-plugin/config/schema.js';

describe('diagnostic routes', () => {
  afterEach(() => {
    delete process.env.SILLYTAVERN_DATA_ROOT;
  });

  test('reports normalized SillyTavern Claude settings without leaking proxy details', async () => {
    const dataRoot = path.join(tmpdir(), `discord-bridge-diagnostics-${Date.now()}`);
    process.env.SILLYTAVERN_DATA_ROOT = dataRoot;
    const paths = resolveBridgePaths(dataRoot);
    await writeConfig(paths.configFile, bridgeConfig('friend'));
    await mkdir(path.join(dataRoot, 'friend'), { recursive: true });
    await writeFile(
      path.join(dataRoot, 'friend', 'settings.json'),
      JSON.stringify(settingsFixture),
      'utf8',
    );

    const handler = registerAndGetHandler();
    const response = new FakeResponse();
    handler({}, response);
    await response.done;

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      ok: true,
      mainApi: 'openai',
      chatCompletionSource: 'claude',
      model: 'claude-sonnet-4-6',
      reverseProxy: '<configured>',
      proxyPassword: '<missing>',
      stream: false,
      originalStreamOpenAI: true,
      useSystemPrompt: true,
      reasoningEffort: 'medium',
      verbosity: 'high',
    });
  });

  test('reports configuration errors clearly', async () => {
    const dataRoot = path.join(tmpdir(), `discord-bridge-diagnostics-missing-${Date.now()}`);
    process.env.SILLYTAVERN_DATA_ROOT = dataRoot;
    const paths = resolveBridgePaths(dataRoot);
    await writeConfig(paths.configFile, bridgeConfig('friend'));

    const handler = registerAndGetHandler();
    const response = new FakeResponse();
    handler({}, response);
    await response.done;

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      ok: false,
      reason: expect.stringContaining('settings'),
    });
  });
});

function registerAndGetHandler(): (request: unknown, response: FakeResponse) => void {
  let handler: ((request: unknown, response: FakeResponse) => void) | undefined;
  const router = {
    get: vi.fn((_path: string, nextHandler: typeof handler) => {
      handler = nextHandler;
    }),
  };
  registerDiagnosticRoutes(router as never);
  expect(router.get).toHaveBeenCalledWith('/st-settings/status', expect.any(Function));
  return handler ?? (() => undefined);
}

function bridgeConfig(handle: string) {
  return parseBridgeConfig({
    version: 1,
    enabled: false,
    sillyTavernUserHandle: handle,
    discord: {
      clientId: 'client',
      guildId: 'guild',
      forumChannelId: 'forum',
      createForumIfMissing: false,
      forumName: 'SillyTavern',
      defaultForumTagIds: [],
    },
    access: { allowlistedUserIds: [], adminUserIds: [] },
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

class FakeResponse {
  statusCode = 200;
  body: unknown;
  done: Promise<void>;
  private resolveDone!: () => void;

  constructor() {
    this.done = new Promise((resolve) => {
      this.resolveDone = resolve;
    });
  }

  status(statusCode: number): this {
    this.statusCode = statusCode;
    return this;
  }

  json(body: unknown): this {
    this.body = body;
    this.resolveDone();
    return this;
  }
}
