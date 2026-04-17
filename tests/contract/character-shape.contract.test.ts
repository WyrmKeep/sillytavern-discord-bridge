import { describe, expect, test } from 'vitest';
import { normalizeCharacterCardData } from '../../src/server-plugin/sillytavern/characters.js';

describe('SillyTavern character shape contract', () => {
  test('normalizes required V3 card fields', () => {
    const character = normalizeCharacterCardData('V3.png', {
      ccv3: {
        data: {
          name: 'V3',
          description: 'Description',
          first_mes: 'Hello',
          tags: ['v3'],
        },
      },
    });

    expect(character).toMatchObject({
      characterAvatarFile: 'V3.png',
      chatFolderName: 'V3',
      name: 'V3',
      firstMes: 'Hello',
      tags: ['v3'],
    });
  });
});
