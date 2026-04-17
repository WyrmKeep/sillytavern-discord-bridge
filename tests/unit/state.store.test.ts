import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { createConversationState, readState, writeState } from '../../src/server-plugin/state/store.js';
import { createKeyedQueue } from '../../src/server-plugin/state/locks.js';

describe('state store', () => {
  test('missing state file reads as empty state', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'stb-state-'));
    try {
      await expect(readState(path.join(dir, 'state.json'))).resolves.toEqual({
        version: 1,
        conversations: {},
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test('state round trips a conversation with avatar-derived folder fields', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'stb-state-'));
    const file = path.join(dir, 'state.json');
    try {
      const conversation = createConversationState({
        guildId: 'guild',
        forumChannelId: 'forum',
        threadId: 'thread',
        starterMessageId: 'starter',
        characterAvatarFile: 'Alice.png',
        characterName: 'Alice',
        chatFileName: '20260417T120000Z--thread.jsonl',
        createdByDiscordUserId: 'user',
      });

      await writeState(file, {
        version: 1,
        conversations: {
          thread: conversation,
        },
      });

      const state = await readState(file);
      expect(state.conversations.thread.chatFolderName).toBe('Alice');
      expect(state.conversations.thread.chatFileName).toBe('20260417T120000Z--thread.jsonl');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe('per-chat-file queue', () => {
  test('serializes work for the same normalized key', async () => {
    const queue = createKeyedQueue();
    const events: string[] = [];

    const first = queue.run('C:/tmp/chat.jsonl', async () => {
      events.push('first-start');
      await new Promise((resolve) => setTimeout(resolve, 20));
      events.push('first-end');
    });

    const second = queue.run('c:\\tmp\\chat.jsonl', async () => {
      events.push('second-start');
      events.push('second-end');
    });

    await Promise.all([first, second]);

    expect(events).toEqual(['first-start', 'first-end', 'second-start', 'second-end']);
  });
});
