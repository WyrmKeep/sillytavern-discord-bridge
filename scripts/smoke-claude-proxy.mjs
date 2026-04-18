import { readFile } from 'node:fs/promises';
import {
  buildSillyTavernBackendRequest,
  sendSillyTavernBackendRequest,
} from '../dist/server-plugin/generation/st-backend-generation.js';
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
const request = buildSillyTavernBackendRequest({
  settings: { ...settings, maxTokens: 8, temperature: 0, topP: 1, assistantPrefill: undefined },
  messages: [{ role: 'user', content: 'Reply with exactly: ok' }],
  characterName: 'Smoke',
  userName: 'Tester',
});

const text = await sendSillyTavernBackendRequest(request, {
  baseUrl: process.env.SILLYTAVERN_BASE_URL,
});

if (!text.toLowerCase().includes('ok')) {
  console.error(`SillyTavern backend smoke response did not include ok: ${text.slice(0, 200)}`);
  process.exit(1);
}

console.log('SillyTavern backend smoke passed.');
