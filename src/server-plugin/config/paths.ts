import path from 'node:path';
import { detectSillyTavernRoot } from '../sillytavern/imports.js';

export type BridgePaths = {
  dataRoot: string;
  bridgeRoot: string;
  configFile: string;
  secretsFile: string;
  stateFile: string;
};

export function resolveBridgePaths(dataRoot: string): BridgePaths {
  const bridgeRoot = path.join(dataRoot, '_discord-bridge');
  return {
    dataRoot,
    bridgeRoot,
    configFile: path.join(bridgeRoot, 'config.json'),
    secretsFile: path.join(bridgeRoot, 'secrets.json'),
    stateFile: path.join(bridgeRoot, 'state.json'),
  };
}

export function resolveDefaultBridgePaths(): BridgePaths {
  const dataRoot = process.env.SILLYTAVERN_DATA_ROOT ?? path.join(detectSillyTavernRoot(), 'data');
  return resolveBridgePaths(dataRoot);
}
