import type { ChatDocument } from '../sillytavern/chats.js';
import { findAssistantMessageByBridgeId, selectSwipe } from '../sillytavern/chats.js';

export function moveSwipeSelection(
  chat: ChatDocument,
  bridgeMessageId: string,
  direction: -1 | 1,
): number {
  const message = findAssistantMessageByBridgeId(chat, bridgeMessageId);
  if (!message || !message.swipes || typeof message.swipe_id !== 'number') {
    throw new Error('Assistant message with swipes not found.');
  }
  const next = Math.max(0, Math.min(message.swipes.length - 1, message.swipe_id + direction));
  selectSwipe(message, next);
  return next;
}
