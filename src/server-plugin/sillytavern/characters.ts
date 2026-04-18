import path from 'node:path';
import { readdir, readFile } from 'node:fs/promises';

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

export type SillyTavernTagIndex = {
  tagNamesByAvatar: Map<string, string[]>;
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

export async function listCharacterCards(charactersDir: string): Promise<BridgeCharacter[]> {
  const entries = await readdir(charactersDir, { withFileTypes: true }).catch((error: unknown) => {
    if (isNotFound(error)) {
      return [];
    }
    throw error;
  });

  const cards = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && isSupportedCharacterFile(entry.name))
      .map(async (entry) => {
        const filePath = path.join(charactersDir, entry.name);
        const rawCard = await readCharacterCardFile(filePath);
        return normalizeCharacterCardData(entry.name, rawCard);
      }),
  );

  return cards.sort((left, right) =>
    left.characterAvatarFile.localeCompare(right.characterAvatarFile),
  );
}

export async function loadSillyTavernTags(userRoot: string): Promise<SillyTavernTagIndex> {
  const tagsJson = await readJsonFile(path.join(userRoot, 'tags.json'));
  if (tagsJson.found) {
    return parseSillyTavernTags(tagsJson.value);
  }

  const settingsJson = await readJsonFile(path.join(userRoot, 'settings.json'));
  if (settingsJson.found) {
    return parseSillyTavernTags(settingsJson.value);
  }

  return emptyTagIndex();
}

export function filterCharactersByTags(
  characters: BridgeCharacter[],
  tagIndex: SillyTavernTagIndex,
  exposedCharacterTags: string[],
): BridgeCharacter[] {
  const exposed = normalizeTagNames(exposedCharacterTags);
  if (exposed.size === 0) {
    return characters;
  }

  return characters.filter((character) => {
    const tags = tagIndex.tagNamesByAvatar.get(character.characterAvatarFile) ?? [];
    return tags.some((tag) => exposed.has(normalizeTagName(tag)));
  });
}

function parseSillyTavernTags(raw: unknown): SillyTavernTagIndex {
  const tagNamesByAvatar = new Map<string, string[]>();

  if (Array.isArray(raw)) {
    addTagObjectsToIndex(raw, tagNamesByAvatar);
    return { tagNamesByAvatar };
  }

  const root = asOptionalRecord(raw);
  if (!root) {
    return emptyTagIndex();
  }

  addTagObjectsToIndex(Array.isArray(root.tags) ? root.tags : [], tagNamesByAvatar);

  const tagNameById = new Map<string, string>();
  for (const tag of Array.isArray(root.tags) ? root.tags : []) {
    const tagRecord = asOptionalRecord(tag);
    if (!tagRecord || typeof tagRecord.id !== 'string' || typeof tagRecord.name !== 'string') {
      continue;
    }
    tagNameById.set(tagRecord.id, tagRecord.name);
  }

  const tagMap = asOptionalRecord(root.tag_map);
  if (!tagMap) {
    return { tagNamesByAvatar };
  }

  for (const [avatarFile, tagIds] of Object.entries(tagMap)) {
    if (!Array.isArray(tagIds)) {
      continue;
    }
    for (const tagId of tagIds) {
      if (typeof tagId !== 'string') {
        continue;
      }
      const tagName = tagNameById.get(tagId);
      if (tagName) {
        addAvatarTag(tagNamesByAvatar, avatarFile, tagName);
      }
    }
  }

  return { tagNamesByAvatar };
}

function addTagObjectsToIndex(rawTags: unknown[], tagNamesByAvatar: Map<string, string[]>): void {
  for (const rawTag of rawTags) {
    const tag = asOptionalRecord(rawTag);
    if (!tag || typeof tag.name !== 'string') {
      continue;
    }
    for (const avatarFile of tagAvatarFiles(tag)) {
      addAvatarTag(tagNamesByAvatar, avatarFile, tag.name);
    }
  }
}

