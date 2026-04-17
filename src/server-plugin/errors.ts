export class DiscordBridgeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DiscordBridgeError';
  }
}
