import { describe, expect, test } from 'vitest';
import {
  DEFAULT_CONFIG,
  parseBridgeConfig,
  parseBridgeSecrets,
  redactConfig,
  redactSecrets,
} from '../../src/server-plugin/config/schema.js';

describe('bridge config schema', () => {
  test('valid config parses and duplicate allowlist entries normalize', () => {
    const config = parseBridgeConfig({
      ...DEFAULT_CONFIG,
      enabled: true,
      sillyTavernUserHandle: 'default-user',
      discord: {
        ...DEFAULT_CONFIG.discord,
        clientId: '123',
        guildId: '456',
        forumChannelId: '789',
      },
      access: {
        allowlistedUserIds: ['111', '111', '222'],
        adminUserIds: ['222', '222'],
      },
    });

    expect(config.access.allowlistedUserIds).toEqual(['111', '222']);
    expect(config.access.adminUserIds).toEqual(['222']);
    expect(config.discord.defaultForumTagIds).toEqual([]);
  });

  test('missing Discord guild fails', () => {
    expect(() =>
      parseBridgeConfig({
        ...DEFAULT_CONFIG,
        discord: {
          ...DEFAULT_CONFIG.discord,
          clientId: '123',
          guildId: '',
          forumChannelId: '789',
        },
      }),
    ).toThrow(/guildId/i);
  });

  test('secrets parse and redact without exposing token', () => {
    const secrets = parseBridgeSecrets({ discordBotToken: 'real-token' });

    expect(redactSecrets(secrets)).toEqual({ discordBotToken: '<present>' });
    expect(JSON.stringify(redactSecrets(secrets))).not.toContain('real-token');
  });

  test('config redaction does not expose sensitive token-like fields', () => {
    const config = parseBridgeConfig(DEFAULT_CONFIG);
    const redacted = redactConfig(config);

    expect(redacted.discord.guildId).toBe(DEFAULT_CONFIG.discord.guildId);
    expect(JSON.stringify(redacted)).not.toContain('DISCORD_BOT_TOKEN');
  });

  test('generation config pins a headless SillyTavern preset by filename stem', () => {
    const config = parseBridgeConfig({
      ...DEFAULT_CONFIG,
      generation: {
        promptMode: 'headless-st-preset',
        sillyTavernPresetName: 'Roleplay',
      },
    });

    expect(config.generation).toEqual({
      promptMode: 'headless-st-preset',
      sillyTavernPresetName: 'Roleplay',
    });
  });
});
