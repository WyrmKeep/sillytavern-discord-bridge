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
  generation: {
    promptMode: 'headless-st-preset',
    sillyTavernPresetName: 'Roleplay',
  },
  defaults: {
    defaultCharacterAvatarFile: '',
    maxHistoryMessages: 80,
    contextBudgetTokens: 180000,
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
    expect(configToFormValues({
      ...config,
      profiles: {
        '123': {
          enabled: true,
          promptName: 'Rober',
          displayName: 'Rober',
          persona: 'Friendly operator.',
        },
      },
    })).toMatchObject({
      enabled: false,
      sillyTavernUserHandle: 'default-user',
      clientId: '111',
      guildId: '222',
      forumChannelId: '333',
      defaultForumTagIds: '444',
      allowlistedUserIds: '555',
      adminUserIds: '666',
      sillyTavernPresetName: 'Roleplay',
      maxHistoryMessages: '80',
      contextBudgetTokens: '180000',
      maxReplyCharacters: '1800',
      includeCreatorNotes: false,
      includePostHistoryInstructions: true,
      profilesJson: expect.stringContaining('"123"'),
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
      sillyTavernPresetName: 'Pinned Preset',
      defaultCharacterAvatarFile: 'Alice.png',
      maxHistoryMessages: '24',
      contextBudgetTokens: '120000',
      maxReplyCharacters: '1200',
      includeCreatorNotes: true,
      includePostHistoryInstructions: false,
      conversationTitleFormat: '{{character}}',
      profilesJson: JSON.stringify({
        'user-a': {
          enabled: true,
          promptName: 'Alice',
          displayName: 'Alice',
          persona: 'Profile text.',
        },
      }),
    });

    expect(updated.enabled).toBe(true);
    expect(updated.sillyTavernUserHandle).toBe('alice');
    expect(updated.discord.clientId).toBe('777');
    expect(updated.discord.defaultForumTagIds).toEqual(['tag-a', 'tag-b']);
    expect(updated.access.allowlistedUserIds).toEqual(['user-a', 'user-b']);
    expect(updated.access.adminUserIds).toEqual(['admin-a']);
    expect(updated.generation).toEqual({
      promptMode: 'headless-st-preset',
      sillyTavernPresetName: 'Pinned Preset',
    });
    expect(updated.defaults.maxHistoryMessages).toBe(24);
    expect(updated.defaults.contextBudgetTokens).toBe(120000);
    expect(updated.defaults.maxReplyCharacters).toBe(1200);
    expect(updated.defaults.includeCreatorNotes).toBe(true);
    expect(updated.defaults.includePostHistoryInstructions).toBe(false);
    expect(updated.defaults.defaultCharacterAvatarFile).toBe('Alice.png');
    expect(updated.behavior.conversationTitleFormat).toBe('{{character}}');
    expect(updated.profiles['user-a']?.persona).toBe('Profile text.');
  });

  test('rejects malformed profile JSON', () => {
    expect(() =>
      formValuesToConfig(config, {
        ...configToFormValues(config),
        profilesJson: '{bad',
      }),
    ).toThrow(/profiles json/i);
  });
});
