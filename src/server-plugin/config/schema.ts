import { z } from 'zod';

const nonEmptyString = z.string().trim().min(1);
const stringArray = z.array(z.string().trim().min(1)).default([]);

export const DEFAULT_CONFIG = {
  version: 1,
  enabled: false,
  sillyTavernUserHandle: 'default-user',
  discord: {
    clientId: '000000000000000000',
    guildId: '000000000000000000',
    forumChannelId: '000000000000000000',
    createForumIfMissing: false,
    forumName: 'SillyTavern',
    defaultForumTagIds: [],
    exposedCharacterTags: [],
  },
  access: {
    allowlistedUserIds: [],
    adminUserIds: [],
  },
  profiles: {},
  generation: {
    promptMode: 'headless-st-preset',
    sillyTavernPresetName: '',
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
    showTypingIndicator: true,
    processingReactionEmoji: '\u{23F3}',
    errorReactionEmoji: '\u{274C}',
  },
} as const;

const profileSchema = z.object({
  enabled: z.boolean().default(true),
  promptName: nonEmptyString,
  displayName: nonEmptyString,
  persona: z.string().default(''),
});

export const bridgeConfigSchema = z
  .object({
    version: z.literal(1).default(1),
    enabled: z.boolean().default(DEFAULT_CONFIG.enabled),
    sillyTavernUserHandle: nonEmptyString.default(DEFAULT_CONFIG.sillyTavernUserHandle),
    discord: z.object({
      clientId: nonEmptyString,
      guildId: nonEmptyString,
      forumChannelId: nonEmptyString,
      createForumIfMissing: z.boolean().default(false),
      forumName: nonEmptyString.default(DEFAULT_CONFIG.discord.forumName),
      defaultForumTagIds: stringArray,
      exposedCharacterTags: stringArray,
    }),
    access: z.object({
      allowlistedUserIds: stringArray,
      adminUserIds: stringArray,
    }),
    profiles: z.record(z.string(), profileSchema).default({}),
    generation: z.object({
      promptMode: z.literal('headless-st-preset').default('headless-st-preset'),
      sillyTavernPresetName: z.string().trim().default(''),
    }).default(DEFAULT_CONFIG.generation),
    defaults: z.object({
      defaultCharacterAvatarFile: z.string().default(''),
      maxHistoryMessages: z.number().int().min(1).max(500).default(80),
      contextBudgetTokens: z.number().int().min(1000).max(1000000).default(180000),
      maxReplyCharacters: z.number().int().min(200).max(2000).default(1800),
      includeCreatorNotes: z.boolean().default(false),
      includePostHistoryInstructions: z.boolean().default(true),
    }),
    behavior: z.object({
      ignoreBotMessages: z.boolean().default(true),
      rejectNonAllowlistedUsers: z
        .enum(['silent', 'ephemeral-reply-for-commands'])
        .default('silent'),
      attachmentMode: z.literal('ignore-with-note').default('ignore-with-note'),
      conversationTitleFormat: nonEmptyString.default('{{character}} - {{date}}'),
      showTypingIndicator: z.boolean().default(true),
      processingReactionEmoji: z.string().trim().default('\u{23F3}'),
      errorReactionEmoji: z.string().trim().default('\u{274C}'),
    }),
  })
  .transform((config) => ({
    ...config,
    access: {
      allowlistedUserIds: dedupe(config.access.allowlistedUserIds),
      adminUserIds: dedupe(config.access.adminUserIds),
    },
    discord: {
      ...config.discord,
      defaultForumTagIds: dedupe(config.discord.defaultForumTagIds),
      exposedCharacterTags: dedupeCaseInsensitive(config.discord.exposedCharacterTags),
    },
  }));

export const bridgeSecretsSchema = z.object({
  discordBotToken: z.string().trim().optional(),
});

export type DiscordBridgeConfig = z.infer<typeof bridgeConfigSchema>;
export type DiscordBridgeSecrets = z.infer<typeof bridgeSecretsSchema>;

export function parseBridgeConfig(input: unknown): DiscordBridgeConfig {
  return bridgeConfigSchema.parse(input);
}

export function parseBridgeSecrets(input: unknown): DiscordBridgeSecrets {
  return bridgeSecretsSchema.parse(input);
}

export function redactSecrets(secrets: DiscordBridgeSecrets): Record<keyof DiscordBridgeSecrets, string> {
  return {
    discordBotToken: secrets.discordBotToken ? '<present>' : '<missing>',
  };
}

export function redactConfig(config: DiscordBridgeConfig): DiscordBridgeConfig {
  return structuredClone(config);
}

function dedupe(values: string[]): string[] {
  return [...new Set(values)];
}

function dedupeCaseInsensitive(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const key = value.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(value);
  }
  return result;
}
