import { describe, expect, test } from 'vitest';
import { deriveChatFolderName } from '../../src/server-plugin/sillytavern/characters.js';
import { buildChatFilePath } from '../../src/server-plugin/sillytavern/chats.js';

describe('SillyTavern chat folder visibility contract', () => {
  test('stores chats under avatar-derived folder', () => {
    const chatFolderName = deriveChatFolderName('Alice Example.png');

    expect(chatFolderName).toBe('Alice Example');
    expect(buildChatFilePath('/data', 'default-user', chatFolderName, 'stamp--thread.jsonl')).toBe(
      '/data/default-user/chats/Alice Example/stamp--thread.jsonl',
    );
  });
});
