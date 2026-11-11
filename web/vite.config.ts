import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: { '@shared': fileURLToPath(new URL('../shared', import.meta.url)) },
  },
  server: {
    // The UI imports the same validation code as the server
    fs: { allow: ['..'] },
    proxy: { '/api': 'http://localhost:8080' },
  },
  build: { outDir: 'dist', emptyOutDir: true },
});
