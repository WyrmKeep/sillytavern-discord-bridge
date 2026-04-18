import type { Router } from 'express';
import type { RouteRegistrationOptions } from './types.js';
import { registerBotRoutes } from './bot.js';
import { registerCharacterRoutes } from './characters.js';
import { registerConfigRoutes } from './config.js';
import { registerDiagnosticRoutes } from './diagnostics.js';
import { registerDiscordRoutes } from './discord.js';
import { registerStatusRoutes } from './status.js';

export function registerRoutes(router: Router, options: RouteRegistrationOptions = {}): void {
  registerStatusRoutes(router, options);
  registerConfigRoutes(router, options);
  registerBotRoutes(router, options);
  registerDiscordRoutes(router);
  registerCharacterRoutes(router);
  registerDiagnosticRoutes(router);
}
