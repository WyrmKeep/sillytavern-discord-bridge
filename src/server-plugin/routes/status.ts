import type { Router } from 'express';

export function registerStatusRoutes(router: Router): void {
  router.get('/status', (_request, response) => {
    response.json({
      ok: true,
      plugin: 'discord-bridge',
    });
  });
}
