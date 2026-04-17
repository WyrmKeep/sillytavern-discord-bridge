import { splitDiscordMessage } from './forum.js';
import {
  appendAssistantMessage,
  appendUserMessage,
  createChatDocument,
  type ChatDocument,
} from '../sillytavern/chats.js';
import type { ConversationState } from '../state/schema.js';
import { createConversationState } from '../state/store.js';

export type NewConversationInput = {
  guildId: string;
  forumChannelId: string;
  threadId: string;
  starterMessageId: string;
  characterAvatarFile: string;
  characterName: string;
  firstMes: string;
  createdByDiscordUserId: string;
  createdAt: string;
};

export type NewConversationResult = {
  state: ConversationState;
  chat: ChatDocument;
  starterMessages: string[];
};

export function createNewConversation(input: NewConversationInput): NewConversationResult {
  const state = createConversationState({
    guildId: input.guildId,
    forumChannelId: input.forumChannelId,
    threadId: input.threadId,
    starterMessageId: input.starterMessageId,
    characterAvatarFile: input.characterAvatarFile,
    characterName: input.characterName,
    chatFileName: `${compactTimestamp(input.createdAt)}--${input.threadId}.jsonl`,
    createdByDiscordUserId: input.createdByDiscordUserId,
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
  });

  const chat = createChatDocument({
    guildId: input.guildId,
    forumChannelId: input.forumChannelId,
    threadId: input.threadId,
    characterAvatarFile: input.characterAvatarFile,
    chatFolderName: state.chatFolderName,
    createdByDiscordUserId: input.createdByDiscordUserId,
    createdAt: input.createdAt,
  });

  return {
    state,
    chat,
    starterMessages: splitDiscordMessage(input.firstMes || `${input.characterName} is ready to begin.`),
  };
}

export type MessageGenerationInput = {
  chat: ChatDocument;
  user: {
    discordUserId: string;
    discordMessageId: string;
    discordThreadId: string;
    promptName: string;
    content: string;
    sendDate: string;
  };
  assistant: {
    name: string;
    bridgeMessageId: string;
    discordMessageId: string;
    sendDate: string;
  };
  generate: () => Promise<string>;
};

export async function runMessageGenerationFlow(input: MessageGenerationInput): Promise<{
  reply: string;
}> {
  appendUserMessage(input.chat, {
    name: input.user.promptName,
    mes: input.user.content,
    sendDate: input.user.sendDate,
    discordUserId: input.user.discordUserId,
    discordMessageId: input.user.discordMessageId,
    discordThreadId: input.user.discordThreadId,
  });

  const reply = await input.generate();

  appendAssistantMessage(input.chat, {
    name: input.assistant.name,
    mes: reply,
    sendDate: input.assistant.sendDate,
    bridgeMessageId: input.assistant.bridgeMessageId,
    discordMessageId: input.assistant.discordMessageId,
    discordThreadId: input.user.discordThreadId,
    model: 'claude-sonnet-4-6',
  });

  return { reply };
}

function compactTimestamp(isoDate: string): string {
  return isoDate.replace(/[-:.]/g, '').replace(/\.\d{3}Z$/, 'Z');
}
