import type { Router } from 'express';

export function registerConfigRoutes(router: Router): void {
  router.get('/config', (_request, response) => {
    response.json({ ok: true });
  });
}
