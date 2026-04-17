import { describe, expect, test } from 'vitest';
import { authorizePluginRoute } from '../../src/server-plugin/routes/security.js';

describe('plugin route authorization', () => {
  test('allows read-only diagnostics from UI session', () => {
    expect(
      authorizePluginRoute({
        method: 'GET',
        accountMode: 'disabled',
        origin: 'same-origin',
        remoteAddress: '127.0.0.1',
      }),
    ).toEqual({ ok: true });
  });

  test('rejects account-disabled mutating request authorized only by default request.user', () => {
    expect(
      authorizePluginRoute({
        method: 'PUT',
        accountMode: 'disabled',
        requestUserPresent: true,
        origin: 'remote',
        remoteAddress: '203.0.113.1',
      }),
    ).toMatchObject({ ok: false });
  });

  test('allows non-UI mutating request with plugin token', () => {
    expect(
      authorizePluginRoute({
        method: 'POST',
        accountMode: 'disabled',
        origin: 'remote',
        remoteAddress: '203.0.113.1',
        providedBearerToken: 'token',
        expectedBearerToken: 'token',
      }),
    ).toEqual({ ok: true });
  });

  test('requires admin when accounts are enabled', () => {
    expect(
      authorizePluginRoute({
        method: 'PUT',
        accountMode: 'enabled',
        requestUserPresent: true,
        requestUserAdmin: false,
        origin: 'same-origin',
      }),
    ).toMatchObject({ ok: false });
  });
});
