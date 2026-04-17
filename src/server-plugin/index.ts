import type { Router } from 'express';
import type { Client } from 'discord.js';
import { destroyDiscordClient } from './discord/client.js';
import { registerRoutes } from './routes/index.js';
import { logInfo } from './logging.js';

let discordClient: Client | undefined;

export const info = {
  id: 'discord-bridge',
  name: 'Discord Bridge',
  description: 'Private Discord bridge for SillyTavern character chats.',
};

export function init(router: Router): void {
  registerRoutes(router);
  logInfo('server plugin initialized');
}

export async function exit(): Promise<void> {
  await destroyDiscordClient(discordClient);
  discordClient = undefined;
  logInfo('server plugin stopped');
}
