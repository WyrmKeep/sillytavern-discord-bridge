import { describe, expect, test, vi } from 'vitest';
import { registerBotRoutes } from '../../src/server-plugin/routes/bot.js';
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
      userTag: 'Bridge#0001',
    })),
    stop: vi.fn(async () => ({
      enabled: false,
      ready: false,
      state: 'stopped' as const,
    })),
  };
}

function fakeRequest() {
  return {
    method: 'POST',
    socket: { remoteAddress: '127.0.0.1' },
    get: (name: string) => {
      const headers: Record<string, string> = {
        origin: 'http://localhost:8000',
        host: 'localhost:8000',
      };
      return headers[name.toLowerCase()];
    },
  };
}

function fakeResponse() {
  const response = {
    statusCode: 200,
    body: undefined as unknown,
    status: vi.fn((statusCode: number) => {
      response.statusCode = statusCode;
      return response;
    }),
    json: vi.fn((body: unknown) => {
      response.body = body;
      return response;
    }),
  };
  return response;
}

describe('bot routes', () => {
  test('reconciles the Discord bot runtime on restart', async () => {
    const runtime = fakeRuntime();
    let handler: ((request: unknown, response: unknown) => Promise<void>) | undefined;
    const router = {
      post: vi.fn((_path: string, nextHandler: typeof handler) => {
        handler = nextHandler;
      }),
    };
    registerBotRoutes(router as never, { discordBotRuntime: runtime });

    const response = fakeResponse();
    await handler?.(fakeRequest(), response);

    expect(router.post).toHaveBeenCalledWith('/bot/restart', expect.any(Function));
    expect(runtime.reconcile).toHaveBeenCalledTimes(1);
    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      ok: true,
      discord: {
        enabled: true,
        ready: true,
        state: 'ready',
        userTag: 'Bridge#0001',
      },
    });
  });
});
