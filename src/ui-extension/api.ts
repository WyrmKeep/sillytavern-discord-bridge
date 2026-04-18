export type BridgeStatus = {
  ok: boolean;
  plugin?: string;
};

export type BridgeConfig = {
  version: 1;
  enabled: boolean;
  sillyTavernUserHandle: string;
  discord: {
    clientId: string;
    guildId: string;
    forumChannelId: string;
    createForumIfMissing: boolean;
    forumName: string;
    defaultForumTagIds: string[];
  };
  access: {
    allowlistedUserIds: string[];
    adminUserIds: string[];
  };
  profiles: Record<
    string,
    {
      enabled: boolean;
      promptName: string;
      displayName: string;
      persona: string;
    }
  >;
  defaults: {
    defaultCharacterAvatarFile: string;
    maxHistoryMessages: number;
    maxReplyCharacters: number;
    includeCreatorNotes: boolean;
    includePostHistoryInstructions: boolean;
  };
  behavior: {
    ignoreBotMessages: boolean;
    rejectNonAllowlistedUsers: 'silent' | 'ephemeral-reply-for-commands';
    attachmentMode: 'ignore-with-note';
    conversationTitleFormat: string;
  };
};

export type BridgeConfigPayload = {
  config: BridgeConfig;
  secrets: {
    discordBotToken?: '<present>' | '<missing>';
  };
};

export async function fetchBridgeStatus(): Promise<BridgeStatus> {
  const response = await fetch('/api/plugins/discord-bridge/status');
  if (!response.ok) {
    throw new Error(`Bridge status failed: ${response.status}`);
  }
  return (await response.json()) as BridgeStatus;
}

export async function fetchBridgeConfig(): Promise<BridgeConfigPayload> {
  const response = await fetch('/api/plugins/discord-bridge/config');
  if (!response.ok) {
    throw new Error(`Bridge config failed: ${response.status}`);
  }
  return (await response.json()) as BridgeConfigPayload;
}

export async function saveBridgeConfig(config: BridgeConfig): Promise<BridgeConfigPayload> {
  const response = await fetch('/api/plugins/discord-bridge/config', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ config }),
  });
  if (!response.ok) {
    throw new Error(`Bridge config save failed: ${response.status}`);
  }
  return (await response.json()) as BridgeConfigPayload;
}

export async function saveBridgeSecrets(input: { discordBotToken?: string }): Promise<BridgeConfigPayload> {
  const response = await fetch('/api/plugins/discord-bridge/secrets', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(`Bridge secrets save failed: ${response.status}`);
  }
  return (await response.json()) as BridgeConfigPayload;
}
