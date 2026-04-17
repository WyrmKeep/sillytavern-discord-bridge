import { readFile } from 'node:fs/promises';
import { buildClaudeProxyRequest } from '../dist/server-plugin/generation/claude-reverse-proxy.js';
import { normalizeSillyTavernClaudeSettings } from '../dist/server-plugin/sillytavern/settings.js';

if (process.env.DISCORD_BRIDGE_SMOKE !== '1') {
  console.error('Set DISCORD_BRIDGE_SMOKE=1 to run the Claude proxy smoke test.');
  process.exit(1);
}

const settingsFile = process.env.SILLYTAVERN_SETTINGS_FILE;
if (!settingsFile) {
  console.error('SILLYTAVERN_SETTINGS_FILE is required. Run npm run build before this script.');
  process.exit(1);
}

const rawSettings = JSON.parse(await readFile(settingsFile, 'utf8'));
const settings = normalizeSillyTavernClaudeSettings(rawSettings);
const request = buildClaudeProxyRequest(
  { ...settings, maxTokens: 8, temperature: 0, topP: 1, assistantPrefill: undefined },
  { system: [], messages: [{ role: 'user', content: 'Reply with exactly: ok' }] },
);

const response = await fetch(request.url, {
  method: 'POST',
  headers: request.headers,
  body: JSON.stringify(request.body),
});

const text = await response.text();
if (!response.ok) {
  console.error(`Claude proxy smoke failed: ${response.status} ${text.slice(0, 200)}`);
  process.exit(1);
}

if (!text.toLowerCase().includes('ok')) {
  console.error(`Claude proxy smoke response did not include ok: ${text.slice(0, 200)}`);
  process.exit(1);
}

console.log('Claude proxy smoke passed.');
