import type {
  BridgeDiscordApi,
  BridgeRuntime,
} from '../bridge/runtime.js';
import { logError } from '../logging.js';

export type DiscordEventClientLike = {
  on(eventName: 'interactionCreate', handler: (interaction: any) => Promise<void>): unknown;
  on(eventName: 'messageCreate', handler: (message: any) => Promise<void>): unknown;
};

export function attachDiscordEventHandlers(
  client: DiscordEventClientLike,
  runtime: BridgeRuntime,
  discord: BridgeDiscordApi,
): void {
  client.on('interactionCreate', async (interaction: any) => {
    await handleInteraction(interaction, runtime, discord).catch((error: unknown) => {
      logError('discord interaction handler failed', error);
    });
  });
  client.on('messageCreate', async (message: any) => {
    await handleMessage(message, runtime, discord).catch((error: unknown) => {
      logError('discord message handler failed', error);
    });
  });
}

async function handleInteraction(
  interaction: any,
  runtime: BridgeRuntime,
  discord: BridgeDiscordApi,
): Promise<void> {
  if (interaction.isAutocomplete?.() && interaction.commandName === 'st') {
    await respondToCharacterAutocomplete(interaction, runtime);
    return;
  }

  if (interaction.isButton?.() && typeof interaction.customId === 'string') {
    if (!interaction.customId.startsWith('stb:v1:')) {
      return;
    }
    await interaction.deferUpdate?.();
    await runtime.handleSwipe({
      customId: interaction.customId,
      discordUserId: interaction.user?.id ?? '',
      discord,
    });
    return;
  }

  if (!interaction.isChatInputCommand?.()) {
    return;
  }

  if (interaction.commandName === 'persona') {
    await handlePersonaCommand(interaction, runtime);
    return;
  }

  if (interaction.commandName !== 'st') {
    return;
  }

  const subcommand = interaction.options?.getSubcommand?.();
  if (subcommand === 'new') {
    await interaction.deferReply?.({ ephemeral: true });
    const characterAvatarFile = interaction.options?.getString?.('character', true);
    const result = await runtime.startNewConversation({
      discordUserId: interaction.user?.id ?? '',
      discordDisplayName: discordDisplayName(interaction),
      characterAvatarFile,
      discord,
    });
    await interaction.editReply?.({ content: `Created <#${result.threadId}>.` });
    return;
  }

  if (subcommand === 'status') {
    await interaction.reply?.({
      content: 'Discord Bridge is running.',
      ephemeral: true,
    });
    return;
  }

  if (subcommand === 'character') {
    const conversation = await runtime.getConversation(interaction.channelId ?? '');
    await interaction.reply?.({
      content: conversation
        ? `Active character: ${conversation.characterName} (${conversation.characterAvatarFile}).`
        : 'No bridge conversation is mapped to this channel.',
      ephemeral: true,
    });
    return;
  }

  if (subcommand === 'sync') {
    const conversation = await runtime.getConversation(interaction.channelId ?? '');
    await interaction.reply?.({
      content: conversation
        ? `Mapped chat: ${conversation.chatFolderName}/${conversation.chatFileName}.`
        : 'No bridge conversation is mapped to this channel.',
      ephemeral: true,
    });
  }
}

async function handlePersonaCommand(interaction: any, runtime: BridgeRuntime): Promise<void> {
  const subcommand = interaction.options?.getSubcommand?.();
  if (subcommand !== 'set') {
    return;
  }

  const displayName = String(interaction.options?.getString?.('name', true) ?? '').trim();
  const persona = String(interaction.options?.getString?.('description', true) ?? '').trim();
  const profile = await runtime.setPersona({
    discordUserId: interaction.user?.id ?? '',
    discordDisplayName: discordDisplayName(interaction),
    displayName,
    persona,
  });

  await interaction.reply?.({
    content: `Persona saved for ${profile.displayName}.`,
    ephemeral: true,
  });
}

async function respondToCharacterAutocomplete(interaction: any, runtime: BridgeRuntime): Promise<void> {
  const focused = String(interaction.options?.getFocused?.() ?? '').toLowerCase();
  const characters = await runtime.listCharacters();
  const choices = characters
    .filter((character) => {
      if (!focused) {
        return true;
      }
      return (
        character.name.toLowerCase().includes(focused) ||
        character.characterAvatarFile.toLowerCase().includes(focused)
      );
    })
    .slice(0, 25)
    .map((character) => ({
      name: `${character.name} (${character.characterAvatarFile})`.slice(0, 100),
      value: character.characterAvatarFile,
    }));

  await interaction.respond?.(choices);
}

async function handleMessage(
  message: any,
  runtime: BridgeRuntime,
  discord: BridgeDiscordApi,
): Promise<void> {
  if (message.author?.bot) {
    return;
  }

  const content = String(message.content ?? '').trim();
  if (!content) {
    return;
  }

  await runtime.handleThreadMessage({
    threadId: String(message.channelId ?? ''),
    discordUserId: String(message.author?.id ?? ''),
    discordDisplayName: discordDisplayName(message),
    discordMessageId: String(message.id ?? ''),
    content,
    discord,
  });
}

function discordDisplayName(value: any): string | undefined {
  const displayName = value.member?.displayName ?? value.author?.globalName ?? value.user?.globalName ?? value.author?.username ?? value.user?.username;
  return typeof displayName === 'string' && displayName.trim() ? displayName.trim() : undefined;
}
