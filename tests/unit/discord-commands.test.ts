import { describe, expect, test } from 'vitest';
import {
  buildGuildCommandData,
  buildGuildCommandsData,
  buildPersonaCommandData,
} from '../../src/server-plugin/discord/commands.js';

describe('Discord slash commands', () => {
  test('defines expected /st subcommands', () => {
    const command = buildGuildCommandData();

    expect(command.name).toBe('st');
    expect(command.options.map((option) => option.name)).toEqual(['new', 'status', 'character', 'sync']);
  });

  test('defines /persona set command', () => {
    const command = buildPersonaCommandData();

    expect(command.name).toBe('persona');
    expect(command.options.map((option) => option.name)).toEqual(['set']);
    expect(command.options[0]?.options?.map((option) => option.name)).toEqual(['name', 'description']);
  });

  test('registers both bridge command groups', () => {
    expect(buildGuildCommandsData().map((command) => command.name)).toEqual(['st', 'persona']);
  });
});
