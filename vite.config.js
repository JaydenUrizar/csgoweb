import { defineConfig } from 'vite';
export default defineConfig({
  base: './',
  server: { host: '0.0.0.0', port: 5173, strictPort: true, watch: { ignored: ['**/reference/**', '**/shots/**'] } },
  build: { target: 'es2022', chunkSizeWarningLimit: 2000 },
});
