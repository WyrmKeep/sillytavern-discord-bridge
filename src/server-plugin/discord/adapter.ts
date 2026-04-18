import type { BridgeDiscordApi } from '../bridge/runtime.js';

export type DiscordJsClientLike = {
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
  };
}

async function fetchThread(client: DiscordJsClientLike, threadId: string): Promise<any> {
  const thread = await client.channels.fetch(threadId);
  if (!thread?.send) {
    throw new Error(`Discord thread not found or cannot send messages: ${threadId}`);
  }
  return thread;
}
