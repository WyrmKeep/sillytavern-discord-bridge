import { randomUUID } from 'node:crypto';
import {
  type BridgePaths,
  resolveDefaultBridgePaths,
} from '../config/paths.js';
import { type DiscordBridgeConfig } from '../config/schema.js';
import { readConfig, writeConfig } from '../config/store.js';
import {
  buildHeadlessPromptMessages,
  loadSillyTavernPreset,
} from '../generation/headless-prompt-profile.js';
import {
  buildSillyTavernBackendRequest,
  sendSillyTavernBackendRequest,
} from '../generation/st-backend-generation.js';
import {
  fallbackUserDirectories,
  type UserDirectories,
} from '../sillytavern/users.js';
import {
  buildChatFilePath,
  findAssistantMessageByBridgeId,
  selectSwipe,
  type ChatDocument,
} from '../sillytavern/chats.js';
import {
  createNewConversation,
  runMessageGenerationFlow,
} from '../discord/conversation.js';
import {
  buildSwipeComponentPayload,
  decodeSwipeCustomId,
} from '../discord/components.js';
import {
  normalizeThreadTitle,
  splitDiscordMessage,
} from '../discord/forum.js';
import { checkAllowlist } from '../discord/message-handler.js';
import {
  normalizeSillyTavernClaudeSettings,
  readSillyTavernSettingsFile,
} from '../sillytavern/settings.js';
import {
  filterCharactersByTags,
  listCharacterCards,
  loadSillyTavernTags,
  type BridgeCharacter,
} from '../sillytavern/characters.js';
import {
  loadChatFile,
  saveChatFile,
} from '../sillytavern/chat-files.js';
import {
  emptyState,
  readState,
  writeState,
} from '../state/store.js';
import { createKeyedQueue, type KeyedQueue } from '../state/locks.js';
import type { ConversationState, DiscordBridgeState } from '../state/schema.js';
import type { PromptProfile } from '../generation/types.js';

export type BridgeDiscordApi = {
  createForumThread(input: {
    forumChannelId: string;
    title: string;
    firstMessage: string;
    appliedTagIds: string[];
  }): Promise<{ threadId: string; starterMessageId: string }>;
  sendThreadMessage(input: {
    threadId: string;
    content: string;
    components?: unknown;
  }): Promise<{ messageId: string }>;
  editMessage(input: {
    threadId: string;
    messageId: string;
    content: string;
    components?: unknown;
  }): Promise<void>;
  startTyping?(threadId: string): Promise<void>;
  addReaction?(input: {
    threadId: string;
    messageId: string;
    emoji: string;
  }): Promise<void>;
  removeReaction?(input: {
    threadId: string;
    messageId: string;
    emoji: string;
  }): Promise<void>;
};

export type ActivityTimers = {
  setInterval(callback: () => void, milliseconds: number): unknown;
  clearInterval(handle: unknown): void;
};

export type BridgeRuntimeDependencies = {
  paths?: BridgePaths;
  queue?: KeyedQueue;
  now?: () => Date;
  activityTimers?: ActivityTimers;
  generateReply?: (input: {
    config: DiscordBridgeConfig;
    character: BridgeCharacter;
    chat: ChatDocument;
  }) => Promise<string>;
  fetchImpl?: typeof fetch;
  sillyTavernBaseUrl?: string;
};

export type StartNewConversationInput = {
  discordUserId: string;
  discordDisplayName?: string;
  characterAvatarFile?: string;
  discord: BridgeDiscordApi;
};

export type ThreadMessageInput = {
  threadId: string;
  discordUserId: string;
  discordDisplayName?: string;
  discordMessageId: string;
  content: string;
  discord: BridgeDiscordApi;
};

export type ThreadMessageResult =
  | { kind: 'ignored' }
  | { kind: 'missing-thread' }
  | { kind: 'replied'; reply: string; assistantDiscordMessageId: string };

export type SwipeInput = {
  customId: string;
  discordUserId: string;
  discord: BridgeDiscordApi;
};

export type SetPersonaInput = {
  discordUserId: string;
  discordDisplayName?: string;
  displayName: string;
  persona: string;
};

export type SwipeResult =
  | { kind: 'ignored' }
  | { kind: 'updated'; selectedIndex: number; total: number }
  | { kind: 'missing-thread' };

