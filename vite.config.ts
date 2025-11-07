import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// https://vitejs.dev/config/
export default defineConfig({
  root: './src/ui',
  plugins: [
    preact(),
    viteSingleFile(),
    // Custom plugin to handle webpack-specific CSS imports from @create-figma-plugin/ui
    {
      name: 'ignore-webpack-loaders',
      resolveId(id) {
        // Ignore webpack loader syntax (e.g., "!../css/base.css")
        if (id.startsWith('!')) {
          return { id: 'virtual:ignore', external: true };
        }
        return null;
      },
    },
  ],
  build: {
    target: 'esnext',
    assetsInlineLimit: 100000000,
    chunkSizeWarningLimit: 100000000,
    cssCodeSplit: false,
    outDir: '../../dist',
    emptyOutDir: false, // Don't delete plugin.js
    rollupOptions: {
      input: {
        ui: './src/ui/index.html',
      },
      output: {
        inlineDynamicImports: true,
        entryFileNames: 'ui.js',
      },
      external: ['virtual:ignore'],
    },
  },
  resolve: {
    alias: {
      // Ensure proper module resolution
      'preact/hooks': 'preact/hooks',
      preact: 'preact',
    },
  },
  server: {
    port: 3000,
    strictPort: true,
  },
});
