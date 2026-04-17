import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist/ui-extension',
    emptyOutDir: false,
    lib: {
      entry: 'src/ui-extension/index.ts',
      name: 'DiscordBridgeExtension',
      formats: ['es'],
      fileName: () => 'index.js',
    },
    rollupOptions: {
      output: {
        assetFileNames: 'styles.css',
      },
    },
  },
});
