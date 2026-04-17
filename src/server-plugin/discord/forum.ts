export function normalizeThreadTitle(title: string, maxLength = 100): string {
  const normalized = title.replace(/\s+/g, ' ').trim() || 'SillyTavern Conversation';
  return normalized.length > maxLength ? normalized.slice(0, maxLength).trim() : normalized;
}

export function splitDiscordMessage(content: string, maxLength = 2000): string[] {
  if (content.length <= maxLength) {
    return [content];
  }
  const chunks: string[] = [];
  for (let index = 0; index < content.length; index += maxLength) {
    chunks.push(content.slice(index, index + maxLength));
  }
  return chunks;
}
