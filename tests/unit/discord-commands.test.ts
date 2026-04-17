import { describe, expect, test } from 'vitest';
import { buildGuildCommandData } from '../../src/server-plugin/discord/commands.js';

describe('Discord slash commands', () => {
  test('defines expected /st subcommands', () => {
    const command = buildGuildCommandData();

    expect(command.name).toBe('st');
    expect(command.options.map((option) => option.name)).toEqual(['new', 'status', 'character', 'sync']);
  });
});