export type BridgeRuntime = {
  listCharacters(): Promise<BridgeCharacter[]>;
  getConversation(threadId: string): Promise<ConversationState | undefined>;
  startNewConversation(input: StartNewConversationInput): Promise<{
    threadId: string;
    state: ConversationState;
  }>;
  handleThreadMessage(input: ThreadMessageInput): Promise<ThreadMessageResult>;
  handleSwipe(input: SwipeInput): Promise<SwipeResult>;
  setPersona(input: SetPersonaInput): Promise<PromptProfile>;
};

export function createBridgeRuntime(dependencies: BridgeRuntimeDependencies = {}): BridgeRuntime {
  const paths = dependencies.paths ?? resolveDefaultBridgePaths();
  const queue = dependencies.queue ?? createKeyedQueue();
  const now = dependencies.now ?? (() => new Date());
  const activityTimers = dependencies.activityTimers ?? defaultActivityTimers();

  return {
    listCharacters: async () => {
      const config = await readBridgeConfig(paths);
      return listExposedCharacterCards(paths, config);
    },
    getConversation: async (threadId) => {
      const state = await readState(paths.stateFile).catch(() => emptyState());
      return state.conversations[threadId];
    },
    startNewConversation: async (input) => {
      const config = await readBridgeConfig(paths);
      if (checkAllowlist(input.discordUserId, config.access.allowlistedUserIds) === 'ignore') {
        throw new Error('Discord user is not allowlisted.');
      }

      const character = await resolveCharacter(
        paths,
        config,
        input.characterAvatarFile || config.defaults.defaultCharacterAvatarFile,
        { enforceExposure: true },
      );
      const userName = profileDisplayName(config, input.discordUserId, input.discordDisplayName);
      const createdAt = now().toISOString();
      const title = normalizeThreadTitle(formatConversationTitle(config, character, now()));
      const firstMes = applyCharacterMacros(
        character.firstMes || `${character.name} is ready to begin.`,
        character.name,
        userName,
      );
      const starterMessages = splitDiscordMessage(firstMes);
      const thread = await input.discord.createForumThread({
        forumChannelId: config.discord.forumChannelId,
        title,
        firstMessage: starterMessages[0] ?? `${character.name} is ready to begin.`,
        appliedTagIds: config.discord.defaultForumTagIds,
      });
      for (const message of starterMessages.slice(1)) {
        await input.discord.sendThreadMessage({ threadId: thread.threadId, content: message });
      }

      const conversation = createNewConversation({
        guildId: config.discord.guildId,
        forumChannelId: config.discord.forumChannelId,
        threadId: thread.threadId,
        starterMessageId: thread.starterMessageId,
        characterAvatarFile: character.characterAvatarFile,
        characterName: character.name,
        firstMes,
        createdByDiscordUserId: input.discordUserId,
        createdAt,
      });
      const chatPath = chatFilePath(paths, config, conversation.state);
      await queue.run(chatPath, async () => {
        await saveChatFile(chatPath, conversation.chat);
      });
      await updateState(paths, (state) => {
        state.conversations[thread.threadId] = conversation.state;
      });

      return { threadId: thread.threadId, state: conversation.state };
    },
    handleThreadMessage: async (input) => {
      const config = await readBridgeConfig(paths);
      if (checkAllowlist(input.discordUserId, config.access.allowlistedUserIds) === 'ignore') {
        return { kind: 'ignored' };
      }

      const state = (await readState(paths.stateFile)).conversations[input.threadId];
      if (!state) {
        return { kind: 'missing-thread' };
      }

      const chatPath = chatFilePath(paths, config, state);
      const activity = await startMessageActivityFeedback({
        config,
        discord: input.discord,
        threadId: input.threadId,
        messageId: input.discordMessageId,
        timers: activityTimers,
      });
      return queue.run(chatPath, async () => {
        try {
          const loaded = await loadChatFile(chatPath);
          const character = await resolveCharacter(paths, config, state.characterAvatarFile);
          const bridgeMessageId = randomUUID();
          const pendingAssistantDiscordMessageId = randomUUID();
          const result = await runMessageGenerationFlow({
            chat: loaded.chat,
            user: {
              discordUserId: input.discordUserId,
              discordMessageId: input.discordMessageId,
              discordThreadId: input.threadId,
              promptName: profilePromptName(config, input.discordUserId, input.discordDisplayName),
              content: input.content,
              sendDate: now().toISOString(),
            },
            assistant: {
              name: character.name,
              bridgeMessageId,
              discordMessageId: pendingAssistantDiscordMessageId,
              sendDate: now().toISOString(),
            },
            generate: async () =>
              dependencies.generateReply
                ? dependencies.generateReply({ config, character, chat: loaded.chat })
                : generateWithSillyTavernSettings(
                  paths,
                  config,
                  character,
                  loaded.chat,
                  input.discordUserId,
                  input.discordDisplayName,
                  {
                    fetchImpl: dependencies.fetchImpl,
                    sillyTavernBaseUrl: dependencies.sillyTavernBaseUrl,
                  },
                ),
          });
          const sent = await sendAssistantReply(input.discord, input.threadId, bridgeMessageId, result.reply);
          const assistant = findAssistantMessageByBridgeId(loaded.chat, bridgeMessageId);
          if (assistant?.extra?.discord_bridge) {
            assistant.extra.discord_bridge.discord_message_id = sent.messageId;
          }
          if (assistant?.swipe_info?.[0]?.extra?.discord_bridge) {
            assistant.swipe_info[0].extra.discord_bridge.discord_message_id = sent.messageId;
          }
          await saveChatFile(chatPath, loaded.chat, loaded.fingerprint);
          await updateState(paths, (bridgeState) => {
            const nextState = bridgeState.conversations[input.threadId];
            if (nextState) {
              nextState.lastAssistantBridgeMessageId = bridgeMessageId;
              nextState.lastAssistantDiscordMessageId = sent.messageId;
              nextState.updatedAt = now().toISOString();
            }
          });
          await activity.complete();

          return {
            kind: 'replied',
            reply: result.reply,
            assistantDiscordMessageId: sent.messageId,
          };
        } catch (error) {
          await activity.fail();
          throw error;
        }
      });
    },
    handleSwipe: async (input) => {
      const config = await readBridgeConfig(paths);
      if (checkAllowlist(input.discordUserId, config.access.allowlistedUserIds) === 'ignore') {
        return { kind: 'ignored' };
      }
      const decoded = decodeSwipeCustomId(input.customId);
      const state = (await readState(paths.stateFile)).conversations[decoded.threadId];
      if (!state) {
        return { kind: 'missing-thread' };
      }

      const chatPath = chatFilePath(paths, config, state);
      return queue.run(chatPath, async () => {
        const loaded = await loadChatFile(chatPath);
        const assistant = findAssistantMessageByBridgeId(loaded.chat, decoded.bridgeMessageId);
        if (!assistant || !assistant.swipes || !assistant.swipe_info) {
          return { kind: 'missing-thread' };
        }

        if (decoded.action === 'swipe_regen') {
          const character = await resolveCharacter(paths, config, state.characterAvatarFile);
          const reply = await (dependencies.generateReply
            ? dependencies.generateReply({ config, character, chat: chatBeforeAssistant(loaded.chat, decoded.bridgeMessageId) })
            : generateWithSillyTavernSettings(
              paths,
              config,
              character,
              chatBeforeAssistant(loaded.chat, decoded.bridgeMessageId),
              input.discordUserId,
              undefined,
              {
                fetchImpl: dependencies.fetchImpl,
                sillyTavernBaseUrl: dependencies.sillyTavernBaseUrl,
              },
            ));
          assistant.swipes.push(reply);
          assistant.swipe_info.push({
            send_date: now().toISOString(),
            extra: {
              api: 'sillytavern-chat-completions',
              model: 'claude-sonnet-4-6',
              discord_bridge: {
                bridge_message_id: decoded.bridgeMessageId,
                discord_message_id: state.lastAssistantDiscordMessageId,
              },
            },
          });
          selectSwipe(assistant, assistant.swipes.length - 1);
        } else {
          const direction = decoded.action === 'swipe_next' ? 1 : -1;
          const next = Math.max(0, Math.min(assistant.swipes.length - 1, (assistant.swipe_id ?? 0) + direction));
          selectSwipe(assistant, next);
        }

        const selectedIndex = assistant.swipe_id ?? 0;
        const total = assistant.swipes.length;
        await saveChatFile(chatPath, loaded.chat, loaded.fingerprint);
        if (state.lastAssistantDiscordMessageId) {
          await input.discord.editMessage({
            threadId: decoded.threadId,
            messageId: state.lastAssistantDiscordMessageId,
            content: assistant.mes ?? '',
            components: buildSwipeComponentPayload(decoded.threadId, decoded.bridgeMessageId, selectedIndex, total),
          });
        }
        return { kind: 'updated', selectedIndex, total };
      });
    },
    setPersona: async (input) => {
      const config = await readBridgeConfig(paths);
      if (checkAllowlist(input.discordUserId, config.access.allowlistedUserIds) === 'ignore') {
        throw new Error('Discord user is not allowlisted.');
      }

      const displayName = input.displayName.trim() || input.discordDisplayName?.trim() || 'Discord User';
      const profile: PromptProfile = {
        enabled: true,
        promptName: displayName,
        displayName,
        persona: input.persona.trim(),
      };
      await writeConfig(paths.configFile, {
        ...config,
        profiles: {
          ...config.profiles,
          [input.discordUserId]: profile,
        },
      });
      return profile;
    },
  };
}

