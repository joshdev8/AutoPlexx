import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Mirrors the server's DASHBOARD_PORT handling in server/src/config.ts. Without
// this, setting a non-default port breaks /api and /healthz in dev only — the
// kind of mismatch that wastes an afternoon.
const parsed = Number(process.env.DASHBOARD_PORT);
const dashboardPort = Number.isInteger(parsed) && parsed > 0 && parsed <= 65_535 ? parsed : 8090;
const dashboardTarget = `http://localhost:${dashboardPort}`;

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
      '/api': dashboardTarget,
      '/healthz': dashboardTarget,
    },
  },
});
