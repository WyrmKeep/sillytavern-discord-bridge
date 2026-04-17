import { describe, expect, test } from 'vitest';
import { normalizeThreadTitle, splitDiscordMessage } from '../../src/server-plugin/discord/forum.js';

describe('Discord message length policy', () => {
  test('normalizes thread titles and splits long replies', () => {
    expect(normalizeThreadTitle('  A   title  ', 20)).toBe('A title');
    expect(splitDiscordMessage('x'.repeat(2500), 2000)).toHaveLength(2);
  });
});
