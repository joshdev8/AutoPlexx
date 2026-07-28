# AutoPlexx Command Center

The dashboard app for the AutoPlexx stack. React + Vite frontend, Fastify backend, shipped as a single container.

For what it does and how it's configured, see the [Dashboard section of the main README](../README.md#dashboard). This file covers working on the code.

## Why there's a backend

The frontend can't call the stack's APIs directly. Three reasons, any one of which would be enough:

1. **API keys must not reach the browser.** They're read server-side and never serialized to the client.
2. **No CORS headers.** The \*arr APIs and Tautulli reject cross-origin requests from a browser page.
3. **Network isolation.** Several services are only reachable on internal bridge networks, and Transmission's RPC needs a `409` → `X-Transmission-Session-Id` → retry handshake that's awkward from a browser.

So the server is a backend-for-frontend: it holds the credentials, fans out to the upstreams, and exposes one same-origin `/api/*` surface. The browser only ever talks to it.

## Layout

```
server/   Fastify BFF — /api routes, upstream clients, static hosting
web/      React + Vite SPA
```

`server/src/services.ts` is the single source of truth for the service list. Both the sidebar and the Launcher render from it, and `/api/health` matches container state against it. **When a service is added to or removed from `docker-compose.yml`, update that file to match** — including `container`, which must equal the compose `container_name`.

## Commands

Run from this directory:

```bash
npm ci            # install
npm run dev       # Fastify on :8090 + Vite on :5173 (Vite proxies /api)
npm run typecheck
npm run lint
npm test
npm run build     # web -> web/dist, server -> server/dist
```

`npm run dev` points at `http://docker-socket-proxy:2375` by default, which won't resolve outside Compose. Override it to develop against a local proxy:

```bash
docker run -d --name ap-proxy -p 12375:2375 \
  -e CONTAINERS=1 -e POST=0 \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  ghcr.io/tecnativa/docker-socket-proxy:latest

DOCKER_PROXY_URL=http://localhost:12375 npm run dev
```

## Styling

`web/src/styles/nocturne.css` is the Nocturne design system, vendored from the issue #48 design handoff. **Take every color, spacing, radius and shadow from its `var(--*)` tokens; don't hard-code a value a token already carries.** `web/src/styles/autoplexx.css` adds the stack-specific semantic hues (`--ap-green`, `--ap-amber`, …) and the light-theme overrides.

Two things were changed from the original handoff, both deliberately: Inter is self-hosted via `@fontsource/inter` and icons via `@phosphor-icons/react`, rather than loaded from Google Fonts and unpkg. A self-hosted media stack often has no outbound internet, and a webfont that silently fails to load takes the type scale with it.

## Environment

Every variable has a working default — the app must start and be useful against a completely unconfigured `.env`.

| Variable | Default | Purpose |
|---|---|---|
| `DASHBOARD_PORT` | `8090` | Listen port |
| `DASHBOARD_HOST` | `0.0.0.0` | Listen address |
| `DOCKER_PROXY_URL` | `http://docker-socket-proxy:2375` | Socket proxy base URL |
| `GRAFANA_PORT` | `3000` | Follows the stack's `GRAFANA_PORT` so the Launcher link is right |
| `HEALTH_TTL_MS` | `5000` | Container-state cache TTL |
| `LOG_LEVEL` | `info` | Fastify log level |

## Conventions

- **Nothing may throw on missing configuration.** An unset key or an unreachable upstream degrades that one panel; it never blanks the page.
- **Upstream calls go through `cache.ts`.** It de-duplicates in-flight requests so concurrent viewers can't stampede a slow service.
- **A failed refresh keeps the last good data on screen** and surfaces staleness, rather than replacing content with an error.
