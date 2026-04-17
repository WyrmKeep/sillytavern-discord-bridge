import type { Router } from 'express';
import { registerCharacterRoutes } from './characters.js';
import { registerConfigRoutes } from './config.js';
import { registerDiagnosticRoutes } from './diagnostics.js';
import { registerDiscordRoutes } from './discord.js';
import { registerStatusRoutes } from './status.js';

export function registerRoutes(router: Router): void {
  registerStatusRoutes(router);
  registerConfigRoutes(router);
  registerDiscordRoutes(router);
  registerCharacterRoutes(router);
  registerDiagnosticRoutes(router);
}
