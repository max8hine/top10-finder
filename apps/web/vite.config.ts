import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // In dev, /api calls go to the JSON API started with `pnpm run api`.
  server: { proxy: { '/api': 'http://127.0.0.1:3000' } },
});
