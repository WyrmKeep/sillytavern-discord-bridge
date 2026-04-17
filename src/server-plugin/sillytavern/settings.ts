import { readFile } from 'node:fs/promises';

export type ReasoningEffort = 'auto' | 'low' | 'medium' | 'high' | 'min' | 'max';
export type Verbosity = 'auto' | 'low' | 'medium' | 'high';

export type SillyTavernClaudeSettings = {
  mainApi: string | undefined;
  chatCompletionSource: 'claude';
  reverseProxy: string;
  proxyPassword?: string;
  model: 'claude-sonnet-4-6';
  maxTokens: number;
  temperature: number;
  topP: number;
  topK: number | undefined;
  assistantPrefill: string | undefined;
  stopSequences: string[];
  stream: false;
  originalStreamOpenAI: boolean;
  useSystemPrompt: boolean;
  reasoningEffort: ReasoningEffort;
  verbosity: Verbosity;
};

export class SillyTavernSettingsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SillyTavernSettingsError';
  }
}

export async function readSillyTavernSettingsFile(filePath: string): Promise<unknown> {
  return JSON.parse(await readFile(filePath, 'utf8')) as unknown;
}

export function normalizeSillyTavernClaudeSettings(rawSettings: unknown): SillyTavernClaudeSettings {
  const root = asRecord(rawSettings, 'settings');
  const mainApi = optionalString(root.main_api);

  if (mainApi !== 'openai') {
    throw new SillyTavernSettingsError('main_api must be openai for Chat Completion use.');
  }

  const oai = asRecord(root.oai_settings, 'settings.oai_settings');
  const chatCompletionSource = optionalString(oai.chat_completion_source);
  if (chatCompletionSource !== 'claude') {
    throw new SillyTavernSettingsError('settings.oai_settings.chat_completion_source must be claude.');
  }

  const reverseProxy = optionalString(oai.reverse_proxy);
  if (!reverseProxy) {
    throw new SillyTavernSettingsError('settings.oai_settings.reverse_proxy is required.');
  }
  assertHttpUrl(reverseProxy, 'settings.oai_settings.reverse_proxy');

  const model = optionalString(oai.claude_model);
  if (model !== 'claude-sonnet-4-6') {
    throw new SillyTavernSettingsError('settings.oai_settings.claude_model must be claude-sonnet-4-6.');
  }

  return {
    mainApi,
    chatCompletionSource: 'claude',
    reverseProxy,
    proxyPassword: blankToUndefined(optionalString(oai.proxy_password)),
    model: 'claude-sonnet-4-6',
    maxTokens: numberOrDefault(oai.openai_max_tokens, 300),
    temperature: numberOrDefault(oai.temp_openai, 1),
    topP: numberOrDefault(oai.top_p_openai, 1),
    topK: normalizeTopK(oai.top_k_openai),
    assistantPrefill: blankToUndefined(optionalString(oai.assistant_prefill)),
    stopSequences: normalizeStopSequences(oai),
    stream: false,
    originalStreamOpenAI: Boolean(oai.stream_openai),
    useSystemPrompt: oai.use_sysprompt !== false,
    reasoningEffort: normalizeEnum<ReasoningEffort>(
      oai.reasoning_effort,
      ['auto', 'low', 'medium', 'high', 'min', 'max'],
      'auto',
    ),
    verbosity: normalizeEnum<Verbosity>(
      oai.verbosity,
      ['auto', 'low', 'medium', 'high'],
      'auto',
    ),
  };
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new SillyTavernSettingsError(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value.trim() : undefined;
}

function blankToUndefined(value: string | undefined): string | undefined {
  return value && value.length > 0 ? value : undefined;
}

function numberOrDefault(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function normalizeTopK(value: unknown): number | undefined {
  const topK = numberOrDefault(value, 0);
  return topK > 0 ? topK : undefined;
}

function normalizeStopSequences(oai: Record<string, unknown>): string[] {
  const candidates = [oai.stop_sequences, oai.stop, oai.custom_stopping_strings];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter((item): item is string => typeof item === 'string' && item.length > 0);
    }
  }
  return [];
}

function normalizeEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

function assertHttpUrl(value: string, label: string): void {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error('unsupported protocol');
    }
  } catch {
    throw new SillyTavernSettingsError(`${label} must be an absolute HTTP(S) URL.`);
  }
}
