import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';

import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';

import { config } from './config.js';
import { getHealth } from './sources/docker.js';
import { getMetrics } from './sources/prometheus.js';
import { getStreams, getPoster } from './sources/tautulli.js';
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
 * Poster artwork, proxied from Plex via Tautulli.
 *
 * The browser can't call Tautulli itself — it may have no route to it, and the
 * API key must not leave the server — so posters come through here. `img` is
 * re-validated against Plex's metadata path shape inside `getPoster` even
 * though this server produced it, since it round-trips through the client.
 *
 * Any failure is a 404 rather than a 5xx: the poster tile falls back to its
 * monogram, which is the same thing it renders before the image loads.
 */
app.get<{ Querystring: { img?: string } }>('/api/poster', async (request, reply) => {
  const img = request.query.img;
  const image = img ? await getPoster(img) : null;
  if (!image) return reply.code(404).send({ error: 'no poster' });

  // The timestamp in a Plex image path changes whenever the artwork does, so
  // any given URL is safe to cache hard.
  return reply
    .header('content-type', image.contentType)
    .header('cache-control', 'public, max-age=86400')
    .send(image.body);
});

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
