# AutoPlexx - Fully Automated Plex Media Server Setup
<br>
<div align="center">
    <img src="https://github.com/joshdev8/AutoPlexx/assets/19192998/b367872b-1d48-40cf-b2f5-1aac30a10512" />
</div>
<br>
<br>

This setup utilizes [Docker](https://www.docker.com/) and [docker-compose](https://docs.linuxserver.io/general/docker-compose) to create an automated environment for Plex Media Server with several supportive services. These instructions assume you already have both of those setup.

## Getting Started

1. Copy the `.env.example` to `.env` and update all of the values according to your setup. Notes regarding each variable are commented next the the variable name.
   
2. Replace the volumes in the `docker-compose.yml` file with the correct paths to your hard drive mount points.

3. **Run the Docker Compose command**:

    ```
    docker-compose -f ~/docker/docker-compose.yml up -d
    ```

    Replace `~/docker/docker-compose.yml` with the path to your `docker-compose.yml` file.

*If you run into any issues with a specific container, copy the container name and google it for container-specific configuration FAQ's. If there is an issue with my configuration or instructions please let me know and I will update them.*

<a href="https://www.buymeacoffee.com/joshdev8" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/default-orange.png" alt="Buy Me A Coffee" height="41" width="174"></a>

## Components

### Media Server

- **Plex Media Server:** Central media server.
- **Kometa:** Automates metadata curation of Plex content. Gives you granular control over metadata, collections, overlays, and much more.
- **Cleanarr:** Finds all duplicate content on your server and intelligently selects which copy/copies to remove.

### Content Downloaders

- **Radarr:** For movies.
- **Sonarr:** For TV shows.
- **Lidarr:** For music.
- **Bazarr:** For subtitles.
- **Transmission-VPN:** Torrent downloader with built-in VPN.
- **Jackett:** Connects content downloaders to content sites.
- **Prowlarr:** Maps content sites to Radarr + Sonarr (alternative to Jackett, easier to setup, can use both at the same time).
- **Requestrr:** Enables content requests via Discord bot.

### Docker Environment Management

- **Portainer:** Container management.
- **Watchtower:** Automated container updates.
- **Overseer:** Centralized content request and management interface.

### Monitoring

- **Tautulli:** Monitors Plex Media Server usage.
- **Netdata:** Live host monitoring (CPU, memory, etc.).
- **Telegraf + Prometheus + InfluxDB:** Data aggregators feeding into Grafana.
- **Grafana:** Visualizes metrics from Telegraf, Prometheus, and InfluxDB.
