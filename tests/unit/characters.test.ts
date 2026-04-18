import v1Fixture from '../fixtures/characters/character-v1.json' with { type: 'json' };
import v2Fixture from '../fixtures/characters/character-v2.json' with { type: 'json' };
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import {
  deriveChatFolderName,
  filterCharactersByTags,
  loadSillyTavernTags,
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

  test('loads SillyTavern tags and filters characters by tag name', async () => {
    const userRoot = await fixtureUserRoot();
    await writeFile(
      path.join(userRoot, 'tags.json'),
      JSON.stringify({
        tags: [
          { id: 'tag-discord', name: 'Discord' },
          { id: 'tag-private', name: 'Private' },
        ],
        tag_map: {
          'Alice.png': ['tag-discord'],
          'Bob.png': ['tag-private'],
        },
      }),
      'utf8',
    );
    const alice = normalizeCharacterCardData('Alice.png', { data: { name: 'Alice' } });
    const bob = normalizeCharacterCardData('Bob.png', { data: { name: 'Bob' } });

    const tagIndex = await loadSillyTavernTags(userRoot);
    const filtered = filterCharactersByTags([alice, bob], tagIndex, [' discord ']);

    expect(tagIndex.tagNamesByAvatar.get('Alice.png')).toEqual(['Discord']);
    expect(filtered.map((character) => character.characterAvatarFile)).toEqual(['Alice.png']);
  });

  test('supports multiple exposed tags with case-insensitive OR matching', async () => {
    const userRoot = await fixtureUserRoot();
    await writeFile(
      path.join(userRoot, 'tags.json'),
      JSON.stringify([
        { id: 'tag-discord', name: 'Discord', characters: ['Alice.png'] },
        { id: 'tag-beta', name: 'Beta', characterAvatarFiles: ['Bob.png'] },
      ]),
      'utf8',
    );
    const characters = [
      normalizeCharacterCardData('Alice.png', { data: { name: 'Alice' } }),
      normalizeCharacterCardData('Bob.png', { data: { name: 'Bob' } }),
      normalizeCharacterCardData('Cora.png', { data: { name: 'Cora' } }),
    ];

    const tagIndex = await loadSillyTavernTags(userRoot);
    const filtered = filterCharactersByTags(characters, tagIndex, ['DISCORD', ' beta']);

    expect(filtered.map((character) => character.characterAvatarFile)).toEqual(['Alice.png', 'Bob.png']);
  });

  test('returns all characters when no exposed tags are configured', async () => {
    const characters = [
      normalizeCharacterCardData('Alice.png', { data: { name: 'Alice' } }),
      normalizeCharacterCardData('Bob.png', { data: { name: 'Bob' } }),
    ];

    expect(filterCharactersByTags(characters, { tagNamesByAvatar: new Map() }, [])).toEqual(characters);
  });

  test('missing or malformed tag files fail closed when a filter is configured', async () => {
    const userRoot = await fixtureUserRoot();
    const characters = [normalizeCharacterCardData('Alice.png', { data: { name: 'Alice' } })];

    expect(filterCharactersByTags(characters, await loadSillyTavernTags(userRoot), ['discord'])).toEqual([]);

    await writeFile(path.join(userRoot, 'tags.json'), '{bad', 'utf8');
    expect(filterCharactersByTags(characters, await loadSillyTavernTags(userRoot), ['discord'])).toEqual([]);
  });
});

async function fixtureUserRoot(): Promise<string> {
  const userRoot = path.join(tmpdir(), `discord-bridge-tags-${Date.now()}-${Math.random()}`);
  await mkdir(userRoot, { recursive: true });
  return userRoot;
}
