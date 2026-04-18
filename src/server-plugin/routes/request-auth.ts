import type { Request, Response } from 'express';
import { authorizePluginRoute, type RouteAuthorizationInput } from './security.js';

export function authorizeMutation(request: Request, response: Response): boolean {
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
