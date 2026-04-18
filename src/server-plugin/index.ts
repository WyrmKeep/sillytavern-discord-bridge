import type { Router } from 'express';
import {
  discordBotRuntime,
  type DiscordBotRuntime,
} from './discord/lifecycle.js';
import { registerRoutes } from './routes/index.js';
import { logError, logInfo } from './logging.js';

export type DiscordBridgePluginOptions = {
  discordBotRuntime?: DiscordBotRuntime;
};

export const info = {
  id: 'discord-bridge',
  name: 'Discord Bridge',
  description: 'Private Discord bridge for SillyTavern character chats.',
};

export function init(router: Router, options: DiscordBridgePluginOptions = {}): void {
  const runtime = options.discordBotRuntime ?? discordBotRuntime;
  registerRoutes(router, { discordBotRuntime: runtime });
  void runtime.reconcile().catch((error: unknown) => {
    logError('discord bot startup failed', error);
  });
  logInfo('server plugin initialized');
}

export async function exit(options: DiscordBridgePluginOptions = {}): Promise<void> {
  const runtime = options.discordBotRuntime ?? discordBotRuntime;
  await runtime.stop();
  logInfo('server plugin stopped');
}
