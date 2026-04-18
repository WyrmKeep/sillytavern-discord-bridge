import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { DiscordBridgeConfig } from '../config/schema.js';
import type { BridgeCharacter } from '../sillytavern/characters.js';
import type { ChatDocument, ChatMessage } from '../sillytavern/chats.js';
import { trimMessagesToContextBudget, type TokenBudgetMessage } from './token-budget.js';
import type { PromptProfile } from './types.js';

export type HeadlessPromptRole = 'system' | 'user' | 'assistant';

export type HeadlessPromptMessage = {
  role: HeadlessPromptRole;
  content: string;
};

export type LoadedSillyTavernPreset = {
  filePath: string;
  raw: Record<string, unknown>;
};

export type LoadSillyTavernPresetInput = {
  dataRoot: string;
  userHandle: string;
  presetName: string;
};

export type BuildHeadlessPromptMessagesInput = {
  preset: LoadedSillyTavernPreset;
  character: BridgeCharacter;
  profiles: Record<string, PromptProfile>;
  activeDiscordUserId?: string;
  activeDiscordDisplayName?: string;
  chat: ChatDocument;
  options: HeadlessPromptDefaults;
};

type HeadlessPromptDefaults = Omit<DiscordBridgeConfig['defaults'], 'contextBudgetTokens'> & {
  contextBudgetTokens?: number;
};

type PromptDefinition = {
  identifier: string;
  name?: string;
  role?: HeadlessPromptRole;
  content?: string;
  marker?: boolean;
  system_prompt?: boolean;
};

type PromptOrderEntry = {
  identifier: string;
  enabled: boolean;
};

type MacroContext = {
  characterName: string;
  userName: string;
  systemPrompt: string;
  description: string;
  persona: string;
  personality: string;
  scenario: string;
  mesExample: string;
  firstMessage: string;
  postHistoryInstructions: string;
};

export class HeadlessPromptProfileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HeadlessPromptProfileError';
  }
}

const DEFAULT_PROMPTS: PromptDefinition[] = [
  {
    name: 'Main Prompt',
    system_prompt: true,
    role: 'system',
    content: "Write {{char}}'s next reply in a fictional chat between {{charIfNotGroup}} and {{user}}.",
    identifier: 'main',
  },
  {
    name: 'Auxiliary Prompt',
    system_prompt: true,
    role: 'system',
    content: '',
    identifier: 'nsfw',
  },
  {
    identifier: 'dialogueExamples',
    name: 'Chat Examples',
    system_prompt: true,
    marker: true,
  },
  {
    name: 'Post-History Instructions',
    system_prompt: true,
    role: 'system',
    content: '',
    identifier: 'jailbreak',
  },
  {
    identifier: 'chatHistory',
    name: 'Chat History',
    system_prompt: true,
    marker: true,
  },
  {
    identifier: 'worldInfoAfter',
    name: 'World Info (after)',
    system_prompt: true,
    marker: true,
  },
  {
    identifier: 'worldInfoBefore',
    name: 'World Info (before)',
    system_prompt: true,
    marker: true,
  },
  {
    identifier: 'enhanceDefinitions',
    role: 'system',
    name: 'Enhance Definitions',
    content: "If you have more knowledge of {{char}}, add to the character's lore and personality to enhance them but keep the Character Sheet's definitions absolute.",
    system_prompt: true,
    marker: false,
  },
  {
    identifier: 'charDescription',
    name: 'Char Description',
    system_prompt: true,
    marker: true,
  },
  {
    identifier: 'charPersonality',
    name: 'Char Personality',
    system_prompt: true,
    marker: true,
  },
  {
    identifier: 'scenario',
    name: 'Scenario',
    system_prompt: true,
    marker: true,
  },
  {
    identifier: 'personaDescription',
    name: 'Persona Description',
    system_prompt: true,
    marker: true,
  },
];