function tagAvatarFiles(tag: Record<string, unknown>): string[] {
  return ['characters', 'characterAvatarFiles', 'avatars', 'entities']
    .flatMap((key) => stringArrayField(tag[key]));
}

function addAvatarTag(
  tagNamesByAvatar: Map<string, string[]>,
  avatarFile: string,
  tagName: string,
): void {
  const tags = tagNamesByAvatar.get(avatarFile) ?? [];
  if (!tags.some((existing) => normalizeTagName(existing) === normalizeTagName(tagName))) {
    tags.push(tagName);
  }
  tagNamesByAvatar.set(avatarFile, tags);
}

async function readJsonFile(filePath: string): Promise<{ found: true; value: unknown } | { found: false }> {
  try {
    return {
      found: true,
      value: JSON.parse(await readFile(filePath, 'utf8')) as unknown,
    };
  } catch (error) {
    if (isNotFound(error)) {
      return { found: false };
    }
    return { found: true, value: undefined };
  }
}

function normalizeTagNames(values: string[]): Set<string> {
  return new Set(values.map(normalizeTagName).filter(Boolean));
}

function normalizeTagName(value: string): string {
  return value.trim().toLowerCase();
}

function emptyTagIndex(): SillyTavernTagIndex {
  return { tagNamesByAvatar: new Map() };
}

async function readCharacterCardFile(filePath: string): Promise<unknown> {
  const extension = path.extname(filePath).toLowerCase();
  const content = await readFile(filePath);
  if (extension === '.json') {
    return JSON.parse(content.toString('utf8')) as unknown;
  }
  if (extension === '.png') {
    return parsePngCharacterCard(content);
  }
  throw new Error(`Unsupported character card file: ${filePath}`);
}

function parsePngCharacterCard(buffer: Buffer): unknown {
  const encoded = findPngText(buffer, 'chara');
  if (!encoded) {
    throw new Error('PNG character card does not contain chara metadata.');
  }

  const candidates = [encoded, Buffer.from(encoded, 'base64').toString('utf8')];
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as unknown;
    } catch {
      // Try the next metadata encoding.
    }
  }

  throw new Error('PNG character card chara metadata is not valid JSON.');
}

function findPngText(buffer: Buffer, keyword: string): string | undefined {
  const signatureLength = 8;
  let offset = signatureLength;

  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('latin1', offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (dataEnd + 4 > buffer.length) {
      return undefined;
    }

    if (type === 'tEXt') {
      const separator = buffer.indexOf(0, dataStart);
      if (separator >= dataStart && separator < dataEnd) {
        const currentKeyword = buffer.toString('latin1', dataStart, separator);
        if (currentKeyword === keyword) {
          return buffer.toString('latin1', separator + 1, dataEnd);
        }
      }
    }

    if (type === 'iTXt') {
      const text = parseInternationalTextChunk(buffer.subarray(dataStart, dataEnd), keyword);
      if (text !== undefined) {
        return text;
      }
    }

    offset = dataEnd + 4;
  }

  return undefined;
}

function parseInternationalTextChunk(data: Buffer, keyword: string): string | undefined {
  const firstNull = data.indexOf(0);
  if (firstNull < 0 || data.toString('latin1', 0, firstNull) !== keyword) {
    return undefined;
  }
  const compressionFlag = data[firstNull + 1];
  if (compressionFlag !== 0) {
    return undefined;
  }

  let offset = firstNull + 3;
  const languageEnd = data.indexOf(0, offset);
  if (languageEnd < 0) {
    return undefined;
  }
  offset = languageEnd + 1;
  const translatedEnd = data.indexOf(0, offset);
  if (translatedEnd < 0) {
    return undefined;
  }
  return data.toString('utf8', translatedEnd + 1);
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

function isSupportedCharacterFile(fileName: string): boolean {
  return ['.json', '.png'].includes(path.extname(fileName).toLowerCase());
}

function isNotFound(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'ENOENT'
  );
}
