import path from 'node:path';

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
