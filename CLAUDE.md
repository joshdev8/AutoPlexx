# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

AutoPlexx is a Docker Compose stack that orchestrates a Plex Media Server ecosystem. Most work here means editing `docker-compose.yml`, the `.env`/`.env.example` contract, or the Kometa / Telegraf / Prometheus config files.

The one exception is `dashboard/` — a real application (React + Vite frontend, Fastify backend) that does have a build, a lint, and a test suite. See "The dashboard app" below.

## Common commands

```bash
docker compose config                       # validate compose + env interpolation
docker compose up -d                        # start all services
docker compose up -d <service>              # (re)start a single service after editing it
docker compose logs -f <service>            # tail one service's logs
docker compose pull && docker compose up -d # update images (Watchtower also does this automatically)
docker compose down                         # stop everything (volumes preserved)
```

After changing `docker-compose.yml`, always run `docker compose config` to catch interpolation errors before bringing services up. Note that `docker compose config` fails on `.env.example`'s blank placeholders for the `${VAR:?...}` vars — fill them with throwaway values first, as `.github/workflows/compose-validate.yml` does.

For `dashboard/`, run from that directory:

```bash
npm ci && npm run typecheck && npm run lint && npm test && npm run build
```

## The dashboard app

`dashboard/` is an npm workspace root with two workspaces: `server/` (Fastify BFF) and `web/` (React SPA). It is published to `ghcr.io/joshdev8/autoplexx-dashboard` by `.github/workflows/dashboard-release.yml`; `docker-compose.yml` declares both `image:` and `build:` so users pull and contributors build. **Never remove the `image:` line in favour of `build:` alone** — that would force every person who clones this public repo to run a Node build on first `docker compose up`, which the design explicitly rules out.

Things that aren't obvious:

- **`server/src/services.ts` is the single source of truth** for the service list. Its `container` field must match `container_name` in `docker-compose.yml` exactly, or health lookups silently report the service as `absent`. Adding a service to compose means adding it here too.
- **Container status comes from `docker-socket-proxy`, never a direct socket mount.** `:ro` on a socket does not make the Docker API read-only — it only affects the file node — so mounting it into the dashboard would be a second root-equivalent exposure alongside Portainer's. The proxy runs with `CONTAINERS=1` and everything else off. If asked to "simplify" by mounting the socket directly, push back.
- **API keys are auto-discovered, not configured.** The dashboard reads each service's own config file (`config.xml` for the \*arrs, `config.ini` for Tautulli, `settings.json` for Seerr) through the read-only `/discover/*` mounts. Resolution order is env var → discovered file → unconfigured. Discovery re-runs at runtime because on a clean install those files don't exist until each service's first boot — so a panel must recover on its own without a dashboard restart.
- **Nothing may throw on missing configuration.** An unset key or a dead upstream degrades that one panel. One failed integration must never blank the page, and a failed refresh keeps the last good data on screen. Every widget route returns `Result<T>` — either the payload with `available: true`, or `{ available: false, reason, hint }`. Routes return 200 even when the upstream failed; the discriminant is how the UI decides what to render. Wrap source loads in `safely()` from `http.ts` rather than letting them reject.
- **A `hint` must name the actual fix.** `hintFor()` in `sources/transmission.ts` is the pattern: a rejected credential and an unreachable host need different advice, and a generic hint sends people looking in the wrong place.
- **`web/src/styles/nocturne.css` is a vendored design system** from the issue #48 handoff. Take colors, spacing, radii and shadows from its `var(--*)` tokens rather than hard-coding values. Inter and Phosphor icons are self-hosted on purpose — a self-hosted media stack may have no outbound internet, so don't "optimize" them back to a CDN.
- **Both new containers are named `autoplexx-*`** (`autoplexx-dashboard`, `autoplexx-socket-proxy`) rather than the bare `dashboard` / `docker-socket-proxy`, because those names are generic enough to collide with something a user already runs — and a `container_name` collision fails `docker compose up` outright.

