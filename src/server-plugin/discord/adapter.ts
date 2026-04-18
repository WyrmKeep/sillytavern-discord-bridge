import type { BridgeDiscordApi } from '../bridge/runtime.js';

export type DiscordJsClientLike = {
  user?: {
    id?: string;
  } | null;
  channels: {
    fetch(id: string): Promise<any>;
  };
};

export function createDiscordAdapter(client: DiscordJsClientLike): BridgeDiscordApi {
  return {
    createForumThread: async (input) => {
      const channel = await client.channels.fetch(input.forumChannelId);
      if (!channel?.threads?.create) {
        throw new Error(`Discord forum channel not found or cannot create threads: ${input.forumChannelId}`);
      }

      const thread = await channel.threads.create({
        name: input.title,
        message: { content: input.firstMessage },
        ...(input.appliedTagIds.length > 0 ? { appliedTags: input.appliedTagIds } : {}),
      });
      const starterMessage = typeof thread.fetchStarterMessage === 'function'
        ? await thread.fetchStarterMessage().catch(() => undefined)
        : undefined;

      return {
        threadId: String(thread.id),
        starterMessageId: String(starterMessage?.id ?? thread.id),
      };
    },
    sendThreadMessage: async (input) => {
      const thread = await fetchThread(client, input.threadId);
      const message = await thread.send({
        content: input.content,
        ...(input.components ? { components: input.components } : {}),
      });

      return { messageId: String(message.id) };
    },
    editMessage: async (input) => {
      const thread = await fetchThread(client, input.threadId);
      if (!thread.messages?.fetch) {
        throw new Error(`Discord thread cannot fetch messages: ${input.threadId}`);
      }

      const message = await thread.messages.fetch(input.messageId);
      if (!message?.edit) {
        throw new Error(`Discord message cannot be edited: ${input.messageId}`);
      }

      await message.edit({
        content: input.content,
        ...(input.components !== undefined ? { components: input.components } : {}),
      });
    },
    startTyping: async (threadId) => {
      const thread = await fetchThread(client, threadId);
      if (!thread.sendTyping) {
        throw new Error(`Discord thread cannot send typing indicators: ${threadId}`);
      }
      await thread.sendTyping();
    },
    addReaction: async (input) => {
      const message = await fetchThreadMessage(client, input.threadId, input.messageId);
      if (!message.react) {
        throw new Error(`Discord message cannot receive reactions: ${input.messageId}`);
      }
      await message.react(input.emoji);
    },
    removeReaction: async (input) => {
      const message = await fetchThreadMessage(client, input.threadId, input.messageId);
      const reaction = message.reactions?.resolve?.(input.emoji)
        ?? message.reactions?.cache?.get?.(input.emoji);
      const botUserId = client.user?.id;
      if (!reaction?.users?.remove || !botUserId) {
        return;
      }
      await reaction.users.remove(botUserId);
    },
  };
}

async function fetchThread(client: DiscordJsClientLike, threadId: string): Promise<any> {
  const thread = await client.channels.fetch(threadId);
  if (!thread?.send) {
    throw new Error(`Discord thread not found or cannot send messages: ${threadId}`);
  }
  return thread;
}

async function fetchThreadMessage(
  client: DiscordJsClientLike,
  threadId: string,
  messageId: string,
): Promise<any> {
  const thread = await fetchThread(client, threadId);
  if (!thread.messages?.fetch) {
    throw new Error(`Discord thread cannot fetch messages: ${threadId}`);
  }

  const message = await thread.messages.fetch(messageId);
  if (!message) {
    throw new Error(`Discord message not found: ${messageId}`);
  }
  return message;
}
