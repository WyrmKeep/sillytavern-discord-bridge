export function redactForLog(value: string): string {
  return value.length > 0 ? '<redacted>' : '';
}

export function logInfo(message: string): void {
  console.info(`[discord-bridge] ${message}`);
}

export function logError(message: string, error?: unknown): void {
  console.error(`[discord-bridge] ${message}`, error);
}
