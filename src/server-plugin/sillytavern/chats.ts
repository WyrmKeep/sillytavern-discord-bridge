import path from 'node:path';

export type DiscordBridgeExtra = Record<string, unknown> & {
  discord_bridge?: Record<string, unknown>;
};

export type SwipeInfo = {
  send_date?: string;
  extra?: DiscordBridgeExtra;
};

export type ChatMessage = {
  name?: string;
  is_user?: boolean;
  send_date?: string;
  mes?: string;
  swipes?: string[];
  swipe_id?: number;
  swipe_info?: SwipeInfo[];
  extra?: DiscordBridgeExtra;
  chat_metadata?: Record<string, unknown>;
  user_name?: string;
  character_name?: string;
};

export type ChatDocument = ChatMessage[];

export type CreateChatInput = {
  guildId: string;
  forumChannelId: string;
  threadId: string;
  characterAvatarFile: string;
  chatFolderName: string;
  createdByDiscordUserId: string;
  createdAt: string;
};

export type UserMessageInput = {
  name: string;
  mes: string;
  sendDate: string;
  discordUserId: string;
  discordMessageId: string;
  discordThreadId: string;
};

export type AssistantMessageInput = {
  name: string;
  mes: string;
  sendDate: string;
  bridgeMessageId: string;
  discordMessageId: string;
  discordThreadId: string;
  model: 'claude-sonnet-4-6';
};

export function buildChatFilePath(
  dataRoot: string,
  handle: string,
  chatFolderName: string,
  chatFileName: string,
): string {
  return path.join(dataRoot, handle, 'chats', chatFolderName, chatFileName).replace(/\\/g, '/');
}

export function createChatDocument(input: CreateChatInput): ChatDocument {
  return [
    {
      chat_metadata: {
        main_chat: null,
        discord_bridge: {
          version: 1,
          guild_id: input.guildId,
          forum_channel_id: input.forumChannelId,
          thread_id: input.threadId,
          character_avatar_file: input.characterAvatarFile,
          chat_folder_name: input.chatFolderName,
          created_by: input.createdByDiscordUserId,
          created_at: input.createdAt,
        },
      },
      user_name: 'unused',
      character_name: 'unused',
    },
  ];
}

export function appendUserMessage(chat: ChatDocument, input: UserMessageInput): ChatMessage {
  const message: ChatMessage = {
    name: input.name,
    is_user: true,
    send_date: input.sendDate,
    mes: input.mes,
    extra: {
      discord_bridge: {
        discord_user_id: input.discordUserId,
        discord_message_id: input.discordMessageId,
        discord_thread_id: input.discordThreadId,
      },
    },
  };
  chat.push(message);
  return message;
}

export function appendAssistantMessage(
  chat: ChatDocument,
  input: AssistantMessageInput,
): ChatMessage {
  const swipeInfo: SwipeInfo = {
    send_date: input.sendDate,
    extra: {
      api: 'claude-reverse-proxy',
      model: input.model,
      discord_bridge: {
        bridge_message_id: input.bridgeMessageId,
        discord_message_id: input.discordMessageId,
      },
    },
  };
  const message: ChatMessage = {
    name: input.name,
    is_user: false,
    send_date: input.sendDate,
    mes: input.mes,
    swipes: [input.mes],
    swipe_id: 0,
    swipe_info: [swipeInfo],
    extra: {
      api: 'claude-reverse-proxy',
      model: input.model,
      discord_bridge: {
        bridge_message_id: input.bridgeMessageId,
        discord_thread_id: input.discordThreadId,
      },
    },
  };
  chat.push(message);
  return message;
}

export function selectSwipe(message: ChatMessage, swipeIndex: number): void {
  if (!message.swipes || !message.swipe_info) {
    throw new Error('Message does not contain swipes.');
  }
  if (swipeIndex < 0 || swipeIndex >= message.swipes.length) {
    throw new Error(`Swipe index ${swipeIndex} is out of range.`);
  }
  if (message.swipes.length !== message.swipe_info.length) {
    throw new Error('swipes and swipe_info must stay aligned.');
  }
  message.swipe_id = swipeIndex;
  message.mes = message.swipes[swipeIndex];
}

export function parseJsonlChat(input: string): ChatDocument {
  return input
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as ChatMessage);
}

export function serializeJsonlChat(chat: ChatDocument): string {
  return `${chat.map((line) => JSON.stringify(line)).join('\n')}\n`;
}

export function findAssistantMessageByBridgeId(
  chat: ChatDocument,
  bridgeMessageId: string,
): ChatMessage | undefined {
  return chat.find(
    (message) =>
      !message.is_user &&
      message.extra?.discord_bridge?.bridge_message_id === bridgeMessageId,
  );
}
