import { describe, expect, test } from 'vitest';
import { assertForumTagConfiguration } from '../../src/server-plugin/discord/permissions.js';

describe('forum required tag integration guard', () => {
  test('fails clearly when forum requires tags and none are configured', () => {
    expect(() => assertForumTagConfiguration({ requireTag: true, configuredTagIds: [] })).toThrow(
      /required tag/i,
    );
  });
});
