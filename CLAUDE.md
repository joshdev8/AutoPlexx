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

- `monitoring_network` — tautulli, grafana, telegraf, watchtower, portainer, prometheus, cadvisor, node-exporter
- `media_network` — seerr, radarr, sonarr, prowlarr, bazarr, flaresolverr, maintainerr, checkrr
- `download_network` — transmission, watchlistarr, cleanarr, requestrr, decluttarr, radarr, sonarr
- `tracearr-network` — tracearr, timescale (PostgreSQL), redis
- **host network** — plex only (required for proper streaming/discovery)

Radarr and Sonarr are deliberately on both `media_network` (so Seerr, Prowlarr, and Bazarr can reach them) and `download_network` (so Watchlistarr/Transmission can reach them). Prowlarr and Bazarr only need `media_network` because their only inbound/outbound peers are the *arr APIs.

**Portainer mounts the Docker socket.** `portainer/portainer-ce` binds `/var/run/docker.sock` read-write, which is root-equivalent access to the host. If a user reports security concerns, this is the relevant exposure — flag it before recommending Portainer-based workflows.

**Tracearr is the only "app" in the stack.** Everything else is a single off-the-shelf container. Tracearr is a three-container subsystem (app + TimescaleDB + Redis) with healthcheck-gated `depends_on`, and it is the only service whose env vars use the `${VAR:?must be set}` fail-fast form — `DB_PASSWORD`, `JWT_SECRET`, and `COOKIE_SECRET` are required or the stack will refuse to start. Its external port is `3001` mapped to internal `3000` because Grafana already owns `3000` on the host.

**Volume paths are intentionally user-specific.** All bind mounts are rooted at `${USERDIR}` from `.env`. When advising the user, do not assume any particular host path layout — the README explicitly tells them to update paths to match their drive mounts.

**Prometheus is live, but only cAdvisor + node-exporter feed it.** `prometheus/prometheus.yml` is mounted into the prometheus container; only the `cadvisor` and `node_exporter` scrape jobs are active. The `telegraf` and `tautulli` jobs are commented out because those containers don't expose a `/metrics` endpoint by default — telegraf would need the `prometheus_client` output plugin enabled, and Tautulli needs a metrics plugin installed. Grafana points at Prometheus the same way it would point at any data source — configure it in the Grafana UI after first boot.

**cAdvisor needs `privileged: true` and several host-fs mounts.** This is the standard cAdvisor pattern; flag it if a user reports security concerns about the monitoring stack. It also binds host port `8080` — if a user has something else on `8080`, that's the conflict.

**Transmission uses `haugene/transmission-openvpn` and won't start without VPN credentials.** The container runs an OpenVPN client internally; `OPENVPN_PROVIDER`, `OPENVPN_CONFIG`, `OPENVPN_USERNAME`, and `OPENVPN_PASSWORD` must all be set in `.env`. The compose service declares `cap_add: NET_ADMIN` and `devices: /dev/net/tun` for the OpenVPN client; the data volume is `/data` (haugene's convention), not `/config` like the linuxserver image. `LOCAL_NETWORK` (CIDR, default `192.168.0.0/16`) controls which destinations bypass the tunnel — if a user reports the web UI is unreachable, this is almost always the cause.

**Plex claim tokens expire in ~4 minutes.** `PLEX_CLAIM` must be set in `.env` immediately before `docker compose up -d` on first run. If the user reports a Plex auth issue on first boot, this is almost always why.

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