const DEFAULT_PROMPT_ORDER: PromptOrderEntry[] = [
  { identifier: 'main', enabled: true },
  { identifier: 'worldInfoBefore', enabled: true },
  { identifier: 'personaDescription', enabled: true },
  { identifier: 'charDescription', enabled: true },
  { identifier: 'charPersonality', enabled: true },
  { identifier: 'scenario', enabled: true },
  { identifier: 'enhanceDefinitions', enabled: false },
  { identifier: 'nsfw', enabled: true },
  { identifier: 'worldInfoAfter', enabled: true },
  { identifier: 'dialogueExamples', enabled: true },
  { identifier: 'chatHistory', enabled: true },
  { identifier: 'jailbreak', enabled: true },
];

const DEFAULT_CONTEXT_BUDGET_TOKENS = 180000;
const OMITTED_HISTORY_MARKER = '[Earlier chat history omitted to fit context window.]';

export async function loadSillyTavernPreset(input: LoadSillyTavernPresetInput): Promise<LoadedSillyTavernPreset> {
  const presetStem = sanitizePresetName(input.presetName);
  const filePath = path.join(input.dataRoot, input.userHandle, 'OpenAI Settings', `${presetStem}.json`);

  try {
    const raw = JSON.parse(await readFile(filePath, 'utf8')) as unknown;
    if (!isRecord(raw)) {
      throw new HeadlessPromptProfileError(`SillyTavern preset must be an object: ${filePath}`);
    }
    return { filePath, raw };
  } catch (error) {
    if (isNotFound(error)) {
      throw new HeadlessPromptProfileError(`SillyTavern Chat Completion preset not found: ${filePath}`);
    }
    throw error;
  }
}

export function buildHeadlessPromptMessages(input: BuildHeadlessPromptMessagesInput): HeadlessPromptMessage[] {
  const context = resolveMacroContext(input);
  const normalized = normalizePromptPreset(input.preset.raw);
  const promptsById = new Map(normalized.prompts.map((prompt) => [prompt.identifier, prompt]));
  const messages: TokenBudgetMessage[] = [];

  for (const entry of normalized.order) {
    if (!entry.enabled) {
      continue;
    }

    if (entry.identifier === 'chatHistory') {
      messages.push(...buildHistoryMessages(input.chat, input.profiles, context, input.options.maxHistoryMessages));
      continue;
    }

    const prompt = promptsById.get(entry.identifier);
    const content = resolvePromptContent(entry.identifier, prompt, input, context);
    const expandedContent = applyMacros(content, context);
    if (!expandedContent.trim()) {
      continue;
    }

    messages.push({
      role: prompt?.role ?? 'system',
      content: expandedContent,
      source: 'prompt',
    });
  }

  return trimMessagesToContextBudget({
    messages,
    contextBudgetTokens: input.options.contextBudgetTokens ?? DEFAULT_CONTEXT_BUDGET_TOKENS,
    omittedHistoryMarker: OMITTED_HISTORY_MARKER,
  }).map(({ role, content }) => ({ role, content }));
}

function normalizePromptPreset(raw: Record<string, unknown>): {
  prompts: PromptDefinition[];
  order: PromptOrderEntry[];
} {
  const prompts = normalizePrompts(raw.prompts);
  migrateLegacyPrompt(raw, prompts, 'main_prompt', 'main');
  migrateLegacyPrompt(raw, prompts, 'nsfw_prompt', 'nsfw');
  migrateLegacyPrompt(raw, prompts, 'jailbreak_prompt', 'jailbreak');

  return {
    prompts,
    order: normalizePromptOrder(raw.prompt_order),
  };
}

function normalizePrompts(value: unknown): PromptDefinition[] {
  const prompts = Array.isArray(value)
    ? value.filter(isRecord).map(toPromptDefinition).filter((prompt): prompt is PromptDefinition => prompt !== undefined)
    : [];
  const byId = new Map<string, PromptDefinition>();

  for (const prompt of DEFAULT_PROMPTS) {
    byId.set(prompt.identifier, { ...prompt });
  }
  for (const prompt of prompts) {
    byId.set(prompt.identifier, { ...byId.get(prompt.identifier), ...prompt });
  }

  return [...byId.values()];
}

