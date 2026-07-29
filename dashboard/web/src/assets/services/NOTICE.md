# Service logos

The `.svg` files in this directory are third-party logos, vendored so the
dashboard renders correctly on a stack with no outbound internet — the same
reason Inter and the Phosphor icons are self-hosted rather than pulled from a
CDN.

## Source

All files come from [homarr-labs/dashboard-icons](https://github.com/homarr-labs/dashboard-icons),
which is distributed under the **Apache License 2.0**.

Retrieved 2026-07-29 from `https://raw.githubusercontent.com/homarr-labs/dashboard-icons/main/svg/<name>.svg`.

## Trademarks

Apache 2.0 covers the collection, not the marks themselves. Each logo remains
the trademark of its respective project or owner, and is reproduced here only to
identify that software within this dashboard — nominative use. No affiliation
with or endorsement by any of these projects is implied.

If you own one of these marks and would prefer it not be distributed here, open
an issue and it will be removed; the file simply falls back to a monogram tile.

## Files

Each file is named for its AutoPlexx service id (see `server/src/services.ts`),
which is how `ServiceIcon` finds it. Where the id differs from the upstream
icon name, the upstream name is given below.

| File | Upstream icon |
| --- | --- |
| `bazarr.svg` | `bazarr` |
| `docker-socket-proxy.svg` | `docker` |
| `flaresolverr.svg` | `flaresolverr` |
| `grafana.svg` | `grafana` |
| `maintainerr.svg` | `maintainerr` |
| `plex.svg` | `plex` |
| `portainer.svg` | `portainer` |
| `prometheus.svg` | `prometheus` |
| `prowlarr.svg` | `prowlarr` |
| `radarr.svg` | `radarr` |
| `redis.svg` | `redis` |
| `requestrr.svg` | `requestrr` |
| `seerr.svg` | `seerr` |
| `sonarr.svg` | `sonarr` |
| `tautulli.svg` | `tautulli` |
| `telegraf.svg` | `telegraf` |
| `timescale.svg` | `postgresql` |
| `tracearr.svg` | `tracearr` |
| `transmission.svg` | `transmission` |
| `watchtower.svg` | `watchtower` |

## Not covered

The icon set has no entry for `checkrr`, `watchlistarr`, `decluttarr`,
`cleanarr`, `cadvisor`, `node-exporter`, or `dashboard`. Those render as
monogram tiles, which is the designed fallback rather than a gap to fill —
adding `<service id>.svg` here is all that is needed if one appears upstream.
