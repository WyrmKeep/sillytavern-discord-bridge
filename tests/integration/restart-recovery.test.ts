import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { createConversationState, readState, writeState } from '../../src/server-plugin/state/store.js';

describe('restart recovery', () => {
  test('reloads state and keeps tracked thread mapping', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'stb-recovery-'));
    const file = path.join(dir, 'state.json');
    try {
      await writeState(file, {
        version: 1,
        conversations: {
          thread: createConversationState({
            guildId: 'guild',
            forumChannelId: 'forum',
            threadId: 'thread',
            starterMessageId: 'starter',
            characterAvatarFile: 'Alice.png',
            characterName: 'Alice',
            chatFileName: 'stamp--thread.jsonl',
            createdByDiscordUserId: 'user',
          }),
        },
      });

      const recovered = await readState(file);
      expect(recovered.conversations.thread.threadId).toBe('thread');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
