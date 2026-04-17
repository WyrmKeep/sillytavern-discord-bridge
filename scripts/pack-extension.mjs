import { cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';

const outputRoot = path.resolve('packaged/discord-bridge');
await rm(outputRoot, { recursive: true, force: true });
await mkdir(path.join(outputRoot, 'server-plugin'), { recursive: true });
await mkdir(path.join(outputRoot, 'ui-extension'), { recursive: true });

await cp('dist/server-plugin', path.join(outputRoot, 'server-plugin'), { recursive: true });
await cp('dist/ui-extension', path.join(outputRoot, 'ui-extension'), { recursive: true });
await cp('src/ui-extension/manifest.json', path.join(outputRoot, 'ui-extension/manifest.json'));
await cp('src/ui-extension/templates', path.join(outputRoot, 'ui-extension/templates'), {
  recursive: true,
});

console.log(`Packed extension to ${outputRoot}`);
