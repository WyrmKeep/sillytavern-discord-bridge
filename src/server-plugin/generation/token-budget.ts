import type { BridgePromptMessage } from './types.js';

export function trimMessagesByCount(
  messages: BridgePromptMessage[],
  maxHistoryMessages: number,
): BridgePromptMessage[] {
  return messages.slice(-Math.max(1, maxHistoryMessages));
}
