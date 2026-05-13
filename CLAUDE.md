# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

AutoPlexx is a Docker Compose stack that orchestrates a Plex Media Server ecosystem — there is no application source code to build, lint, or test. Work here means editing `docker-compose.yml`, the `.env`/`.env.example` contract, or the Kometa / Telegraf / Prometheus config files.

## Common commands

```bash
docker compose config                       # validate compose + env interpolation
docker compose up -d                        # start all services
docker compose up -d <service>              # (re)start a single service after editing it
docker compose logs -f <service>            # tail one service's logs
docker compose pull && docker compose up -d # update images (Watchtower also does this automatically)
docker compose down                         # stop everything (volumes preserved)
```

There is no test suite. After changing `docker-compose.yml`, always run `docker compose config` to catch interpolation errors before bringing services up.

## Architecture notes that aren't obvious from a glance

**Network isolation matters.** Services are split across four bridge networks and one host-mode service. A service can only reach another if they share a network — adding a new service requires picking the right one (or declaring multiple):

- `monitoring_network` — tautulli, grafana, telegraf, watchtower, portainer
- `media_network` — seerr, radarr, sonarr, prowlarr, bazarr
- `download_network` — transmission, watchlistarr, cleanarr, requestrr, radarr, sonarr
- `tracearr-network` — tracearr, timescale (PostgreSQL), redis
- **host network** — plex only (required for proper streaming/discovery)

Radarr and Sonarr are deliberately on both `media_network` (so Seerr, Prowlarr, and Bazarr can reach them) and `download_network` (so Watchlistarr/Transmission can reach them). Prowlarr and Bazarr only need `media_network` because their only inbound/outbound peers are the *arr APIs.

**Portainer mounts the Docker socket.** `portainer/portainer-ce` binds `/var/run/docker.sock` read-write, which is root-equivalent access to the host. If a user reports security concerns, this is the relevant exposure — flag it before recommending Portainer-based workflows.

**Tracearr is the only "app" in the stack.** Everything else is a single off-the-shelf container. Tracearr is a three-container subsystem (app + TimescaleDB + Redis) with healthcheck-gated `depends_on`, and it is the only service whose env vars use the `${VAR:?must be set}` fail-fast form — `DB_PASSWORD`, `JWT_SECRET`, and `COOKIE_SECRET` are required or the stack will refuse to start. Its external port is `3001` mapped to internal `3000` because Grafana already owns `3000` on the host.

**Volume paths are intentionally user-specific.** All bind mounts are rooted at `${USERDIR}` from `.env`. When advising the user, do not assume any particular host path layout — the README explicitly tells them to update paths to match their drive mounts.

**Prometheus config is orphaned.** `prometheus/prometheus.yml` exists and references `telegraf:9273` and `tautulli:8181` as scrape targets, but there is no `prometheus` service in `docker-compose.yml`. Treat it as a stub for users who want to add Prometheus themselves — don't assume metrics are being scraped today.

**Transmission VPN is aspirational.** The README claims VPN support and `.env.example` has `OPENVPN_*` variables, but the active image is plain `linuxserver/transmission` with no VPN sidecar or `haugene/transmission-openvpn` config. If the user wants real VPN tunneling, that's a change, not a fix.

**Plex claim tokens expire in ~4 minutes.** `PLEX_CLAIM` must be set in `.env` immediately before `docker compose up -d` on first run. If the user reports a Plex auth issue on first boot, this is almost always why.

## Kometa (plex-meta-manager) layout

The mounted config directory is `plex-meta-manager/config/`. Its structure is referenced explicitly by `config.yml`:

- `config.yml` — top-level Kometa config (Plex/TMDb/Tautulli/Trakt/OMDb/MDBList credentials via `${PMM_*}` env vars; library mappings for `Movies` and `TV Shows`)
- `Movies/Movies.yml`, `Movies/Overlays.yml` — collection and overlay definitions for the Movies library (Movies.yml is ~1200 lines)
- `TV Shows/TV Shows.yml`, `TV Shows/Overlays.yml` — same for TV
- `Playlists.yml` — top-level playlist definitions

`config.yml` loads both the named files *and* `folder: config/Movies/` / `config/TV Shows/`, so any new `.yml` dropped in those folders is auto-picked-up. Note the literal space in the `TV Shows` path — quote it in shell commands.

## Env var contract

`.env.example` is the source of truth for what `.env` needs. The values fall into three categories:

1. **Hard-required** (stack won't start): `DB_PASSWORD`, `JWT_SECRET`, `COOKIE_SECRET` (all Tracearr).
2. **Effectively required for the feature to work**: `PUID`/`PGID`/`TZ`/`USERDIR` (everything), `PLEX_CLAIM` (first-boot only), `PMM_*` (Kometa).
3. **Documented but unused by the current compose file**: `OPENVPN_*`, `DOCKER_INFLUXDB_*`, `RADARR_*`, `SONARR_*`, `EMAIL`/`PASSWORD`/`HTTP_*`/`DOMAIN*`. These exist for the "not included but recommended" services in the README or aspirational features — don't add validation for them and don't assume the user has them set.
