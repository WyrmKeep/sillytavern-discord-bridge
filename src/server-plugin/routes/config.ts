import type { Request, Response, Router } from 'express';
import { resolveDefaultBridgePaths } from '../config/paths.js';
import {
  parseBridgeConfig,
  parseBridgeSecrets,
  redactConfig,
  redactSecrets,
} from '../config/schema.js';
import { readConfig, readSecrets, writeConfig, writeSecrets } from '../config/store.js';
import { authorizePluginRoute, type RouteAuthorizationInput } from './security.js';

export function registerConfigRoutes(router: Router): void {
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
      } catch (error) {
        response.status(400).json({ ok: false, reason: errorMessage(error) });
      }
    })();
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

function authorizeMutation(request: Request, response: Response): boolean {
  const result = authorizePluginRoute(getRouteAuthorizationInput(request));
  if (!result.ok) {
    response.status(result.status).json({ ok: false, reason: result.reason });
    return false;
  }
  return true;
}

function getRouteAuthorizationInput(request: Request): RouteAuthorizationInput {
  return {
    method: request.method,
    accountMode: 'disabled',
    origin: isSameOrigin(request) ? 'same-origin' : 'remote',
    remoteAddress: request.socket.remoteAddress,
    providedBearerToken: getBearerToken(request),
    expectedBearerToken: process.env.DISCORD_BRIDGE_PLUGIN_AUTH_TOKEN,
  };
}

function isSameOrigin(request: Request): boolean {
  const origin = request.get('origin');
  const host = request.get('host');
  if (!origin || !host) {
    return false;
  }

  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function getBearerToken(request: Request): string | undefined {
  const header = request.get('authorization');
  if (!header?.startsWith('Bearer ')) {
    return undefined;
  }
  return header.slice('Bearer '.length);
}

function getBodyObject(request: Request): Record<string, unknown> {
  return typeof request.body === 'object' && request.body !== null
    ? (request.body as Record<string, unknown>)
    : {};
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Invalid bridge configuration.';
}
