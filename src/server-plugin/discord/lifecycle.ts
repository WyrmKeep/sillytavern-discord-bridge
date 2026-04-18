import { createHash } from 'node:crypto';
import { resolveDefaultBridgePaths } from '../config/paths.js';
import {
  type DiscordBridgeConfig,
  type DiscordBridgeSecrets,
} from '../config/schema.js';
import { readConfig, readSecrets } from '../config/store.js';
import { logError, logInfo } from '../logging.js';
import { createDiscordClient } from './client.js';

export type DiscordBotClient = {
  destroy(): void;
  isReady(): boolean;
  login(token: string): Promise<string>;
  user?: { tag?: string } | null;
};

export type DiscordBotState =
  | 'disabled'
  | 'missing-token'
  | 'starting'
  | 'ready'
  | 'error'
  | 'stopped';

export type DiscordBotStatus = {
  enabled: boolean;
  ready: boolean;
  state: DiscordBotState;
  reason?: string;
  userTag?: string;
};

export type DiscordBotRuntime = {
  getStatus(): DiscordBotStatus;
  reconcile(): Promise<DiscordBotStatus>;
  stop(): Promise<DiscordBotStatus>;
};

export type DiscordBotRuntimeDependencies = {
  createClient: () => DiscordBotClient;
  readConfig: () => Promise<DiscordBridgeConfig>;
  readSecrets: () => Promise<DiscordBridgeSecrets>;
  logInfo?: (message: string) => void;
  logError?: (message: string) => void;
};

export function createDiscordBotRuntime(
  dependencies: DiscordBotRuntimeDependencies,
): DiscordBotRuntime {
  let activeClient: DiscordBotClient | undefined;
  let activeTokenFingerprint: string | undefined;
  let status: DiscordBotStatus = {
    enabled: false,
    ready: false,
    state: 'stopped',
  };
  let queue = Promise.resolve();

  return {
    getStatus: () => currentStatus(activeClient, status),
    reconcile: () =>
      enqueue(queue, (nextQueue) => {
        queue = nextQueue;
      }, async () => {
        const [config, secrets] = await Promise.all([
          dependencies.readConfig(),
          dependencies.readSecrets(),
        ]);

        if (!config.enabled) {
          await stopActiveClient();
          status = {
            enabled: false,
            ready: false,
            state: 'disabled',
            reason: 'Discord bridge is disabled.',
          };
          return status;
        }

        const token = secrets.discordBotToken?.trim();
        if (!token) {
          await stopActiveClient();
          status = {
            enabled: true,
            ready: false,
            state: 'missing-token',
            reason: 'Discord bot token is not configured.',
          };
          return status;
        }

        const nextTokenFingerprint = fingerprintToken(token);
        if (activeClient && activeTokenFingerprint === nextTokenFingerprint) {
          return currentStatus(activeClient, status);
        }

        await stopActiveClient();
        activeClient = dependencies.createClient();
        activeTokenFingerprint = nextTokenFingerprint;
        status = {
          enabled: true,
          ready: false,
          state: 'starting',
        };

        try {
          await activeClient.login(token);
          status = currentStatus(activeClient, status);
          dependencies.logInfo?.(`discord bot ${status.ready ? 'ready' : 'starting'}`);
          return status;
        } catch (error) {
          await stopActiveClient();
          const reason = errorMessage(error);
          status = {
            enabled: true,
            ready: false,
            state: 'error',
            reason,
          };
          dependencies.logError?.(`discord bot login failed: ${reason}`);
          return status;
        }
      }),
    stop: () =>
      enqueue(queue, (nextQueue) => {
        queue = nextQueue;
      }, async () => {
        await stopActiveClient();
        status = {
          enabled: false,
          ready: false,
          state: 'stopped',
        };
        return status;
      }),
  };

  async function stopActiveClient(): Promise<void> {
    if (!activeClient) {
      activeTokenFingerprint = undefined;
      return;
    }

    activeClient.destroy();
    activeClient = undefined;
    activeTokenFingerprint = undefined;
  }
}

export function createDefaultDiscordBotRuntime(): DiscordBotRuntime {
  return createDiscordBotRuntime({
    createClient: createDiscordClient,
    readConfig: async () => {
      const paths = resolveDefaultBridgePaths();
      return readConfig(paths.configFile);
    },
    readSecrets: async () => {
      const paths = resolveDefaultBridgePaths();
      return readSecrets(paths.secretsFile);
    },
    logInfo,
    logError: (message) => logError(message),
  });
}

export const discordBotRuntime = createDefaultDiscordBotRuntime();

async function enqueue<T>(
  queue: Promise<unknown>,
  setQueue: (nextQueue: Promise<void>) => void,
  operation: () => Promise<T>,
): Promise<T> {
  const next = queue.then(operation, operation);
  setQueue(next.then(
    () => undefined,
    () => undefined,
  ));
  return next;
}

function currentStatus(
  client: DiscordBotClient | undefined,
  previousStatus: DiscordBotStatus,
): DiscordBotStatus {
  if (!client) {
    return previousStatus;
  }

  if (client.isReady()) {
    return {
      enabled: true,
      ready: true,
      state: 'ready',
      userTag: client.user?.tag,
    };
  }

  return {
    enabled: true,
    ready: false,
    state: 'starting',
  };
}

function fingerprintToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Discord bot login failed.';
}
