import type { Router } from 'express';
import { resolveDefaultBridgePaths } from '../config/paths.js';
import { readConfig } from '../config/store.js';
import { fallbackUserDirectories } from '../sillytavern/users.js';
import { listCharacterCards } from '../sillytavern/characters.js';

export function registerCharacterRoutes(router: Router): void {
  router.get('/characters', (_request, response) => {
    void (async () => {
      try {
        const paths = resolveDefaultBridgePaths();
        const config = await readConfig(paths.configFile);
        const userDirectories = fallbackUserDirectories(
          paths.dataRoot,
          config.sillyTavernUserHandle,
        );
        response.json(await listCharacterCards(userDirectories.characters));
      } catch (error) {
        response.status(500).json({
          ok: false,
          reason: error instanceof Error ? error.message : 'Failed to list characters.',
        });
      }
    })();
  });
}
