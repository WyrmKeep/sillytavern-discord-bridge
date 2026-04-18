import type { BridgePromptMessage } from './types.js';

export type TokenBudgetMessage = {
  role: BridgePromptMessage['role'] | 'system';
  content: string;
  source: 'prompt' | 'history';
};

export class TokenBudgetExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TokenBudgetExceededError';
  }
}

export function trimMessagesByCount(
  messages: BridgePromptMessage[],
  maxHistoryMessages: number,
): BridgePromptMessage[] {
  return messages.slice(-Math.max(1, maxHistoryMessages));
}

export function estimateTokens(text: string): number {
  if (text.length === 0) {
    return 0;
  }

  return Math.ceil(text.length / 3.5);
}

export function trimMessagesToContextBudget(input: {
  messages: TokenBudgetMessage[];
  contextBudgetTokens: number;
  omittedHistoryMarker?: string;
}): TokenBudgetMessage[] {
  const budget = input.contextBudgetTokens;
  if (totalTokens(input.messages) <= budget) {
    return input.messages;
  }

  const fixedPromptTokens = totalTokens(input.messages.filter((message) => message.source === 'prompt'));
  if (fixedPromptTokens > budget) {
    throw new TokenBudgetExceededError(
      `Fixed prompt material exceeds context budget (${fixedPromptTokens}/${budget} estimated tokens).`,
    );
  }

  const historyIndexes = input.messages
    .map((message, index) => ({ message, index }))
    .filter(({ message }) => message.source === 'history')
    .map(({ index }) => index);

  const selectedHistoryIndexes = new Set<number>();
  const firstHistoryIndex = historyIndexes.at(0);
  const latestHistoryIndex = historyIndexes.at(-1);
  if (firstHistoryIndex !== undefined) {
    selectedHistoryIndexes.add(firstHistoryIndex);
  }
  if (latestHistoryIndex !== undefined) {
    selectedHistoryIndexes.add(latestHistoryIndex);
  }

  let usedTokens =
    fixedPromptTokens +
    [...selectedHistoryIndexes].reduce((sum, index) => sum + messageTokens(input.messages[index]), 0);
  if (usedTokens > budget) {
    throw new TokenBudgetExceededError(
      `Pinned chat history exceeds context budget (${usedTokens}/${budget} estimated tokens).`,
    );
  }

  for (const index of [...historyIndexes].reverse()) {
    if (selectedHistoryIndexes.has(index)) {
      continue;
    }

    const nextTokens = messageTokens(input.messages[index]);
    if (usedTokens + nextTokens <= budget) {
      selectedHistoryIndexes.add(index);
      usedTokens += nextTokens;
    }
  }

  const omittedHistoryExists = historyIndexes.some((index) => !selectedHistoryIndexes.has(index));
  const marker = input.omittedHistoryMarker?.trim();
  const canInsertMarker =
    omittedHistoryExists &&
    marker !== undefined &&
    marker.length > 0 &&
    usedTokens + estimateTokens(marker) <= budget;
  const trimmed: TokenBudgetMessage[] = [];
  let insertedMarker = false;

  for (const [index, message] of input.messages.entries()) {
    if (message.source === 'prompt' || selectedHistoryIndexes.has(index)) {
      trimmed.push(message);
      continue;
    }

    if (canInsertMarker && !insertedMarker) {
      trimmed.push({
        role: 'system',
        content: marker,
        source: 'prompt',
      });
      insertedMarker = true;
    }
  }

  return trimmed;
}

function totalTokens(messages: TokenBudgetMessage[]): number {
  return messages.reduce((sum, message) => sum + messageTokens(message), 0);
}

function messageTokens(message: TokenBudgetMessage | undefined): number {
  if (!message) {
    return 0;
  }

  return estimateTokens(message.content);
}
