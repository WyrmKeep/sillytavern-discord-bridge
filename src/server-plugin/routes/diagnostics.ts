import type { Router } from 'express';
import { resolveDefaultBridgePaths } from '../config/paths.js';
import { readConfig } from '../config/store.js';
import {
  normalizeSillyTavernClaudeSettings,
  readSillyTavernSettingsFile,
} from '../sillytavern/settings.js';
import { fallbackUserDirectories } from '../sillytavern/users.js';

export function registerDiagnosticRoutes(router: Router): void {
  router.get('/st-settings/status', (_request, response) => {
    void (async () => {
      try {
        const paths = resolveDefaultBridgePaths();
        const config = await readConfig(paths.configFile);
        const directories = fallbackUserDirectories(paths.dataRoot, config.sillyTavernUserHandle);
        const rawSettings = await readSillyTavernSettingsFile(directories.settings);
        const settings = normalizeSillyTavernClaudeSettings(rawSettings);

        response.json({
          ok: true,
          mainApi: settings.mainApi,
          chatCompletionSource: settings.chatCompletionSource,
          model: settings.model,
          reverseProxy: '<configured>',
          proxyPassword: settings.proxyPassword ? '<present>' : '<missing>',
          stream: settings.stream,
          originalStreamOpenAI: settings.originalStreamOpenAI,
          useSystemPrompt: settings.useSystemPrompt,
          reasoningEffort: settings.reasoningEffort,
          verbosity: settings.verbosity,
        });
      } catch (error) {
        response.json({
          ok: false,
          reason: error instanceof Error ? error.message : 'SillyTavern settings are not configured.',
        });
      }
    })();
  });
}
