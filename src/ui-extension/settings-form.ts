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
  defaultCharacterAvatarFile: string;
  conversationTitleFormat: string;
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
    defaultCharacterAvatarFile: config.defaults.defaultCharacterAvatarFile,
    conversationTitleFormat: config.behavior.conversationTitleFormat,
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
    defaults: {
      ...current.defaults,
      defaultCharacterAvatarFile: values.defaultCharacterAvatarFile.trim(),
    },
    behavior: {
      ...current.behavior,
      conversationTitleFormat: values.conversationTitleFormat.trim() || '{{character}} - {{date}}',
    },
  };
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