## Architecture notes that aren't obvious from a glance

**Network isolation matters.** Services are split across four bridge networks and one host-mode service. A service can only reach another if they share a network — adding a new service requires picking the right one (or declaring multiple):

- `monitoring_network` — tautulli, grafana, telegraf, watchtower, portainer, prometheus, cadvisor, node-exporter, dashboard, docker-socket-proxy
- `media_network` — seerr, radarr, sonarr, prowlarr, bazarr, flaresolverr, maintainerr, checkrr, dashboard
- `download_network` — transmission, watchlistarr, cleanarr, requestrr, decluttarr, radarr, sonarr, dashboard
- `tracearr-network` — tracearr, timescale (PostgreSQL), redis
- **host network** — plex only (required for proper streaming/discovery)

`dashboard` is on all three service networks because it aggregates from all of them. It reaches Plex — which is on the host network — via `host.docker.internal`, hence its `extra_hosts` entry.

Radarr and Sonarr are deliberately on both `media_network` (so Seerr, Prowlarr, and Bazarr can reach them) and `download_network` (so Watchlistarr/Transmission can reach them). Prowlarr and Bazarr only need `media_network` because their only inbound/outbound peers are the *arr APIs.

**Portainer mounts the Docker socket.** `portainer/portainer-ce` binds `/var/run/docker.sock` read-write, which is root-equivalent access to the host. If a user reports security concerns, this is the relevant exposure — flag it before recommending Portainer-based workflows.

**Tracearr is the only multi-container subsystem.** Every other third-party service is a single off-the-shelf container. Tracearr is three containers (app + TimescaleDB + Redis) with healthcheck-gated `depends_on`. Its external port is `3001` mapped to internal `3000` because Grafana already owns `3000` on the host. (The only first-party *application* in this repo is `dashboard/` — see above.)

**Two groups of vars use the `${VAR:?must be set}` fail-fast form**, and a blank value in either fails `docker compose up` for the whole stack, not just that service: Tracearr's `DB_PASSWORD` / `JWT_SECRET` / `COOKIE_SECRET`, and Transmission's `OPENVPN_PROVIDER` / `OPENVPN_CONFIG` / `OPENVPN_USERNAME` / `OPENVPN_PASSWORD`.

**Volume paths are intentionally user-specific.** All bind mounts are rooted at `${USERDIR}` from `.env`. When advising the user, do not assume any particular host path layout — the README explicitly tells them to update paths to match their drive mounts.

**Prometheus is live, but only cAdvisor + node-exporter feed it.** `prometheus/prometheus.yml` is mounted into the prometheus container; only the `cadvisor` and `node_exporter` scrape jobs are active. The `telegraf` and `tautulli` jobs are commented out because those containers don't expose a `/metrics` endpoint by default — telegraf would need the `prometheus_client` output plugin enabled, and Tautulli needs a metrics plugin installed. Grafana points at Prometheus the same way it would point at any data source — configure it in the Grafana UI after first boot.

**cAdvisor needs `privileged: true` and several host-fs mounts.** This is the standard cAdvisor pattern; flag it if a user reports security concerns about the monitoring stack. It also binds host port `8080` — if a user has something else on `8080`, that's the conflict.

**Transmission uses `haugene/transmission-openvpn` and won't start without VPN credentials.** The container runs an OpenVPN client internally; `OPENVPN_PROVIDER`, `OPENVPN_CONFIG`, `OPENVPN_USERNAME`, and `OPENVPN_PASSWORD` must all be set in `.env`. The compose service declares `cap_add: NET_ADMIN` and `devices: /dev/net/tun` for the OpenVPN client; the data volume is `/data` (haugene's convention), not `/config` like the linuxserver image. `LOCAL_NETWORK` (CIDR, default `192.168.0.0/16`) controls which destinations bypass the tunnel — if a user reports the web UI is unreachable, this is almost always the cause.