function normalizePromptOrder(value: unknown): PromptOrderEntry[] {
  if (!Array.isArray(value)) {
    return DEFAULT_PROMPT_ORDER;
  }

  const directOrder = value.map(toPromptOrderEntry).filter((entry): entry is PromptOrderEntry => entry !== undefined);
  if (directOrder.length > 0) {
    return directOrder;
  }

  const orderedList = value.find((item) => isRecord(item) && Array.isArray(item.order));
  if (!isRecord(orderedList) || !Array.isArray(orderedList.order)) {
    return DEFAULT_PROMPT_ORDER;
  }

  const order = orderedList.order
    .map(toPromptOrderEntry)
    .filter((entry): entry is PromptOrderEntry => entry !== undefined);
  return order.length > 0 ? order : DEFAULT_PROMPT_ORDER;
}

function migrateLegacyPrompt(
  raw: Record<string, unknown>,
  prompts: PromptDefinition[],
  legacyKey: string,
  promptIdentifier: string,
): void {
  const content = raw[legacyKey];
  if (typeof content !== 'string') {
    return;
  }

  const prompt = prompts.find((item) => item.identifier === promptIdentifier);
  if (prompt) {
    prompt.content = content;
  }
}

function resolvePromptContent(
  identifier: string,
  prompt: PromptDefinition | undefined,
  input: BuildHeadlessPromptMessagesInput,
  context: MacroContext,
): string {
  switch (identifier) {
    case 'charDescription':
      return input.character.description;
    case 'charPersonality':
      return input.character.personality;
    case 'scenario':
      return input.character.scenario;
    case 'personaDescription':
      return activePersona(input);
    case 'dialogueExamples':
      return input.character.mesExample;
    case 'worldInfoBefore':
    case 'worldInfoAfter':
      return '';
    case 'jailbreak':
      return [
        prompt?.content ?? '',
        input.options.includePostHistoryInstructions ? input.character.postHistoryInstructions : '',
      ].filter((value) => value.trim().length > 0).join('\n');
    case 'main':
      return prompt?.content ?? context.systemPrompt;
    default:
      return prompt?.content ?? '';
  }
}

function buildHistoryMessages(
  chat: ChatDocument,
  profiles: Record<string, PromptProfile>,
  context: MacroContext,
  maxHistoryMessages: number,
): TokenBudgetMessage[] {
  return chat
    .slice(1)
    .slice(-maxHistoryMessages)
    .map((message) => toPromptMessage(message, profiles, context))
    .filter((message): message is TokenBudgetMessage => message !== undefined);
}

function toPromptMessage(
  message: ChatMessage,
  profiles: Record<string, PromptProfile>,
  context: MacroContext,
): TokenBudgetMessage | undefined {
  if (!message.mes && !message.swipes?.length) {
    return undefined;
  }

  if (message.is_user) {
    const discordUserId = message.extra?.discord_bridge?.discord_user_id;
    const profile = typeof discordUserId === 'string' ? profiles[discordUserId] : undefined;
    const promptName = profile?.enabled ? profile.promptName : message.name ?? 'User';
    const content = applyMacros(message.mes ?? '', context);
    if (!content.trim()) {
      return undefined;
    }
    return {
      role: 'user',
      content: `${promptName}: ${content}`,
      source: 'history',
    };
  }

  const selectedSwipe =
    message.swipes && typeof message.swipe_id === 'number'
      ? message.swipes[message.swipe_id]
      : undefined;
  const content = applyMacros(selectedSwipe ?? message.mes ?? '', context);
  if (!content.trim()) {
    return undefined;
  }
  return {
    role: 'assistant',
    content,
    source: 'history',
  };
}

