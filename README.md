# AutoPlexx - Fully Automated Plex Media Server Setup
<br>
<div align="center">
    <img src="https://github.com/joshdev8/AutoPlexx/assets/19192998/b367872b-1d48-40cf-b2f5-1aac30a10512" />
</div>
<br>
<br>

A fully automated [Plex Media Server](https://www.plex.tv/) ecosystem using [Docker](https://www.docker.com/) and [Docker Compose](https://docs.docker.com/compose/).

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/) (v2+)
- A Plex account and [claim token](https://www.plex.tv/claim)
- A VPN provider account (for Transmission)

## Getting Started

1. Clone the repository:

    ```bash
    git clone https://github.com/joshdev8/AutoPlexx.git
    cd AutoPlexx
    ```

2. Copy `.env.example` to `.env` and fill in your values:

    ```bash
    cp .env.example .env
    ```

    > **Note:** Tracearr requires `DB_PASSWORD`, `JWT_SECRET`, and `COOKIE_SECRET` to be set or it will fail to start.

3. Update the volume paths in `docker-compose.yml` to match your hard drive mount points.

4. Start all services:

    ```bash
    docker compose up -d
    ```

## Services

### Media Server

| Service | Description | Port |
|---------|-------------|------|
| [Plex](https://www.plex.tv/) | Central media server | `32400` (host network) |
| [Kometa](https://kometa.wiki/) | Automates metadata curation, collections, and overlays | N/A (scheduled task) |

### Content Management

| Service | Description | Port |
|---------|-------------|------|
| [Seerr](https://github.com/seerr-team/seerr) | Content request and management interface | `5055` |
| [Watchlistarr](https://github.com/nylonee/watchlistarr) | Syncs Plex watchlist to Radarr/Sonarr | N/A |
| [Cleanarr](https://github.com/se1exin/Cleanarr) | Finds and removes duplicate content | N/A |
| [Requestrr](https://github.com/darkalfx/requestrr) | Discord bot for content requests | `4545` |

### Downloading

| Service | Description | Port |
|---------|-------------|------|
| [Transmission](https://transmissionbt.com/) | Torrent client with VPN support | `9091` |

### Monitoring

| Service | Description | Port |
|---------|-------------|------|
| [Tautulli](https://tautulli.com/) | Plex usage monitoring | `8181` |
| [Grafana](https://grafana.com/) | Metrics visualization | `3000` |
| [Telegraf](https://www.influxdata.com/time-series-platform/telegraf/) | Metrics collection agent | N/A |
| [Tracearr](https://github.com/connorgallopo/tracearr) | Stream tracking and account sharing detection | `3001` |

### Infrastructure

| Service | Description | Port |
|---------|-------------|------|
| [Watchtower](https://containrrr.dev/watchtower/) | Automated container updates | N/A |
| [TimescaleDB](https://www.timescale.com/) | Time-series database (used by Tracearr) | N/A (internal) |
| [Redis](https://redis.io/) | Cache/queue (used by Tracearr) | N/A (internal) |

### Not included but recommended

These services pair well with this stack but are not included in the default `docker-compose.yml`. See their respective docs to add them:

- **[Radarr](https://radarr.video/)** - Movie management and downloading
- **[Sonarr](https://sonarr.tv/)** - TV show management and downloading
- **[Lidarr](https://lidarr.audio/)** - Music management and downloading
- **[Bazarr](https://www.bazarr.media/)** - Subtitle management
- **[Prowlarr](https://prowlarr.com/)** - Indexer management for Radarr/Sonarr
- **[Jackett](https://github.com/Jackett/Jackett)** - Torrent indexer aggregator
- **[Portainer](https://www.portainer.io/)** - Docker management UI

## Network Architecture

Services are isolated into separate Docker networks:

- **`monitoring_network`** - Tautulli, Grafana, Telegraf, Watchtower
- **`media_network`** - Seerr
- **`download_network`** - Transmission, Watchlistarr, Cleanarr, Requestrr
- **`tracearr-network`** - Tracearr, TimescaleDB, Redis

Plex runs in host network mode for optimal streaming performance.

## Kometa Configuration

The `plex-meta-manager/config/` directory contains Kometa configurations for automated collection and overlay management:

- **Movies** - IMDb Top 250, TMDb trending, Trakt lists, Oscar categories, genre collections, streaming service collections, holiday collections, and more
- **TV Shows** - Popular/trending, streaming networks, genres, studios (Marvel, DC), year-based collections
- **Playlists** - Daily rotating playlists by genre (Action, Comedy, Animated, Family)
- **Overlays** - Resolution badges (4K, 1080p, 720p), HDR/Dolby Vision, IMDb Top 250, streaming service badges, show status (Airing/Ended/Canceled)

<a href="https://www.buymeacoffee.com/joshdev8" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/default-orange.png" alt="Buy Me A Coffee" height="41" width="174"></a>
