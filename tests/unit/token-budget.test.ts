import { describe, expect, test } from 'vitest';
import {
  TokenBudgetExceededError,
  estimateTokens,
  trimMessagesToContextBudget,
  type TokenBudgetMessage,
} from '../../src/server-plugin/generation/token-budget.js';

describe('token budget', () => {
  test('estimates tokens from character count with a conservative heuristic', () => {
    expect(estimateTokens('')).toBe(0);
    expect(estimateTokens('abcd')).toBe(2);
    expect(estimateTokens('x'.repeat(35))).toBe(10);
  });

  test('trims oldest eligible history while preserving fixed prompt, first history, and latest history', () => {
    const messages: TokenBudgetMessage[] = [
      { role: 'system', content: 'System', source: 'prompt' },
      { role: 'user', content: 'First', source: 'history' },
      { role: 'assistant', content: 'x'.repeat(80), source: 'history' },
      { role: 'user', content: 'Latest', source: 'history' },
      { role: 'system', content: 'Tail', source: 'prompt' },
    ];

    const result = trimMessagesToContextBudget({
      messages,
      contextBudgetTokens: 12,
      omittedHistoryMarker: '[trimmed]',
    });

    expect(result.map((message) => message.content)).toEqual([
      'System',
      'First',
      '[trimmed]',
      'Latest',
      'Tail',
    ]);
  });

  test('throws before generation when fixed prompt material alone exceeds budget', () => {
    expect(() =>
      trimMessagesToContextBudget({
        messages: [{ role: 'system', content: 'x'.repeat(100), source: 'prompt' }],
        contextBudgetTokens: 5,
        omittedHistoryMarker: '[trimmed]',
      }),
    ).toThrow(TokenBudgetExceededError);
  });
});
