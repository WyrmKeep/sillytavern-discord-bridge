import { readFile } from 'node:fs/promises';
import { describe, expect, test } from 'vitest';

describe('Zod record compatibility', () => {
  test('uses explicit string keys for record schemas so Zod 3 and 4 parse state/config values the same way', async () => {
    const stateSchema = await readFile('src/server-plugin/state/schema.ts', 'utf8');
    const configSchema = await readFile('src/server-plugin/config/schema.ts', 'utf8');

    expect(stateSchema).toContain('z.record(z.string(), conversationStateSchema)');
    expect(stateSchema).not.toContain('z.record(conversationStateSchema)');
    expect(configSchema).toContain('z.record(z.string(), profileSchema)');
    expect(configSchema).not.toContain('z.record(profileSchema)');
  });
});
