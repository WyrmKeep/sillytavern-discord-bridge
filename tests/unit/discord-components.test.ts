import { describe, expect, test } from 'vitest';
import {
  buildSwipeComponentPayload,
  decodeSwipeCustomId,
  encodeSwipeCustomId,
  swipeCounterLabel,
} from '../../src/server-plugin/discord/components.js';

describe('Discord components', () => {
  test('encodes and decodes stable bridge assistant message IDs', () => {
    const id = encodeSwipeCustomId('swipe_regen', 'thread', 'asst_123');

    expect(id).toBe('stb:v1:swipe_regen:thread:asst_123');
    expect(decodeSwipeCustomId(id)).toEqual({
      action: 'swipe_regen',
      threadId: 'thread',
      bridgeMessageId: 'asst_123',
    });
  });

  test('rejects malformed custom IDs', () => {
    expect(() => decodeSwipeCustomId('bad')).toThrow(/custom id/i);
  });

  test('renders visible swipe counter', () => {
    expect(swipeCounterLabel(1, 4)).toBe('Swipe 2/4');
  });

  test('builds Discord button payload with boundaries disabled', () => {
    const payload = buildSwipeComponentPayload('thread', 'bridge', 0, 2);

    expect(payload).toEqual([
      {
        type: 1,
        components: [
          {
            type: 2,
            style: 2,
            label: '<',
            custom_id: 'stb:v1:swipe_prev:thread:bridge',
            disabled: true,
          },
          {
            type: 2,
            style: 1,
            label: 'Regenerate - Swipe 1/2',
            custom_id: 'stb:v1:swipe_regen:thread:bridge',
            disabled: false,
          },
          {
            type: 2,
            style: 2,
            label: '>',
            custom_id: 'stb:v1:swipe_next:thread:bridge',
            disabled: false,
          },
        ],
      },
    ]);
  });
});
