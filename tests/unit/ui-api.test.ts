import { afterEach, describe, expect, test, vi } from 'vitest';
import { fetchBridgeConfig, saveBridgeConfig } from '../../src/ui-extension/api.js';
import { configToFormValues } from '../../src/ui-extension/settings-form.js';
import { DEFAULT_CONFIG, parseBridgeConfig } from '../../src/server-plugin/config/schema.js';

const config = parseBridgeConfig(DEFAULT_CONFIG);

describe('UI API', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('reports stale server plugin config responses clearly', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })),
    );

    await expect(fetchBridgeConfig()).rejects.toThrow(/server plugin needs update/i);
  });

  test('surfaces server validation messages when config save fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ ok: false, reason: 'Admin access required.' }), {
            status: 403,
          }),
      ),
    );

    await expect(saveBridgeConfig(config)).rejects.toThrow(/admin access required/i);
  });

  test('accepts current config payloads', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              config,
              secrets: { discordBotToken: '<missing>' },
            }),
            { status: 200 },
          ),
      ),
    );

    const payload = await fetchBridgeConfig();

    expect(configToFormValues(payload.config).sillyTavernUserHandle).toBe('default-user');
  });
});