async function generateWithSillyTavernSettings(
  paths: BridgePaths,
  config: DiscordBridgeConfig,
  character: BridgeCharacter,
  chat: ChatDocument,
  activeDiscordUserId?: string,
  activeDiscordDisplayName?: string,
  options: {
    fetchImpl?: typeof fetch;
    sillyTavernBaseUrl?: string;
  } = {},
): Promise<string> {
  const directories = userDirectories(paths, config);
  const rawSettings = await readSillyTavernSettingsFile(directories.settings);
  const settings = normalizeSillyTavernClaudeSettings(rawSettings);
  const preset = await loadSillyTavernPreset({
    dataRoot: paths.dataRoot,
    userHandle: config.sillyTavernUserHandle,
    presetName: config.generation.sillyTavernPresetName,
  });
  const messages = buildHeadlessPromptMessages({
    preset,
    character,
    profiles: config.profiles,
    activeDiscordUserId,
    activeDiscordDisplayName,
    chat,
    options: config.defaults,
  });
  const request = buildSillyTavernBackendRequest({
    settings,
    messages,
    characterName: character.name,
    userName: profileDisplayName(config, activeDiscordUserId ?? '', activeDiscordDisplayName),
  });
  return sendSillyTavernBackendRequest(request, {
    baseUrl: options.sillyTavernBaseUrl,
    fetchImpl: options.fetchImpl,
  });
}

