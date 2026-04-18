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
  return parseBridgeConfigPayload(await response.json());
}

export async function saveBridgeConfig(config: BridgeConfig): Promise<BridgeConfigPayload> {
  const response = await fetch('/api/plugins/discord-bridge/config', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ config }),
  });
  if (!response.ok) {
    throw new Error(await responseErrorMessage(response, 'Bridge config save failed'));
  }
  return parseBridgeConfigPayload(await response.json());
}

export async function saveBridgeSecrets(input: { discordBotToken?: string }): Promise<BridgeConfigPayload> {
  const response = await fetch('/api/plugins/discord-bridge/secrets', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(await responseErrorMessage(response, 'Bridge secrets save failed'));
  }
  return parseBridgeConfigPayload(await response.json());
}

function parseBridgeConfigPayload(input: unknown): BridgeConfigPayload {
  if (
    typeof input !== 'object' ||
    input === null ||
    !('config' in input) ||
    typeof (input as { config?: unknown }).config !== 'object' ||
    (input as { config?: unknown }).config === null
  ) {
    throw new Error('Server plugin needs update: /config did not return bridge settings.');
  }

  return input as BridgeConfigPayload;
}

async function responseErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { reason?: unknown };
    if (typeof body.reason === 'string' && body.reason) {
      return body.reason;
    }
  } catch {
    // Ignore parse errors and fall back to a status-based message.
  }

  return `${fallback}: ${response.status}`;
}
