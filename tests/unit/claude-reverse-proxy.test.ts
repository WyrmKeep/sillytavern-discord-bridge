import { describe, expect, test } from 'vitest';
import {
  buildClaudeProxyRequest,
  buildClaudeProxyUrl,
  parseClaudeProxyResponse,
} from '../../src/server-plugin/generation/claude-reverse-proxy.js';
import type { SillyTavernClaudeSettings } from '../../src/server-plugin/sillytavern/settings.js';

const settings: SillyTavernClaudeSettings = {
  mainApi: 'openai',
  chatCompletionSource: 'claude',
  reverseProxy: 'http://example.invalid/v1/claude-proxy/',
  proxyPassword: undefined,
  model: 'claude-sonnet-4-6',
  maxTokens: 512,
  temperature: 0.7,
  topP: 0.9,
  topK: 40,
  assistantPrefill: 'Prefill',
  stopSequences: ['</END>'],
  stream: false,
  originalStreamOpenAI: true,
  useSystemPrompt: true,
  reasoningEffort: 'medium',
  verbosity: 'high',
};

describe('Claude reverse proxy request builder', () => {
  test('joins messages endpoint correctly', () => {
    expect(buildClaudeProxyUrl(settings.reverseProxy)).toBe(
      'http://example.invalid/v1/claude-proxy/messages',
    );
  });

  test('builds Sonnet 4.6 request with ST-compatible shaping fields', () => {
    const request = buildClaudeProxyRequest(settings, {
      system: ['System prompt'],
      messages: [{ role: 'user', content: 'Hello' }],
    });

    expect(request.body).toMatchObject({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      top_p: 0.9,
      top_k: 40,
      stop_sequences: ['</END>'],
      stream: false,
      system: [{ type: 'text', text: 'System prompt' }],
      messages: [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Prefill' },
      ],
    });
    expect(request.body).not.toHaveProperty('temperature');
    expect(request.body).not.toHaveProperty('metadata');
    expect(request.body).not.toHaveProperty('reasoning_effort');
    expect(request.body).not.toHaveProperty('verbosity');
    expect(request.headers).not.toHaveProperty('x-api-key');
  });

  test('adds x-api-key only when proxy password exists', () => {
    const request = buildClaudeProxyRequest(
      { ...settings, proxyPassword: 'secret', topP: 1 },
      { system: [], messages: [{ role: 'user', content: 'Hello' }] },
    );

    expect(request.headers['x-api-key']).toBe('secret');
    expect(request.body.temperature).toBe(0.7);
    expect(request.body).not.toHaveProperty('top_p');
  });

  test('parses Anthropic and OpenAI-style fallback responses', () => {
    expect(parseClaudeProxyResponse({ content: [{ type: 'text', text: 'Anthropic' }] })).toBe(
      'Anthropic',
    );
    expect(parseClaudeProxyResponse({ choices: [{ message: { content: 'OpenAI' } }] })).toBe(
      'OpenAI',
    );
  });
});
