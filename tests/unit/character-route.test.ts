import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { registerCharacterRoutes } from '../../src/server-plugin/routes/characters.js';
import { resolveBridgePaths } from '../../src/server-plugin/config/paths.js';
import { writeConfig } from '../../src/server-plugin/config/store.js';
import { parseBridgeConfig } from '../../src/server-plugin/config/schema.js';

describe('character route', () => {
  afterEach(() => {
    delete process.env.SILLYTAVERN_DATA_ROOT;
  });

  test('returns real characters for the configured ST user handle', async () => {
    const dataRoot = path.join(tmpdir(), `discord-bridge-character-route-${Date.now()}`);
    process.env.SILLYTAVERN_DATA_ROOT = dataRoot;
    const paths = resolveBridgePaths(dataRoot);
    await writeConfig(
      paths.configFile,
      parseBridgeConfig({
        version: 1,
        enabled: false,
        sillyTavernUserHandle: 'friend',
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
      }),
    );
    const charactersDir = path.join(dataRoot, 'friend', 'characters');
    await mkdir(charactersDir, { recursive: true });
    await writeFile(
      path.join(charactersDir, 'Alice.json'),
      JSON.stringify({ data: { name: 'Alice', first_mes: 'Hello.' } }),
      'utf8',
    );

    let handler: ((request: unknown, response: FakeResponse) => void) | undefined;
    const router = {
      get: vi.fn((_path: string, nextHandler: typeof handler) => {
        handler = nextHandler;
      }),
    };
    registerCharacterRoutes(router as never);
    const response = new FakeResponse();

    handler?.({}, response);
    await response.done;

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual([
      expect.objectContaining({
        characterAvatarFile: 'Alice.json',
        chatFolderName: 'Alice',
        name: 'Alice',
      }),
    ]);
  });
});

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
