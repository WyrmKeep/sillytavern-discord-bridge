import { cp, mkdir } from 'node:fs/promises';
import path from 'node:path';

const sillyTavernRoot = process.env.SILLYTAVERN_ROOT;
if (!sillyTavernRoot) {
  console.error('SILLYTAVERN_ROOT is required.');
  process.exit(1);
}

const serverPluginDir = path.join(sillyTavernRoot, 'plugins', 'discord-bridge');
const uiExtensionDir = path.join(
  sillyTavernRoot,
  'public',
  'scripts',
  'extensions',
  'third-party',
  'discord-bridge',
);

await mkdir(serverPluginDir, { recursive: true });
await mkdir(uiExtensionDir, { recursive: true });

await cp('dist/server-plugin', serverPluginDir, { recursive: true });
await cp('dist/ui-extension', uiExtensionDir, { recursive: true });
await cp('src/ui-extension/manifest.json', path.join(uiExtensionDir, 'manifest.json'));
await cp('src/ui-extension/templates', path.join(uiExtensionDir, 'templates'), { recursive: true });

console.log(`Installed server plugin to ${serverPluginDir}`);
console.log(`Installed UI extension to ${uiExtensionDir}`);
