import path from 'node:path';

export type BridgeCharacter = {
  characterAvatarFile: string;
  chatFolderName: string;
  name: string;
  description: string;
  personality: string;
  scenario: string;
  firstMes: string;
  alternateGreetings: string[];
  mesExample: string;
  creatorNotes: string;
  systemPrompt: string;
  postHistoryInstructions: string;
  tags: string[];
};

export function deriveChatFolderName(characterAvatarFile: string): string {
  return path.parse(characterAvatarFile.replace(/\\/g, '/')).name;
}

export function normalizeCharacterCardData(
  characterAvatarFile: string,
  rawCard: unknown,
): BridgeCharacter {
  const root = asRecord(rawCard);
  const selected = selectCardData(root);

  return {
    characterAvatarFile,
    chatFolderName: deriveChatFolderName(characterAvatarFile),
    name: stringField(selected.name, deriveChatFolderName(characterAvatarFile)),
    description: stringField(selected.description),
    personality: stringField(selected.personality),
    scenario: stringField(selected.scenario),
    firstMes: stringField(selected.first_mes),
    alternateGreetings: stringArrayField(selected.alternate_greetings),
    mesExample: stringField(selected.mes_example),
    creatorNotes: stringField(selected.creator_notes),
    systemPrompt: stringField(selected.system_prompt),
    postHistoryInstructions: stringField(selected.post_history_instructions),
    tags: stringArrayField(selected.tags),
  };
}

function selectCardData(root: Record<string, unknown>): Record<string, unknown> {
  const ccv3 = asOptionalRecord(root.ccv3);
  const ccv3Data = ccv3 ? asOptionalRecord(ccv3.data) : undefined;
  if (ccv3Data) {
    return ccv3Data;
  }

  const data = asOptionalRecord(root.data);
  return data ?? root;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function asOptionalRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function stringField(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function stringArrayField(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}
