import settingsFixture from '../fixtures/settings/st-claude-reverse-proxy.json' with { type: 'json' };
import notClaudeFixture from '../fixtures/settings/st-not-claude.json' with { type: 'json' };
import nonChatCompletionFixture from '../fixtures/settings/st-legacy-openai-root.json' with {
  type: 'json',
};
import { describe, expect, test } from 'vitest';
import {
  normalizeSillyTavernClaudeSettings,
  SillyTavernSettingsError,
} from '../../src/server-plugin/sillytavern/settings.js';

describe('SillyTavern Claude settings adapter', () => {
  test('normalizes Chat Completion Claude reverse proxy settings', () => {
    const settings = normalizeSillyTavernClaudeSettings(settingsFixture);

    expect(settings).toMatchObject({
      mainApi: 'openai',
      chatCompletionSource: 'claude',
      reverseProxy: 'http://example.invalid/v1/claude-proxy',
      proxyPassword: undefined,
      model: 'claude-sonnet-4-6',
      maxTokens: 512,
      temperature: 0.7,
      topP: 0.9,
      topK: 40,
      assistantPrefill: 'Assistant prefill',
      stopSequences: ['</END>'],
      stream: false,
      originalStreamOpenAI: true,
      useSystemPrompt: true,
      reasoningEffort: 'medium',
      verbosity: 'high',
    });
  });

  test('rejects non-Chat Completion main_api', () => {
    expect(() => normalizeSillyTavernClaudeSettings(nonChatCompletionFixture)).toThrow(
      SillyTavernSettingsError,
    );
  });

  test('rejects non-Claude source', () => {
    expect(() => normalizeSillyTavernClaudeSettings(notClaudeFixture)).toThrow(/claude/i);
  });

  test('rejects missing reverse proxy', () => {
    expect(() =>
      normalizeSillyTavernClaudeSettings({
        main_api: 'openai',
        oai_settings: {
          chat_completion_source: 'claude',
          claude_model: 'claude-sonnet-4-6',
        },
      }),
    ).toThrow(/reverse_proxy/i);
  });

  test('rejects non claude-sonnet-4-6 model', () => {
    expect(() =>
      normalizeSillyTavernClaudeSettings({
        main_api: 'openai',
        oai_settings: {
          chat_completion_source: 'claude',
          reverse_proxy: 'http://example.invalid/v1/claude-proxy',
          claude_model: 'claude-3-5-sonnet-latest',
        },
      }),
    ).toThrow(/claude-sonnet-4-6/i);
  });
});
