export type BridgeStatus = {
  ok: boolean;
  plugin?: string;
};

export async function fetchBridgeStatus(): Promise<BridgeStatus> {
  const response = await fetch('/api/plugins/discord-bridge/status');
  if (!response.ok) {
    throw new Error(`Bridge status failed: ${response.status}`);
  }
  return (await response.json()) as BridgeStatus;
}
