import { describe, expect, test, vi } from 'vitest';
import {
  buildSillyTavernBackendRequest,
  sendSillyTavernBackendRequest,
} from '../../src/server-plugin/generation/st-backend-generation.js';
import type { SillyTavernClaudeSettings } from '../../src/server-plugin/sillytavern/settings.js';

const settings: SillyTavernClaudeSettings = {
  mainApi: 'openai',
  chatCompletionSource: 'claude',
  reverseProxy: 'http://example.invalid/v1/claude',
  proxyPassword: 'proxy-secret',
  model: 'claude-sonnet-4-6',
  maxTokens: 400,
  temperature: 0.7,
  topP: 1,
  topK: 40,
  assistantPrefill: 'Assistant prefill.',
  stopSequences: ['STOP'],
  stream: false,
  originalStreamOpenAI: true,
  useSystemPrompt: true,
  reasoningEffort: 'auto',
  verbosity: 'auto',
};

describe('SillyTavern backend generation', () => {
  test('builds the ST chat-completions generate request without appending prefill to messages', () => {
    const request = buildSillyTavernBackendRequest({
      settings,
      messages: [{ role: 'user', content: 'Hello' }],
      characterName: 'Alice',
      userName: 'Rober',
    });

    expect(request.path).toBe('/api/backends/chat-completions/generate');
    expect(request.body).toMatchObject({
      type: 'normal',
      chat_completion_source: 'claude',
      model: 'claude-sonnet-4-6',
      reverse_proxy: 'http://example.invalid/v1/claude',
      proxy_password: 'proxy-secret',
      top_k: 40,
      use_sysprompt: true,
      assistant_prefill: 'Assistant prefill.',
      user_name: 'Rober',
      char_name: 'Alice',
    });
    expect(request.body.messages).toEqual([{ role: 'user', content: 'Hello' }]);
  });

  test('posts through SillyTavern with CSRF token and session cookie', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === 'http://127.0.0.1:8000/csrf-token') {
        return new Response(JSON.stringify({ token: 'csrf-token' }), {
          headers: {
            'content-type': 'application/json',
            'set-cookie': 'session=value; Path=/; HttpOnly',
          },
        });
      }

      expect(url).toBe('http://127.0.0.1:8000/api/backends/chat-completions/generate');
      expect(init?.headers).toMatchObject({
        'Content-Type': 'application/json',
        'X-CSRF-Token': 'csrf-token',
        Cookie: 'session=value',
      });
      return new Response('Generated reply.');
    });

    const result = await sendSillyTavernBackendRequest(
      buildSillyTavernBackendRequest({
        settings,
        messages: [{ role: 'user', content: 'Hello' }],
        characterName: 'Alice',
        userName: 'Rober',
      }),
      { baseUrl: 'http://127.0.0.1:8000', fetchImpl },
    );

    expect(result).toBe('Generated reply.');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
