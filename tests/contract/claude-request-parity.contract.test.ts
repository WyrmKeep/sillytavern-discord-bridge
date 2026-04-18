import { describe, expect, test } from 'vitest';
import { buildSillyTavernBackendRequest } from '../../src/server-plugin/generation/st-backend-generation.js';
import type { SillyTavernClaudeSettings } from '../../src/server-plugin/sillytavern/settings.js';

describe('Claude request parity contract', () => {
  test('captures supported Claude 4.6 fields delegated through ST backend generation', () => {
    const settings: SillyTavernClaudeSettings = {
      mainApi: 'openai',
      chatCompletionSource: 'claude',
      reverseProxy: 'http://example.invalid/v1',
      proxyPassword: 'secret',
      model: 'claude-sonnet-4-6',
      maxTokens: 300,
      temperature: 1,
      topP: 1,
      topK: 20,
      assistantPrefill: 'Prefill',
      stopSequences: ['STOP'],
      stream: false,
      originalStreamOpenAI: false,
      useSystemPrompt: true,
      reasoningEffort: 'auto',
      verbosity: 'auto',
    };

    const request = buildSillyTavernBackendRequest({
      settings,
      messages: [{ role: 'user', content: 'Hello' }],
      characterName: 'Alice',
      userName: 'Rober',
    });

    expect(request.path).toBe('/api/backends/chat-completions/generate');
    expect(request.body.chat_completion_source).toBe('claude');
    expect(request.body.stop).toEqual(['STOP']);
    expect(request.body.top_k).toBe(20);
    expect(request.body.use_sysprompt).toBe(true);
    expect(request.body.assistant_prefill).toBe('Prefill');
    expect(request.body.proxy_password).toBe('secret');
    expect(request.body.messages).toEqual([{ role: 'user', content: 'Hello' }]);
    expect(request.body).not.toHaveProperty('metadata');
  });
});
