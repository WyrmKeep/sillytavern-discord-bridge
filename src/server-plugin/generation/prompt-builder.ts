import type { BridgeCharacter } from '../sillytavern/characters.js';
import type { ChatDocument, ChatMessage } from '../sillytavern/chats.js';
import type { BridgePrompt, BridgePromptMessage, PromptProfile } from './types.js';

export type BuildBridgePromptInput = {
  character: BridgeCharacter;
  profiles: Record<string, PromptProfile>;
  activeDiscordUserId?: string;
  activeDiscordDisplayName?: string;
  chat: ChatDocument;
  options: {
    includeCreatorNotes: boolean;
    includePostHistoryInstructions: boolean;
    maxHistoryMessages: number;
    maxReplyCharacters: number;
  };
};

export function buildBridgePrompt(input: BuildBridgePromptInput): BridgePrompt {
  const macroContext = resolveMacroContext(input);
  const system = buildSystemBlocks(input);
  const messages = input.chat
    .slice(1)
    .slice(-input.options.maxHistoryMessages)
    .map((message) => toPromptMessage(message, input.profiles, macroContext))
    .filter((message): message is BridgePromptMessage => message !== undefined);

  return { system, messages };
}

export function fallbackStarterMessage(character: BridgeCharacter): string {
  return `${character.name} is ready to begin.`;
}

function buildSystemBlocks(input: BuildBridgePromptInput): string[] {
  const { character, profiles, options } = input;
  const macroContext = resolveMacroContext(input);
  const blocks = [
    `This is a Discord roleplay bridge. Respond only as ${character.name}.`,
    labeled('Name', character.name),
    labeled('Description', applyMacros(character.description, macroContext)),
    labeled('Personality', applyMacros(character.personality, macroContext)),
    labeled('Scenario', applyMacros(character.scenario, macroContext)),
    labeled('System Prompt', applyMacros(character.systemPrompt, macroContext)),
    labeled('Example Dialogue', applyMacros(character.mesExample, macroContext)),
    `Keep replies under roughly ${options.maxReplyCharacters} Discord characters when practical.`,
  ];

  if (options.includeCreatorNotes) {
    blocks.push(labeled('Creator Notes', applyMacros(character.creatorNotes, macroContext)));
  }
  if (options.includePostHistoryInstructions) {
    blocks.push(labeled('Post History Instructions', applyMacros(character.postHistoryInstructions, macroContext)));
  }

  for (const profile of Object.values(profiles)) {
    if (profile.enabled) {
      blocks.push(labeled(`Participant ${profile.promptName}`, applyMacros(profile.persona, macroContext)));
    }
  }

  return blocks.filter((block) => block.trim().length > 0);
}

function toPromptMessage(
  message: ChatMessage,
  profiles: Record<string, PromptProfile>,
  macroContext: MacroContext,
): BridgePromptMessage | undefined {
  if (!message.mes && !message.swipes?.length) {
    return undefined;
  }

  if (message.is_user) {
    const discordUserId = message.extra?.discord_bridge?.discord_user_id;
    const profile =
      typeof discordUserId === 'string' ? profiles[discordUserId] : undefined;
    const promptName = profile?.enabled ? profile.promptName : message.name ?? 'User';
    return {
      role: 'user',
      content: `${promptName}: ${applyMacros(message.mes ?? '', macroContext)}`,
    };
  }

  const selectedSwipe =
    message.swipes && typeof message.swipe_id === 'number'
      ? message.swipes[message.swipe_id]
      : undefined;
  return {
    role: 'assistant',
    content: applyMacros(selectedSwipe ?? message.mes ?? '', macroContext),
  };
}

function labeled(label: string, value: string): string {
  return value.trim().length > 0 ? `${label}: ${value}` : '';
}

type MacroContext = {
  characterName: string;
  userName: string;
};

function resolveMacroContext(input: BuildBridgePromptInput): MacroContext {
  const profile = input.activeDiscordUserId
    ? input.profiles[input.activeDiscordUserId]
    : undefined;
  const userName = profile?.enabled
    ? profile.displayName || profile.promptName
    : input.activeDiscordDisplayName || 'Discord User';
  return {
    characterName: input.character.name,
    userName,
  };
}

function applyMacros(value: string, context: MacroContext): string {
  return value
    .replace(/\{\{char\}\}/giu, context.characterName)
    .replace(/\{\{user\}\}/giu, context.userName);
}
