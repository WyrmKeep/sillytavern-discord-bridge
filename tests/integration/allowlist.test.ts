import { describe, expect, test } from 'vitest';
import { checkAllowlist } from '../../src/server-plugin/discord/message-handler.js';

describe('allowlist flow', () => {
  test('non-allowlisted users are ignored', () => {
    expect(checkAllowlist('intruder', ['friend'])).toBe('ignore');
    expect(checkAllowlist('friend', ['friend'])).toBe('allow');
  });
});