**Plex claim tokens expire in ~4 minutes.** `PLEX_CLAIM` must be set in `.env` immediately before `docker compose up -d` on first run. If the user reports a Plex auth issue on first boot, this is almost always why.

**Jellyfin is an optional, commented-out swap for Plex.** `docker-compose.yml` carries a
fully-formed but commented `jellyfin:` service (host network, port `8096`, no claim
token) directly under `plex:`; the intended workflow is to comment out one and uncomment
the other, per issue #56. The dashboard catalog (`services.ts`) already lists Jellyfin so
its panel self-heals when enabled. Tautulli, Watchlistarr, Kometa, and Maintainerr are
Plex-API-specific and do NOT work against Jellyfin — and since the dashboard's now-playing
and poster panels read through Tautulli, those are Plex-bound too. Seerr does support a
Jellyfin backend, but only after the media server is re-pointed in its own settings — the
compose swap alone doesn't move it. Wiring Jellyfin-native companions is deliberately left
as a follow-up.

**Nothing may `depends_on: plex`.** Compose rejects a project whose `depends_on` names an
undefined service, so a single such reference turns the documented Jellyfin swap into a
hard failure for all 25 services — `config`, `up`, and even `down`. Tautulli used to carry
one; it was removed. It bought nothing anyway, since Plex is host-network and its peers are
on bridge networks, so compose can neither link nor meaningfully order them. The same
reasoning applies to any future optional service: an optional service must have no
dependents.

## Kometa (plex-meta-manager) layout

The mounted config directory is `plex-meta-manager/config/`. Its structure is referenced explicitly by `config.yml`:

- `config.yml` — top-level Kometa config (Plex/TMDb/Tautulli/Trakt/OMDb/MDBList credentials via `${PMM_*}` env vars; library mappings for `Movies` and `TV Shows`)
- `Movies/Movies.yml`, `Movies/Overlays.yml` — collection and overlay definitions for the Movies library (Movies.yml is ~1200 lines)
- `TV Shows/TV Shows.yml`, `TV Shows/Overlays.yml` — same for TV
- `Playlists.yml` — top-level playlist definitions

`config.yml` loads both the named files *and* `folder: config/Movies/` / `config/TV Shows/`, so any new `.yml` dropped in those folders is auto-picked-up. Note the literal space in the `TV Shows` path — quote it in shell commands.

## Env var contract

`.env.example` is the source of truth for what `.env` needs, and every var in it is actually consumed by `docker-compose.yml`. The values fall into two categories:

1. **Hard-required** (stack won't start): `DB_PASSWORD`, `JWT_SECRET`, `COOKIE_SECRET` (Tracearr); `OPENVPN_PROVIDER`, `OPENVPN_CONFIG`, `OPENVPN_USERNAME`, `OPENVPN_PASSWORD` (Transmission VPN). All use the `${VAR:?must be set}` fail-fast form.
2. **Effectively required for the feature to work**: `PUID`/`PGID`/`TZ`/`USERDIR` (everything), `PLEX_CLAIM` (first-boot only), `GRAFANA_PORT` (defaults to 3000 if unset), `LOCAL_NETWORK` (Transmission, defaults to `192.168.0.0/16`), `PMM_*` (Kometa), `TRANSMISSION_RPC_USERNAME`/`TRANSMISSION_RPC_PASSWORD` (optional web UI auth).
3. **Populated after first boot**: `RADARR_API_KEY`, `SONARR_API_KEY` (Decluttarr). These come from the Radarr/Sonarr UIs after the stack is up — Decluttarr starts fine with them blank and skips any service whose key isn't set. **Note:** this is a real exception to the "every var in `.env.example` is consumed by compose" rule above — flag this chicken-and-egg to users on first-boot questions, since the *arr API keys are only obtainable post-`up`.

If a user mentions an env var not in this list (e.g. `DOCKER_INFLUXDB_*`, `PLEX_TOKEN`, `EMAIL`/`PASSWORD`), it's from an older version of the stack — not consumed today.
