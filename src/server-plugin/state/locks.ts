export type QueueKey = string;

export class KeyedQueue {
  private readonly tails = new Map<string, Promise<void>>();

  async run<T>(key: QueueKey, task: () => Promise<T>): Promise<T> {
    const normalizedKey = normalizeQueueKey(key);
    const previous = this.tails.get(normalizedKey) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });

    this.tails.set(normalizedKey, previous.then(() => current));

    await previous;
    try {
      return await task();
    } finally {
      release();
      if (this.tails.get(normalizedKey) === current) {
        this.tails.delete(normalizedKey);
      }
    }
  }
}

export function createKeyedQueue(): KeyedQueue {
  return new KeyedQueue();
}

export function normalizeQueueKey(key: string): string {
  return key.replace(/\\/g, '/').toLowerCase();
}
