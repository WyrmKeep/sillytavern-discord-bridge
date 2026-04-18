import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  fetchBridgeConfig,
  fetchStSettingsStatus,
  saveBridgeConfig,
  saveBridgeSecrets,
} from '../../src/ui-extension/api.js';
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

  test('includes SillyTavern request headers when saving config and secrets', async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(
          JSON.stringify({
            config,
            secrets: { discordBotToken: '<present>' },
          }),
          { status: 200 },
        ),
    );
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('getRequestHeaders', () => ({ 'x-csrf-token': 'csrf-token' }));

    await saveBridgeConfig(config);
    await saveBridgeSecrets({ discordBotToken: 'token' });

    const configHeaders = new Headers(fetchMock.mock.calls[0]?.[1]?.headers);
    const secretsHeaders = new Headers(fetchMock.mock.calls[1]?.[1]?.headers);
    expect(configHeaders.get('x-csrf-token')).toBe('csrf-token');
    expect(configHeaders.get('content-type')).toBe('application/json');
    expect(secretsHeaders.get('x-csrf-token')).toBe('csrf-token');
    expect(secretsHeaders.get('content-type')).toBe('application/json');
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

  test('fetches SillyTavern settings diagnostics', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              ok: true,
              model: 'claude-sonnet-4-6',
              reverseProxy: '<configured>',
            }),
            { status: 200 },
          ),
      ),
    );

    await expect(fetchStSettingsStatus()).resolves.toMatchObject({
      ok: true,
      model: 'claude-sonnet-4-6',
    });
  });
});