async function sendAssistantReply(
  discord: BridgeDiscordApi,
  threadId: string,
  bridgeMessageId: string,
  reply: string,
): Promise<{ messageId: string }> {
  const chunks = splitDiscordMessage(reply);
  const first = await discord.sendThreadMessage({
    threadId,
    content: chunks[0] ?? '',
    components: buildSwipeComponentPayload(threadId, bridgeMessageId, 0, 1),
  });
  for (const content of chunks.slice(1)) {
    await discord.sendThreadMessage({ threadId, content });
  }
  return first;
}

async function startMessageActivityFeedback(input: {
  config: DiscordBridgeConfig;
  discord: BridgeDiscordApi;
  threadId: string;
  messageId: string;
  timers: ActivityTimers;
}): Promise<{ complete(): Promise<void>; fail(): Promise<void> }> {
  const processingEmoji = input.config.behavior.processingReactionEmoji.trim();
  const errorEmoji = input.config.behavior.errorReactionEmoji.trim();
  let intervalHandle: unknown;
  let stopped = false;

  if (input.config.behavior.showTypingIndicator && input.discord.startTyping) {
    await ignoreActivityError(() => input.discord.startTyping?.(input.threadId) ?? Promise.resolve());
    intervalHandle = input.timers.setInterval(() => {
      void ignoreActivityError(() => input.discord.startTyping?.(input.threadId) ?? Promise.resolve());
    }, 8000);
  }

  if (processingEmoji && input.discord.addReaction) {
    await ignoreActivityError(() =>
      input.discord.addReaction?.({
        threadId: input.threadId,
        messageId: input.messageId,
        emoji: processingEmoji,
      }) ?? Promise.resolve(),
    );
  }

  const stopTyping = (): void => {
    if (stopped) {
      return;
    }
    stopped = true;
    if (intervalHandle !== undefined) {
      input.timers.clearInterval(intervalHandle);
    }
  };

  const removeProcessingReaction = async (): Promise<void> => {
    if (!processingEmoji || !input.discord.removeReaction) {
      return;
    }
    await ignoreActivityError(() =>
      input.discord.removeReaction?.({
        threadId: input.threadId,
        messageId: input.messageId,
        emoji: processingEmoji,
      }) ?? Promise.resolve(),
    );
  };

  return {
    complete: async () => {
      stopTyping();
      await removeProcessingReaction();
    },
    fail: async () => {
      stopTyping();
      await removeProcessingReaction();
      if (errorEmoji && input.discord.addReaction) {
        await ignoreActivityError(() =>
          input.discord.addReaction?.({
            threadId: input.threadId,
            messageId: input.messageId,
            emoji: errorEmoji,
          }) ?? Promise.resolve(),
        );
      }
    },
  };
}

