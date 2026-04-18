import type { Request, Response, Router } from 'express';
import { resolveDefaultBridgePaths } from '../config/paths.js';
import {
  parseBridgeConfig,
  parseBridgeSecrets,
  redactConfig,
  redactSecrets,
} from '../config/schema.js';
import { readConfig, readSecrets, writeConfig, writeSecrets } from '../config/store.js';
import { logError } from '../logging.js';
import { authorizeMutation } from './request-auth.js';
import type { RouteRegistrationOptions } from './types.js';

export function registerConfigRoutes(
  router: Router,
  options: RouteRegistrationOptions = {},
): void {
  router.get('/config', (_request, response) => {
    void sendConfigPayload(response);
  });

  router.put('/config', (request, response) => {
    if (!authorizeMutation(request, response)) {
      return;
    }

    void (async () => {
      try {
        const paths = resolveDefaultBridgePaths();
        const config = parseBridgeConfig(getBodyObject(request).config ?? getBodyObject(request));
        await writeConfig(paths.configFile, config);
        await sendConfigPayload(response);
        scheduleDiscordBotReconcile(options);
      } catch (error) {
        response.status(400).json({ ok: false, reason: errorMessage(error) });
      }
    })();
  });

  router.put('/secrets', (request, response) => {
    if (!authorizeMutation(request, response)) {
      return;
    }

    void (async () => {
      try {
        const paths = resolveDefaultBridgePaths();
        const existingSecrets = await readSecrets(paths.secretsFile);
        const input = getBodyObject(request);
        const secrets = parseBridgeSecrets({
          ...existingSecrets,
          discordBotToken:
            typeof input.discordBotToken === 'string' && input.discordBotToken.trim()
              ? input.discordBotToken
              : existingSecrets.discordBotToken,
        });
        await writeSecrets(paths.secretsFile, secrets);
        await sendConfigPayload(response);
        scheduleDiscordBotReconcile(options);
      } catch (error) {
        response.status(400).json({ ok: false, reason: errorMessage(error) });
      }
    })();
  });
}

function scheduleDiscordBotReconcile(options: RouteRegistrationOptions): void {
  void options.discordBotRuntime?.reconcile().catch((error: unknown) => {
    logError('discord bot reconcile after config change failed', error);
  });
}

async function sendConfigPayload(response: Response): Promise<void> {
  const paths = resolveDefaultBridgePaths();
  const [config, secrets] = await Promise.all([
    readConfig(paths.configFile),
    readSecrets(paths.secretsFile),
  ]);
  response.json({
    config: redactConfig(config),
    secrets: redactSecrets(secrets),
  });
}

function getBodyObject(request: Request): Record<string, unknown> {
  return typeof request.body === 'object' && request.body !== null
    ? (request.body as Record<string, unknown>)
    : {};
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Invalid bridge configuration.';
}
