import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    // The server serves this from ../web relative to its compiled output.
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    // `npm run dev` runs Vite and the Fastify server side by side; proxy the
    // API so the browser still sees a single origin, as it does in production.
    proxy: {
      '/api': 'http://localhost:8090',
      '/healthz': 'http://localhost:8090',
    },
  },
});
