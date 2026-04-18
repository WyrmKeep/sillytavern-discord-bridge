import type { BridgePrompt } from './types.js';
import type { SillyTavernClaudeSettings } from '../sillytavern/settings.js';

export type ClaudeProxyRequestBody = {
  model: 'claude-sonnet-4-6';
  max_tokens: number;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  system?: Array<{ type: 'text'; text: string }>;
  stop_sequences?: string[];
  temperature?: number;
  top_p?: number;
  top_k?: number;
  stream: false;
};

export type ClaudeProxyRequest = {
  url: string;
  headers: Record<string, string>;
  body: ClaudeProxyRequestBody;
};

export class GenerationError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly redactedBodyPreview?: string,
  ) {
    super(message);
    this.name = 'GenerationError';
  }
}

export function buildClaudeProxyUrl(reverseProxy: string): string {
  return `${reverseProxy.replace(/\/+$/, '')}/messages`;
}

export function buildClaudeProxyRequest(
  settings: SillyTavernClaudeSettings,
  prompt: BridgePrompt,
): ClaudeProxyRequest {
  const messages = [...prompt.messages];
  if (settings.assistantPrefill) {
    messages.push({ role: 'assistant', content: settings.assistantPrefill });
  }

  const body: ClaudeProxyRequestBody = {
    model: settings.model,
    max_tokens: settings.maxTokens,
    messages,
    stream: false,
  };

  if (settings.useSystemPrompt && prompt.system.length > 0) {
    body.system = prompt.system.map((text) => ({ type: 'text', text }));
  }
  if (settings.stopSequences.length > 0) {
    body.stop_sequences = settings.stopSequences;
  }
  if (settings.topK !== undefined) {
    body.top_k = settings.topK;
  }
  if (settings.topP < 1) {
    body.top_p = settings.topP;
  } else {
    body.temperature = settings.temperature;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'anthropic-version': '2023-06-01',
  };
  if (settings.proxyPassword) {
    headers['x-api-key'] = settings.proxyPassword;
  }

  return {
    url: buildClaudeProxyUrl(settings.reverseProxy),
    headers,
    body,
  };
}

export function parseClaudeProxyResponse(response: unknown): string {
  const value = response as any;
  const anthropicText = value?.content?.find?.((part: any) => typeof part?.text === 'string')?.text;
  if (typeof anthropicText === 'string') {
    return anthropicText;
  }

  const openAiText = value?.choices?.[0]?.message?.content;
  if (typeof openAiText === 'string') {
    return openAiText;
  }

  throw new GenerationError('Claude proxy response did not contain text.');
}

export async function sendClaudeProxyRequest(
  request: ClaudeProxyRequest,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const response = await fetchImpl(request.url, {
    method: 'POST',
    headers: request.headers,
    body: JSON.stringify(request.body),
  });

  if (!response.ok) {
    throw new GenerationError(
      `Claude proxy request failed with status ${response.status}.`,
      response.status,
      await redactedPreview(response),
    );
  }

  return parseClaudeProxyResponse(await response.json());
}

async function redactedPreview(response: Response): Promise<string> {
  try {
    const text = await response.text();
    return text.slice(0, 300);
  } catch {
    return '';
  }
}
