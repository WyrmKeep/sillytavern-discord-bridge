import type { BridgeCharacter } from '../sillytavern/characters.js';
import type { ChatDocument, ChatMessage } from '../sillytavern/chats.js';
import type { BridgePrompt, BridgePromptMessage, PromptProfile } from './types.js';

export type BuildBridgePromptInput = {
  character: BridgeCharacter;
  profiles: Record<string, PromptProfile>;
  chat: ChatDocument;
  options: {
    includeCreatorNotes: boolean;
    includePostHistoryInstructions: boolean;
    maxHistoryMessages: number;
    maxReplyCharacters: number;
  };
};

export function buildBridgePrompt(input: BuildBridgePromptInput): BridgePrompt {
  const system = buildSystemBlocks(input);
  const messages = input.chat
    .slice(1)
    .slice(-input.options.maxHistoryMessages)
    .map((message) => toPromptMessage(message, input.profiles))
    .filter((message): message is BridgePromptMessage => message !== undefined);

  return { system, messages };
}

export function fallbackStarterMessage(character: BridgeCharacter): string {
  return `${character.name} is ready to begin.`;
}

function buildSystemBlocks(input: BuildBridgePromptInput): string[] {
  const { character, profiles, options } = input;
  const blocks = [
    `This is a Discord roleplay bridge. Respond only as ${character.name}.`,
    labeled('Name', character.name),
    labeled('Description', character.description),
    labeled('Personality', character.personality),
    labeled('Scenario', character.scenario),
    labeled('System Prompt', character.systemPrompt),
    labeled('Example Dialogue', character.mesExample),
    `Keep replies under roughly ${options.maxReplyCharacters} Discord characters when practical.`,
  ];

  if (options.includeCreatorNotes) {
    blocks.push(labeled('Creator Notes', character.creatorNotes));
  }
  if (options.includePostHistoryInstructions) {
    blocks.push(labeled('Post History Instructions', character.postHistoryInstructions));
  }

  for (const profile of Object.values(profiles)) {
    if (profile.enabled) {
      blocks.push(labeled(`Participant ${profile.promptName}`, profile.persona));
    }
  }

  return blocks.filter((block) => block.trim().length > 0);
}

function toPromptMessage(
  message: ChatMessage,
  profiles: Record<string, PromptProfile>,
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
      content: `${promptName}: ${message.mes ?? ''}`,
    };
  }

  const selectedSwipe =
    message.swipes && typeof message.swipe_id === 'number'
      ? message.swipes[message.swipe_id]
      : undefined;
  return {
    role: 'assistant',
    content: selectedSwipe ?? message.mes ?? '',
  };
}

function labeled(label: string, value: string): string {
  return value.trim().length > 0 ? `${label}: ${value}` : '';
}
