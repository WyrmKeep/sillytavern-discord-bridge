import { describe, expect, test } from 'vitest';
import {
  configToFormValues,
  formValuesToConfig,
  parseCommaSeparatedIds,
} from '../../src/ui-extension/settings-form.js';
import type { BridgeConfig } from '../../src/ui-extension/api.js';

const config: BridgeConfig = {
  version: 1,
  enabled: false,
  sillyTavernUserHandle: 'default-user',
  discord: {
    clientId: '111',
    guildId: '222',
    forumChannelId: '333',
    createForumIfMissing: false,
    forumName: 'SillyTavern',
    defaultForumTagIds: ['444'],
  },
  access: {
    allowlistedUserIds: ['555'],
    adminUserIds: ['666'],
  },
  profiles: {},
  defaults: {
    defaultCharacterAvatarFile: '',
    maxHistoryMessages: 80,
    maxReplyCharacters: 1800,
    includeCreatorNotes: false,
    includePostHistoryInstructions: true,
  },
  behavior: {
    ignoreBotMessages: true,
    rejectNonAllowlistedUsers: 'silent',
    attachmentMode: 'ignore-with-note',
    conversationTitleFormat: '{{character}} - {{date}}',
  },
};

describe('UI settings form mapping', () => {
  test('formats config as editable form values', () => {
    expect(configToFormValues(config)).toMatchObject({
      enabled: false,
      sillyTavernUserHandle: 'default-user',
      clientId: '111',
      guildId: '222',
      forumChannelId: '333',
      defaultForumTagIds: '444',
      allowlistedUserIds: '555',
      adminUserIds: '666',
    });
  });

  test('parses comma separated IDs with trimming and dedupe', () => {
    expect(parseCommaSeparatedIds(' 1,2  3\n2,,4 ')).toEqual(['1', '2', '3', '4']);
  });

  test('applies edited form values back to config while preserving advanced fields', () => {
    const updated = formValuesToConfig(config, {
      enabled: true,
      sillyTavernUserHandle: 'alice',
      clientId: '777',
      guildId: '888',
      forumChannelId: '999',
      defaultForumTagIds: 'tag-a tag-b',
      allowlistedUserIds: 'user-a,user-b',
      adminUserIds: 'admin-a',
      defaultCharacterAvatarFile: 'Alice.png',
      conversationTitleFormat: '{{character}}',
    });

    expect(updated.enabled).toBe(true);
    expect(updated.sillyTavernUserHandle).toBe('alice');
    expect(updated.discord.clientId).toBe('777');
    expect(updated.discord.defaultForumTagIds).toEqual(['tag-a', 'tag-b']);
    expect(updated.access.allowlistedUserIds).toEqual(['user-a', 'user-b']);
    expect(updated.access.adminUserIds).toEqual(['admin-a']);
    expect(updated.defaults.maxHistoryMessages).toBe(80);
    expect(updated.defaults.defaultCharacterAvatarFile).toBe('Alice.png');
    expect(updated.behavior.conversationTitleFormat).toBe('{{character}}');
  });
});