function resolveMacroContext(input: BuildHeadlessPromptMessagesInput): MacroContext {
  const profile = input.activeDiscordUserId
    ? input.profiles[input.activeDiscordUserId]
    : undefined;
  const userName = profile?.enabled
    ? profile.displayName || profile.promptName
    : input.activeDiscordDisplayName || 'Discord User';
  return {
    characterName: input.character.name,
    userName,
    systemPrompt: input.character.systemPrompt,
    description: input.character.description,
    persona: profile?.enabled ? profile.persona : '',
    personality: input.character.personality,
    scenario: input.character.scenario,
    mesExample: input.character.mesExample,
    firstMessage: input.character.firstMes,
    postHistoryInstructions: input.character.postHistoryInstructions,
  };
}

function activePersona(input: BuildHeadlessPromptMessagesInput): string {
  const profile = input.activeDiscordUserId
    ? input.profiles[input.activeDiscordUserId]
    : undefined;
  return profile?.enabled ? profile.persona : '';
}

function applyMacros(value: string, context: MacroContext): string {
  let result = value;

  for (let index = 0; index < 5; index += 1) {
    const next = applyMacroPass(result, context);
    if (next === result) {
      return next;
    }
    result = next;
  }

  return result;
}

function applyMacroPass(value: string, context: MacroContext): string {
  return value
    .replace(/\{\{\/\/[\s\S]*?\}\}/gu, '')
    .replace(/\{\{random:([^{}]*)\}\}/giu, (_match, options: string) => chooseRandomMacroOption(options))
    .replace(/\{\{char\}\}/giu, context.characterName)
    .replace(/\{\{charIfNotGroup\}\}/giu, context.characterName)
    .replace(/\{\{user\}\}/giu, context.userName)
    .replace(/\{\{description\}\}/giu, context.description)
    .replace(/\{\{persona\}\}/giu, context.persona)
    .replace(/\{\{personality\}\}/giu, context.personality)
    .replace(/\{\{scenario\}\}/giu, context.scenario)
    .replace(/\{\{mes_example\}\}/giu, context.mesExample)
    .replace(/\{\{first_mes\}\}/giu, context.firstMessage)
    .replace(/\{\{post_history_instructions\}\}/giu, context.postHistoryInstructions)
    .replace(/\{\{system\}\}/giu, context.systemPrompt);
}

function chooseRandomMacroOption(options: string): string {
  const values = options
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  if (values.length === 0) {
    return '';
  }

  return values[Math.floor(Math.random() * values.length)] ?? '';
}

function sanitizePresetName(value: string): string {
  const trimmed = value.trim().replace(/\.json$/iu, '');
  if (!trimmed || trimmed.includes('/') || trimmed.includes('\\') || trimmed === '.' || trimmed === '..') {
    throw new HeadlessPromptProfileError('sillyTavernPresetName must be a preset filename without .json.');
  }
  return trimmed;
}

function toPromptDefinition(value: Record<string, unknown>): PromptDefinition | undefined {
  const identifier = optionalString(value.identifier);
  if (!identifier) {
    return undefined;
  }

  return {
    identifier,
    name: optionalString(value.name),
    role: normalizeRole(value.role),
    content: optionalPromptContent(value.content),
    marker: typeof value.marker === 'boolean' ? value.marker : undefined,
    system_prompt: typeof value.system_prompt === 'boolean' ? value.system_prompt : undefined,
  };
}

function toPromptOrderEntry(value: unknown): PromptOrderEntry | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const identifier = optionalString(value.identifier);
  if (!identifier) {
    return undefined;
  }
  return {
    identifier,
    enabled: value.enabled !== false,
  };
}

function normalizeRole(value: unknown): HeadlessPromptRole | undefined {
  return value === 'system' || value === 'user' || value === 'assistant' ? value : undefined;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function optionalPromptContent(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    const parts = value
      .map(optionalPromptContent)
      .filter((part): part is string => part !== undefined && part.length > 0);
    return parts.length > 0 ? parts.join('\n') : undefined;
  }

  if (isRecord(value)) {
    if (typeof value.text === 'string') {
      return value.text;
    }
    if ('content' in value) {
      return optionalPromptContent(value.content);
    }
  }

  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNotFound(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'ENOENT'
  );
}
