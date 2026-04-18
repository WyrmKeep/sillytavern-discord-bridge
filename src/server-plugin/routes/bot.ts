import type { Router } from 'express';
import type { RouteRegistrationOptions } from './types.js';
import { authorizeMutation } from './request-auth.js';

export function registerBotRoutes(
  router: Router,
  options: RouteRegistrationOptions = {},
): void {
  router.post('/bot/restart', async (request, response) => {
    if (!authorizeMutation(request, response)) {
      return;
    }

    if (!options.discordBotRuntime) {
      response.status(503).json({
        ok: false,
        reason: 'Discord bot runtime is unavailable.',
      });
      return;
    }

    const status = await options.discordBotRuntime.reconcile();
    response.json({
      ok: true,
      discord: status,
    });
  });
}
