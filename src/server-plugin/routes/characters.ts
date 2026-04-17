import type { Router } from 'express';

export function registerCharacterRoutes(router: Router): void {
  router.get('/characters', (_request, response) => {
    response.json([]);
  });
}
