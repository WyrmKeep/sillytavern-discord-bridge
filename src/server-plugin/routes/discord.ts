import type { Router } from 'express';
import { buildGuildCommandsData } from '../discord/commands.js';

export function registerDiscordRoutes(router: Router): void {
  router.get('/discord/commands', (_request, response) => {
    response.json(buildGuildCommandsData());
  });
}