async function ignoreActivityError(action: () => Promise<void>): Promise<void> {
  try {
    await action();
  } catch {
    // Discord typing/reaction permissions are optional feedback, not part of generation correctness.
  }
}

function defaultActivityTimers(): ActivityTimers {
  return {
    setInterval: (callback, milliseconds) => globalThis.setInterval(callback, milliseconds),
    clearInterval: (handle) => globalThis.clearInterval(handle as ReturnType<typeof setInterval>),
  };
}

async function readBridgeConfig(paths: BridgePaths): Promise<DiscordBridgeConfig> {
  return readConfig(paths.configFile);
}

function userDirectories(paths: BridgePaths, config: DiscordBridgeConfig): UserDirectories {
  return fallbackUserDirectories(paths.dataRoot, config.sillyTavernUserHandle);
}

async function resolveCharacter(
  paths: BridgePaths,
  config: DiscordBridgeConfig,
  characterAvatarFile: string,
  options: { enforceExposure?: boolean } = {},
): Promise<BridgeCharacter> {
  const directories = userDirectories(paths, config);
  const characters = options.enforceExposure
    ? await listExposedCharacterCards(paths, config)
    : await listCharacterCards(directories.characters);
  const character = characters.find(
    (candidate) =>
      candidate.characterAvatarFile === characterAvatarFile ||
      candidate.name.toLowerCase() === characterAvatarFile.toLowerCase(),
  );
  if (character) {
    return character;
  }

  if (options.enforceExposure && config.discord.exposedCharacterTags.length > 0) {
    const allCharacters = await listCharacterCards(directories.characters);
    const hiddenCharacter = allCharacters.find(
      (candidate) =>
        candidate.characterAvatarFile === characterAvatarFile ||
        candidate.name.toLowerCase() === characterAvatarFile.toLowerCase(),
    );
    if (hiddenCharacter) {
      throw new Error(`Character is not exposed to Discord: ${characterAvatarFile}`);
    }
  }

  throw new Error(`Character not found: ${characterAvatarFile}`);
}

async function listExposedCharacterCards(
  paths: BridgePaths,
  config: DiscordBridgeConfig,
): Promise<BridgeCharacter[]> {
  const directories = userDirectories(paths, config);
  const characters = await listCharacterCards(directories.characters);
  if (config.discord.exposedCharacterTags.length === 0) {
    return characters;
  }

  const tagIndex = await loadSillyTavernTags(directories.root);
  return filterCharactersByTags(characters, tagIndex, config.discord.exposedCharacterTags);
}

function chatFilePath(
  paths: BridgePaths,
  config: DiscordBridgeConfig,
  state: ConversationState,
): string {
  return buildChatFilePath(
    paths.dataRoot,
    config.sillyTavernUserHandle,
    state.chatFolderName,
    state.chatFileName,
  );
}

async function updateState(
  paths: BridgePaths,
  mutate: (state: DiscordBridgeState) => void,
): Promise<void> {
  const state = await readState(paths.stateFile).catch(() => emptyState());
  mutate(state);
  await writeState(paths.stateFile, state);
}

function profilePromptName(
  config: DiscordBridgeConfig,
  discordUserId: string,
  discordDisplayName?: string,
): string {
  const profile = config.profiles[discordUserId];
  return profile?.enabled ? profile.promptName : discordDisplayName || 'Discord User';
}

function profileDisplayName(
  config: DiscordBridgeConfig,
  discordUserId: string,
  discordDisplayName?: string,
): string {
  const profile = config.profiles[discordUserId];
  return profile?.enabled ? profile.displayName || profile.promptName : discordDisplayName || 'Discord User';
}

function formatConversationTitle(
  config: DiscordBridgeConfig,
  character: BridgeCharacter,
  date: Date,
): string {
  return config.behavior.conversationTitleFormat
    .replace(/\{\{character\}\}/gu, character.name)
    .replace(/\{\{date\}\}/gu, date.toISOString().slice(0, 10));
}

function chatBeforeAssistant(chat: ChatDocument, bridgeMessageId: string): ChatDocument {
  const index = chat.findIndex(
    (message) => message.extra?.discord_bridge?.bridge_message_id === bridgeMessageId,
  );
  return index >= 0 ? chat.slice(0, index) : chat;
}

function applyCharacterMacros(value: string, characterName: string, userName: string): string {
  return value
    .replace(/\{\{char\}\}/giu, characterName)
    .replace(/\{\{user\}\}/giu, userName);
}
