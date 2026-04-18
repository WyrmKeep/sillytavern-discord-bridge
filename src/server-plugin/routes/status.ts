import type { Router } from 'express';
import type { RouteRegistrationOptions } from './types.js';

export function registerStatusRoutes(
  router: Router,
  options: RouteRegistrationOptions = {},
): void {
  router.get('/status', (_request, response) => {
    response.json({
      ok: true,
      plugin: 'discord-bridge',
      discord: options.discordBotRuntime?.getStatus(),
    });
  });
}
