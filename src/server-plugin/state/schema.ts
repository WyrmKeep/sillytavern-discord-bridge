import { z } from 'zod';

export const conversationStateSchema = z.object({
  guildId: z.string().min(1),
  forumChannelId: z.string().min(1),
  threadId: z.string().min(1),
  starterMessageId: z.string().min(1),
  characterAvatarFile: z.string().min(1),
  chatFolderName: z.string().min(1),
  characterName: z.string().min(1),
  chatFileName: z.string().endsWith('.jsonl'),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  createdByDiscordUserId: z.string().min(1),
  lastAssistantDiscordMessageId: z.string().optional(),
  lastAssistantBridgeMessageId: z.string().optional(),
});

export const bridgeStateSchema = z.object({
  version: z.literal(1),
  conversations: z.record(z.string(), conversationStateSchema),
});

export type ConversationState = z.infer<typeof conversationStateSchema>;
export type DiscordBridgeState = z.infer<typeof bridgeStateSchema>;
