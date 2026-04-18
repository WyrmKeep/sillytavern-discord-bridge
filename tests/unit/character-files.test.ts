import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, test } from 'vitest';
import { listCharacterCards } from '../../src/server-plugin/sillytavern/characters.js';

describe('character file discovery', () => {
  test('loads JSON and PNG character cards from a user character directory', async () => {
    const dir = path.join(tmpdir(), `discord-bridge-characters-${Date.now()}`);
    await mkdir(dir, { recursive: true });
    await writeFile(
      path.join(dir, 'Alice.json'),
      JSON.stringify({
        data: {
          name: 'Alice',
          description: 'JSON card',
          first_mes: 'Hello from JSON.',
        },
      }),
      'utf8',
    );
    await writeFile(
      path.join(dir, 'Bob.png'),
      pngWithTextChunk(
        'chara',
        Buffer.from(
          JSON.stringify({
            spec: 'chara_card_v3',
            ccv3: {
              data: {
                name: 'Bob',
                description: 'PNG V3 card',
                first_mes: 'Hello from PNG.',
              },
            },
          }),
          'utf8',
        ).toString('base64'),
      ),
    );
    await writeFile(path.join(dir, 'notes.txt'), 'ignored', 'utf8');

    const cards = await listCharacterCards(dir);

    expect(cards.map((card) => card.characterAvatarFile)).toEqual(['Alice.json', 'Bob.png']);
    expect(cards.map((card) => card.name)).toEqual(['Alice', 'Bob']);
    expect(cards[1]?.chatFolderName).toBe('Bob');
    expect(cards[1]?.firstMes).toBe('Hello from PNG.');
  });
});

function pngWithTextChunk(keyword: string, text: string): Buffer {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const data = Buffer.concat([Buffer.from(keyword, 'latin1'), Buffer.from([0]), Buffer.from(text, 'latin1')]);
  return Buffer.concat([signature, pngChunk('tEXt', data), pngChunk('IEND', Buffer.alloc(0))]);
}

function pngChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  return Buffer.concat([length, Buffer.from(type, 'latin1'), data, Buffer.alloc(4)]);
}
