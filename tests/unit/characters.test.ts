import v1Fixture from '../fixtures/characters/character-v1.json' with { type: 'json' };
import v2Fixture from '../fixtures/characters/character-v2.json' with { type: 'json' };
import { describe, expect, test } from 'vitest';
import {
  deriveChatFolderName,
  normalizeCharacterCardData,
} from '../../src/server-plugin/sillytavern/characters.js';

describe('SillyTavern character normalization', () => {
  test('normalizes V2 card fixture and derives chat folder from avatar filename', () => {
    const character = normalizeCharacterCardData('Alice.png', v2Fixture);

    expect(character).toMatchObject({
      characterAvatarFile: 'Alice.png',
      chatFolderName: 'Alice',
      name: 'Alice',
      firstMes: 'Hello from Alice.',
      alternateGreetings: ['Alternate hello.'],
      tags: ['test', 'bridge'],
    });
  });

  test('normalizes legacy V1 card fixture', () => {
    const character = normalizeCharacterCardData('Bob.png', v1Fixture);

    expect(character.name).toBe('Bob');
    expect(character.chatFolderName).toBe('Bob');
    expect(character.alternateGreetings).toEqual([]);
  });

  test('prefers V3 ccv3 metadata over older embedded data', () => {
    const character = normalizeCharacterCardData('V3 Card.png', {
      data: { name: 'Old Name', first_mes: 'Old hello' },
      ccv3: {
        data: {
          name: 'V3 Name',
          description: 'V3 description',
          first_mes: 'V3 hello',
          alternate_greetings: ['V3 alt'],
        },
      },
    });

    expect(character.name).toBe('V3 Name');
    expect(character.firstMes).toBe('V3 hello');
    expect(character.chatFolderName).toBe('V3 Card');
  });

  test('deriveChatFolderName uses filename stem only', () => {
    expect(deriveChatFolderName('Some Display Name.png')).toBe('Some Display Name');
    expect(deriveChatFolderName('nested/path/Card.png')).toBe('Card');
  });
});
