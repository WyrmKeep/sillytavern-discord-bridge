import type { Router } from 'express';

export function registerDiagnosticRoutes(router: Router): void {
  router.get('/st-settings/status', (_request, response) => {
    response.json({ ok: false, reason: 'Not configured.' });
  });
}
