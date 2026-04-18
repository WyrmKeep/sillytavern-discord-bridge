import type { SillyTavernClaudeSettings } from '../sillytavern/settings.js';
import type { HeadlessPromptMessage } from './headless-prompt-profile.js';

export type SillyTavernBackendRequestBody = {
  type: 'normal';
  messages: HeadlessPromptMessage[];
  model: 'claude-sonnet-4-6';
  temperature: number;
  top_p: number;
  max_tokens: number;
  stream: false;
  stop?: string[];
  chat_completion_source: 'claude';
  user_name: string;
  char_name: string;
  group_names: string[];
  include_reasoning: false;
  reasoning_effort?: SillyTavernClaudeSettings['reasoningEffort'];
  verbosity?: SillyTavernClaudeSettings['verbosity'];
  reverse_proxy: string;
  proxy_password?: string;
  top_k: number;
  use_sysprompt: boolean;
  assistant_prefill?: string;
};

export type SillyTavernBackendRequest = {
  path: '/api/backends/chat-completions/generate';
  body: SillyTavernBackendRequestBody;
};

export type SendSillyTavernBackendRequestOptions = {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
};

export class SillyTavernBackendGenerationError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly redactedBodyPreview?: string,
  ) {
    super(message);
    this.name = 'SillyTavernBackendGenerationError';
  }
}

export function buildSillyTavernBackendRequest(input: {
  settings: SillyTavernClaudeSettings;
  messages: HeadlessPromptMessage[];
  characterName: string;
  userName: string;
}): SillyTavernBackendRequest {
  const body: SillyTavernBackendRequestBody = {
    type: 'normal',
    messages: input.messages,
    model: input.settings.model,
    temperature: input.settings.temperature,
    top_p: input.settings.topP,
    max_tokens: input.settings.maxTokens,
    stream: false,
    chat_completion_source: input.settings.chatCompletionSource,
    user_name: input.userName,
    char_name: input.characterName,
    group_names: [],
    include_reasoning: false,
    reverse_proxy: input.settings.reverseProxy,
    proxy_password: input.settings.proxyPassword,
    top_k: input.settings.topK ?? 0,
    use_sysprompt: input.settings.useSystemPrompt,
  };

  if (input.settings.stopSequences.length > 0) {
    body.stop = input.settings.stopSequences;
  }
  if (input.settings.assistantPrefill) {
    body.assistant_prefill = input.settings.assistantPrefill;
  }
  if (input.settings.reasoningEffort !== 'auto') {
    body.reasoning_effort = input.settings.reasoningEffort;
  }
  if (input.settings.verbosity !== 'auto') {
    body.verbosity = input.settings.verbosity;
  }

  return {
    path: '/api/backends/chat-completions/generate',
    body,
  };
}

export async function sendSillyTavernBackendRequest(
  request: SillyTavernBackendRequest,
  options: SendSillyTavernBackendRequestOptions = {},
): Promise<string> {
  const baseUrl = normalizeBaseUrl(options.baseUrl ?? defaultSillyTavernBaseUrl());
  const fetchImpl = options.fetchImpl ?? fetch;
  const csrf = await fetchCsrfContext(baseUrl, fetchImpl);
  const response = await fetchImpl(`${baseUrl}${request.path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(csrf.token ? { 'X-CSRF-Token': csrf.token } : {}),
      ...(csrf.cookie ? { Cookie: csrf.cookie } : {}),
    },
    body: JSON.stringify(request.body),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new SillyTavernBackendGenerationError(
      `SillyTavern backend generation failed with status ${response.status}.`,
      response.status,
      text.slice(0, 300),
    );
  }

  const json = tryParseJson(text);
  if (isRecord(json) && 'error' in json) {
    throw new SillyTavernBackendGenerationError(
      'SillyTavern backend generation returned an error.',
      response.status,
      JSON.stringify(redactError(json)).slice(0, 300),
    );
  }
  if (typeof json === 'string') {
    return json;
  }
  if (typeof text === 'string' && text.length > 0) {
    return text;
  }

  throw new SillyTavernBackendGenerationError('SillyTavern backend generation returned no text.');
}

async function fetchCsrfContext(
  baseUrl: string,
  fetchImpl: typeof fetch,
): Promise<{ token?: string; cookie?: string }> {
  const response = await fetchImpl(`${baseUrl}/csrf-token`);
  if (!response.ok) {
    return {};
  }
  const json = tryParseJson(await response.text());
  const token = isRecord(json) && typeof json.token === 'string' ? json.token : undefined;
  return {
    token,
    cookie: extractCookieHeader(response.headers),
  };
}

function defaultSillyTavernBaseUrl(): string {
  return process.env.SILLYTAVERN_BASE_URL ?? `http://127.0.0.1:${process.env.SILLYTAVERN_PORT ?? '8000'}`;
}

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/u, '');
}

function extractCookieHeader(headers: Headers): string | undefined {
  const headerLike = headers as Headers & { getSetCookie?: () => string[] };
  const cookies = headerLike.getSetCookie?.() ?? [headers.get('set-cookie')].filter((value): value is string => Boolean(value));
  const pairs = cookies
    .map((cookie) => cookie.split(';')[0]?.trim())
    .filter((cookie): cookie is string => Boolean(cookie));
  return pairs.length > 0 ? pairs.join('; ') : undefined;
}

function tryParseJson(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return undefined;
  }
}

function redactError(value: Record<string, unknown>): Record<string, unknown> {
  return structuredClone(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
