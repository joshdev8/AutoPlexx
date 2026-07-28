import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';

import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';

import { config } from './config.js';
import { getHealth } from './sources/docker.js';
import { getMetrics } from './sources/prometheus.js';
import { getStreams } from './sources/tautulli.js';
import { getDownloads, getVpn } from './sources/transmission.js';
import { getRequests } from './sources/seerr.js';
import { getUpcoming } from './sources/upcoming.js';
import { getActivity } from './sources/activity.js';
import { getCredentials } from './discovery.js';
import { SERVICES, VISIBLE_GROUPS, withResolvedPorts } from './services.js';

const here = dirname(fileURLToPath(import.meta.url));
// In the built image the SPA sits next to the compiled server as ../web.
const webRoot = join(here, '..', 'web');

const app = Fastify({
  logger: { level: process.env.LOG_LEVEL ?? 'info' },
});

/** Liveness probe — deliberately dependency-free so it stays true if upstreams die. */
app.get('/healthz', async () => ({ ok: true }));

/**
 * The service catalog plus the ports the browser should link to. Ports are sent
 * without a host so the client can build URLs against whatever hostname it was
 * loaded from — this stack is reached by IP as often as by name.
 */
app.get('/api/services', async () => ({
  groups: VISIBLE_GROUPS,
  services: withResolvedPorts([...SERVICES], config.grafanaPort),
}));

/** Live container state behind a short TTL cache. Never throws. */
app.get('/api/health', async () => {
  const report = await getHealth();
  return { ...report, services: withResolvedPorts(report.services, config.grafanaPort) };
});

/**
 * Widget data. Every one of these resolves to either a payload with
 * `available: true` or an `{ available: false, reason, hint }` — they never
 * reject, so one dead upstream can't take down the response.
 */
app.get('/api/metrics', async () => getMetrics());
app.get('/api/streams', async () => getStreams());
app.get('/api/downloads', async () => getDownloads());
app.get('/api/requests', async () => getRequests());
app.get('/api/upcoming', async () => getUpcoming());
app.get('/api/activity', async () => getActivity());
app.get('/api/vpn', async () => getVpn());

/**
 * Integration status for the Setup panel — what's live, what's still waiting on
 * a service's first boot, and the one concrete step for anything that's stuck.
 *
 * Deliberately reports only whether a key was found and where it came from.
 * The keys themselves never leave the server.
 */
app.get('/api/integrations', async () => {
  const credentials = await getCredentials();
  return {
    integrations: Object.values(credentials).map((credential) => ({
      source: credential.source,
      state: credential.state,
      origin: credential.origin,
      hint: credential.hint,
    })),
  };
});

// Serve the built SPA. Skipped in dev, where Vite serves the frontend itself.
if (existsSync(webRoot)) {
  await app.register(fastifyStatic, { root: webRoot });

  // Client-side routing: anything that isn't /api or a real file gets the shell.
  app.setNotFoundHandler(async (request, reply) => {
    if (request.url.startsWith('/api')) {
      return reply.code(404).send({ error: 'not found' });
    }
    return reply.sendFile('index.html');
  });
} else {
  app.log.warn(`no built frontend at ${webRoot} — serving API only`);
}

try {
  await app.listen({ port: config.port, host: config.host });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
