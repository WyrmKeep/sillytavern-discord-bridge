export type AllowlistDecision = 'allow' | 'ignore';

export function checkAllowlist(userId: string, allowlistedUserIds: string[]): AllowlistDecision {
  return allowlistedUserIds.includes(userId) ? 'allow' : 'ignore';
}
