import { describe, expect, test } from 'vitest';
import {
  REQUIRED_BOT_PERMISSIONS,
  assertForumTagConfiguration,
  optionalBotPermissions,
} from '../../src/server-plugin/discord/permissions.js';

describe('Discord permissions', () => {
  test('minimal permissions do not include Create Public Threads', () => {
    expect(REQUIRED_BOT_PERMISSIONS).toEqual([
      'ViewChannel',
      'SendMessages',
      'SendMessagesInThreads',
      'ReadMessageHistory',
      'UseApplicationCommands',
    ]);
  });

  test('manage permissions are optional by feature', () => {
    expect(optionalBotPermissions({ ensureForum: true, manageThreads: false })).toEqual([
      'ManageChannels',
    ]);
    expect(optionalBotPermissions({ ensureForum: false, manageThreads: true })).toEqual([
      'ManageThreads',
    ]);
  });

  test('required forum tags need configured default tag IDs', () => {
    expect(() =>
      assertForumTagConfiguration({ requireTag: true, configuredTagIds: [] }),
    ).toThrow(/required tag/i);
    expect(() =>
      assertForumTagConfiguration({ requireTag: true, configuredTagIds: ['tag'] }),
    ).not.toThrow();
  });
});
