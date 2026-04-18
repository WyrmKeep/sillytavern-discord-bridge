import { describe, expect, test, vi } from 'vitest';
import { exit, init } from '../../src/server-plugin/index.js';
import type { DiscordBotRuntime } from '../../src/server-plugin/discord/lifecycle.js';

function fakeRuntime(): DiscordBotRuntime {
  return {
    getStatus: () => ({
      enabled: true,
      ready: false,
      state: 'starting',
    }),
    reconcile: vi.fn(async () => ({
      enabled: true,
      ready: true,
      state: 'ready' as const,
    })),
    stop: vi.fn(async () => ({
      enabled: false,
      ready: false,
      state: 'stopped' as const,
    })),
  };
}

describe('server plugin entrypoint', () => {
  test('starts the Discord bot runtime on init', async () => {
    const runtime = fakeRuntime();
    const router = { get: vi.fn(), post: vi.fn(), put: vi.fn() };

    init(router as never, { discordBotRuntime: runtime });
    await Promise.resolve();

    expect(runtime.reconcile).toHaveBeenCalledTimes(1);
  });

  test('stops the Discord bot runtime on exit', async () => {
    const runtime = fakeRuntime();

    await exit({ discordBotRuntime: runtime });

    expect(runtime.stop).toHaveBeenCalledTimes(1);
  });
});
