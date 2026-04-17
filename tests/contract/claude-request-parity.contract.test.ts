import { describe, expect, test } from 'vitest';
import { buildClaudeProxyRequest } from '../../src/server-plugin/generation/claude-reverse-proxy.js';
import type { SillyTavernClaudeSettings } from '../../src/server-plugin/sillytavern/settings.js';

describe('Claude request parity contract', () => {
  test('captures supported Claude 4.6 fields', () => {
    const settings: SillyTavernClaudeSettings = {
      mainApi: 'openai',
      chatCompletionSource: 'claude',
      reverseProxy: 'http://example.invalid/v1',
      model: 'claude-sonnet-4-6',
      maxTokens: 300,
      temperature: 1,
      topP: 1,
      topK: 20,
      assistantPrefill: undefined,
      stopSequences: ['STOP'],
      stream: false,
      originalStreamOpenAI: false,
      useSystemPrompt: true,
      reasoningEffort: 'auto',
      verbosity: 'auto',
    };

    const request = buildClaudeProxyRequest(settings, {
      system: ['System'],
      messages: [{ role: 'user', content: 'Hello' }],
    });

    expect(request.url).toBe('http://example.invalid/v1/messages');
    expect(request.body.stop_sequences).toEqual(['STOP']);
    expect(request.body.top_k).toBe(20);
    expect(request.body.system).toEqual([{ type: 'text', text: 'System' }]);
  });
});
