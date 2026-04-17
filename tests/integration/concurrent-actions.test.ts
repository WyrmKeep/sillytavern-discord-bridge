import { describe, expect, test } from 'vitest';
import { createKeyedQueue } from '../../src/server-plugin/state/locks.js';

describe('concurrent chat mutations', () => {
  test('same chat file actions serialize through one queue', async () => {
    const queue = createKeyedQueue();
    const events: string[] = [];

    await Promise.all([
      queue.run('/data/chat.jsonl', async () => {
        events.push('message');
      }),
      queue.run('/data/chat.jsonl', async () => {
        events.push('regen');
      }),
    ]);

    expect(events).toEqual(['message', 'regen']);
  });
});
