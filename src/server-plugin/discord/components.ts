export type SwipeAction = 'swipe_prev' | 'swipe_regen' | 'swipe_next';

export type DecodedSwipeCustomId = {
  action: SwipeAction;
  threadId: string;
  bridgeMessageId: string;
};

const PREFIX = 'stb:v1';
const ACTIONS = new Set<SwipeAction>(['swipe_prev', 'swipe_regen', 'swipe_next']);

export function encodeSwipeCustomId(
  action: SwipeAction,
  threadId: string,
  bridgeMessageId: string,
): string {
  return `${PREFIX}:${action}:${threadId}:${bridgeMessageId}`;
}

export function decodeSwipeCustomId(customId: string): DecodedSwipeCustomId {
  const parts = customId.split(':');
  if (parts.length !== 5 || parts[0] !== 'stb' || parts[1] !== 'v1') {
    throw new Error('Invalid swipe custom ID.');
  }
  const action = parts[2] as SwipeAction;
  if (!ACTIONS.has(action)) {
    throw new Error('Invalid swipe custom ID action.');
  }
  return {
    action,
    threadId: parts[3] ?? '',
    bridgeMessageId: parts[4] ?? '',
  };
}

export function swipeCounterLabel(selectedIndex: number, total: number): string {
  return `Swipe ${selectedIndex + 1}/${total}`;
}
