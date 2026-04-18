import { describe, expect, test, vi } from 'vitest';
import { createDiscordAdapter } from '../../src/server-plugin/discord/adapter.js';

describe('Discord adapter', () => {
  test('creates forum posts with configured required/default tags', async () => {
    const thread = {
      id: 'thread-1',
      fetchStarterMessage: vi.fn(async () => ({ id: 'starter-1' })),
    };
    const forum = {
      threads: {
        create: vi.fn(async () => thread),
      },
    };
    const client = {
      channels: {
        fetch: vi.fn(async () => forum),
      },
    };
    const adapter = createDiscordAdapter(client as never);

    const created = await adapter.createForumThread({
      forumChannelId: 'forum-1',
      title: 'Alice - 2026-04-18',
      firstMessage: 'Hello.',
      appliedTagIds: ['tag-1'],
    });

    expect(client.channels.fetch).toHaveBeenCalledWith('forum-1');
    expect(forum.threads.create).toHaveBeenCalledWith({
      name: 'Alice - 2026-04-18',
      message: { content: 'Hello.' },
      appliedTags: ['tag-1'],
    });
    expect(created).toEqual({ threadId: 'thread-1', starterMessageId: 'starter-1' });
  });

  test('sends and edits thread messages with components', async () => {
    const edit = vi.fn(async () => undefined);
    const thread = {
      send: vi.fn(async () => ({ id: 'message-1' })),
      messages: {
        fetch: vi.fn(async () => ({ edit })),
      },
    };
    const client = {
      channels: {
        fetch: vi.fn(async () => thread),
      },
    };
    const adapter = createDiscordAdapter(client as never);

    const sent = await adapter.sendThreadMessage({
      threadId: 'thread-1',
      content: 'Reply.',
      components: [{ type: 1, components: [] }],
    });
    await adapter.editMessage({
      threadId: 'thread-1',
      messageId: 'message-1',
      content: 'Edited.',
      components: [],
    });

    expect(sent).toEqual({ messageId: 'message-1' });
    expect(thread.send).toHaveBeenCalledWith({
      content: 'Reply.',
      components: [{ type: 1, components: [] }],
    });
    expect(thread.messages.fetch).toHaveBeenCalledWith('message-1');
    expect(edit).toHaveBeenCalledWith({
      content: 'Edited.',
      components: [],
    });
  });

  test('sends typing indicators and manages reactions on thread messages', async () => {
    const remove = vi.fn(async () => undefined);
    const message = {
      react: vi.fn(async () => undefined),
      reactions: {
        resolve: vi.fn(() => ({ users: { remove } })),
      },
    };
    const thread = {
      send: vi.fn(),
      sendTyping: vi.fn(async () => undefined),
      messages: {
        fetch: vi.fn(async () => message),
      },
    };
    const client = {
      user: { id: 'bot-user' },
      channels: {
        fetch: vi.fn(async () => thread),
      },
    };
    const adapter = createDiscordAdapter(client as never);

    await adapter.startTyping?.('thread-1');
    await adapter.addReaction?.({
      threadId: 'thread-1',
      messageId: 'user-message-1',
      emoji: '\u{23F3}',
    });
    await adapter.removeReaction?.({
      threadId: 'thread-1',
      messageId: 'user-message-1',
      emoji: '\u{23F3}',
    });

    expect(thread.sendTyping).toHaveBeenCalledTimes(1);
    expect(thread.messages.fetch).toHaveBeenCalledWith('user-message-1');
    expect(message.react).toHaveBeenCalledWith('\u{23F3}');
    expect(message.reactions.resolve).toHaveBeenCalledWith('\u{23F3}');
    expect(remove).toHaveBeenCalledWith('bot-user');
  });
});
