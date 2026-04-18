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

export function buildSwipeComponentPayload(
  threadId: string,
  bridgeMessageId: string,
  selectedIndex: number,
  total: number,
): unknown[] {
  return [
    {
      type: 1,
      components: [
        {
          type: 2,
          style: 2,
          label: '<',
          custom_id: encodeSwipeCustomId('swipe_prev', threadId, bridgeMessageId),
          disabled: selectedIndex <= 0,
        },
        {
          type: 2,
          style: 1,
          label: `Regenerate - ${swipeCounterLabel(selectedIndex, total)}`,
          custom_id: encodeSwipeCustomId('swipe_regen', threadId, bridgeMessageId),
          disabled: false,
        },
        {
          type: 2,
          style: 2,
          label: '>',
          custom_id: encodeSwipeCustomId('swipe_next', threadId, bridgeMessageId),
          disabled: selectedIndex >= total - 1,
        },
      ],
    },
  ];
}
