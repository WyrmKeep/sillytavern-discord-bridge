import { describe, expect, test } from 'vitest';
import { SUPPORTED_SILLYTAVERN_VERSION } from '../../src/server-plugin/sillytavern/versions.js';
import { resolveSillyTavernInternal } from '../../src/server-plugin/sillytavern/imports.js';

describe('SillyTavern internal import contract', () => {
  test('pins supported SillyTavern version', () => {
    expect(SUPPORTED_SILLYTAVERN_VERSION).toBe('1.17.0');
  });

  test('resolves internals relative to detected SillyTavern root, not process cwd src', () => {
    const href = resolveSillyTavernInternal('C:/SillyTavern', 'src/users.js');

    expect(href).toContain('/C:/SillyTavern/src/users.js');
  });
});
