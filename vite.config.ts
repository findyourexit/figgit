import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {viteSingleFile} from 'vite-plugin-singlefile';

// https://vitejs.dev/config/
export default defineConfig({
    root: './src/ui',
    plugins: [react(), viteSingleFile()],
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
        },
    },
    server: {
        port: 3000,
        strictPort: true,
    },
});
