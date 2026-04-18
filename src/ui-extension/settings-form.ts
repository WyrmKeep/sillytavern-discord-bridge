import type { BridgeConfig } from './api.js';

export type SettingsFormValues = {
  enabled: boolean;
  sillyTavernUserHandle: string;
  clientId: string;
  guildId: string;
  forumChannelId: string;
  defaultForumTagIds: string;
  allowlistedUserIds: string;
  adminUserIds: string;
  sillyTavernPresetName: string;
  defaultCharacterAvatarFile: string;
  maxHistoryMessages: string;
  maxReplyCharacters: string;
  includeCreatorNotes: boolean;
  includePostHistoryInstructions: boolean;
  conversationTitleFormat: string;
  profilesJson: string;
};

export function configToFormValues(config: BridgeConfig): SettingsFormValues {
  return {
    enabled: config.enabled,
    sillyTavernUserHandle: config.sillyTavernUserHandle,
    clientId: config.discord.clientId,
    guildId: config.discord.guildId,
    forumChannelId: config.discord.forumChannelId,
    defaultForumTagIds: config.discord.defaultForumTagIds.join(', '),
    allowlistedUserIds: config.access.allowlistedUserIds.join(', '),
    adminUserIds: config.access.adminUserIds.join(', '),
    sillyTavernPresetName: config.generation.sillyTavernPresetName,
    defaultCharacterAvatarFile: config.defaults.defaultCharacterAvatarFile,
    maxHistoryMessages: String(config.defaults.maxHistoryMessages),
    maxReplyCharacters: String(config.defaults.maxReplyCharacters),
    includeCreatorNotes: config.defaults.includeCreatorNotes,
    includePostHistoryInstructions: config.defaults.includePostHistoryInstructions,
    conversationTitleFormat: config.behavior.conversationTitleFormat,
    profilesJson: JSON.stringify(config.profiles, null, 2),
  };
}

export function formValuesToConfig(
  current: BridgeConfig,
  values: SettingsFormValues,
): BridgeConfig {
  return {
    ...current,
    enabled: values.enabled,
    sillyTavernUserHandle: values.sillyTavernUserHandle.trim(),
    discord: {
      ...current.discord,
      clientId: values.clientId.trim(),
      guildId: values.guildId.trim(),
      forumChannelId: values.forumChannelId.trim(),
      defaultForumTagIds: parseCommaSeparatedIds(values.defaultForumTagIds),
    },
    access: {
      ...current.access,
      allowlistedUserIds: parseCommaSeparatedIds(values.allowlistedUserIds),
      adminUserIds: parseCommaSeparatedIds(values.adminUserIds),
    },
    profiles: parseProfilesJson(values.profilesJson),
    generation: {
      ...current.generation,
      promptMode: 'headless-st-preset',
      sillyTavernPresetName: values.sillyTavernPresetName.trim(),
    },
    defaults: {
      ...current.defaults,
      defaultCharacterAvatarFile: values.defaultCharacterAvatarFile.trim(),
      maxHistoryMessages: parsePositiveInteger(
        values.maxHistoryMessages,
        current.defaults.maxHistoryMessages,
      ),
      maxReplyCharacters: parsePositiveInteger(
        values.maxReplyCharacters,
        current.defaults.maxReplyCharacters,
      ),
      includeCreatorNotes: values.includeCreatorNotes,
      includePostHistoryInstructions: values.includePostHistoryInstructions,
    },
    behavior: {
      ...current.behavior,
      conversationTitleFormat: values.conversationTitleFormat.trim() || '{{character}} - {{date}}',
    },
  };
}

function parsePositiveInteger(value: string, fallback: number): number {
  const parsed = Number.parseInt(value.trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseProfilesJson(value: string): BridgeConfig['profiles'] {
  try {
    const parsed = value.trim() ? JSON.parse(value) as unknown : {};
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new Error('Profiles JSON must be an object.');
    }
    return parsed as BridgeConfig['profiles'];
  } catch (error) {
    throw new Error(error instanceof Error ? `Profiles JSON invalid: ${error.message}` : 'Profiles JSON invalid.');
  }
}

export function parseCommaSeparatedIds(value: string): string[] {
  return [
    ...new Set(
      value
        .split(/[\s,]+/u)
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  ];
}
