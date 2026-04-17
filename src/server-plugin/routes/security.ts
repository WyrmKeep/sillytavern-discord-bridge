export type RouteAuthorizationInput = {
  method: string;
  accountMode: 'enabled' | 'disabled';
  requestUserPresent?: boolean;
  requestUserAdmin?: boolean;
  origin?: 'same-origin' | 'remote';
  remoteAddress?: string;
  providedBearerToken?: string;
  expectedBearerToken?: string;
};

export type RouteAuthorizationResult =
  | { ok: true }
  | { ok: false; status: 401 | 403; reason: string };

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function authorizePluginRoute(input: RouteAuthorizationInput): RouteAuthorizationResult {
  const mutating = MUTATING_METHODS.has(input.method.toUpperCase());
  if (!mutating) {
    return { ok: true };
  }

  if (hasValidBearerToken(input)) {
    return { ok: true };
  }

  if (input.accountMode === 'enabled') {
    if (!input.requestUserPresent) {
      return { ok: false, status: 401, reason: 'Authentication required.' };
    }
    if (!input.requestUserAdmin) {
      return { ok: false, status: 403, reason: 'Admin access required.' };
    }
    return { ok: true };
  }

  if (input.origin === 'same-origin' && isLocalAddress(input.remoteAddress)) {
    return { ok: true };
  }

  return {
    ok: false,
    status: 403,
    reason: 'Mutating bridge routes require a local same-origin request or plugin bearer token.',
  };
}

function hasValidBearerToken(input: RouteAuthorizationInput): boolean {
  return Boolean(
    input.expectedBearerToken &&
      input.providedBearerToken &&
      input.providedBearerToken === input.expectedBearerToken,
  );
}

function isLocalAddress(address: string | undefined): boolean {
  if (!address) {
    return false;
  }
  return ['127.0.0.1', '::1', '::ffff:127.0.0.1', 'localhost'].includes(address);
}
