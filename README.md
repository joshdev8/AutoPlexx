# AutoPlexx
<br>
<div align="center">
    <img src="https://github.com/joshdev8/AutoPlexx/assets/19192998/b367872b-1d48-40cf-b2f5-1aac30a10512" />
</div>
<br>
<br>

This setup utilizes [Docker](https://www.docker.com/) and [docker-compose](https://docs.linuxserver.io/general/docker-compose) to create an automated environment for Plex Media Server with several supportive services.

## Getting Started

1. **Create a .env file** at the root of the repository.
2. **Add the following values** to the .env file:

    ```
    TZ=America/New_York   # See more timezone options at https://en.wikipedia.org/wiki/List_of_tz_database_time_zones
    PUID=1000             # Find more about PUID/PGID at https://docs.linuxserver.io/general/understanding-puid-and-pgid
    PGID=1000
    HOSTNAME=             # Optional: Sets the hostname inside the Docker container.
    PLEX_CLAIM=           # Obtain from https://www.plex.tv/claim. Necessary for server token.
    ADVERTISE_IP=         # Example: http://10.1.1.23:32400. Needed in Bridge Networking.
    USERDIR=              # Path to your home directory or desired location.
    ```

    **OpenVPN Settings for Transmission-VPN:**
    ```
    OPENVPN_PROVIDER=
    OPENVPN_USERNAME=
    OPENVPN_PASSWORD=
    OPENVPN_CONFIG=
    TRANSMISSION_USERNAME=
    TRANSMISSION_RPC_PASSWORD=
    ```
    
3. Replace the volumes in the `docker-compose.yml` file with the correct paths to your hard drive mount points.

4. **Run the Docker Compose command**:

    ```
    docker-compose -f ~/docker/docker-compose.yml up -d
    ```

    Replace `~/docker/docker-compose.yml` with the path to your `docker-compose.yml` file.

## Components

### Media Server

- **Plex Media Server:** Central media server.
- **Plex Meta Manager:** Automates metadata curation of Plex content.

### Content Downloaders

- **Radarr:** For movies.
- **Sonarr:** For TV shows.
- **Lidarr:** For music.
- **Bazarr:** For subtitles.
- **Transmission-VPN:** Torrent downloader with built-in VPN.
- **Jackett:** Connects content downloaders to content sites.
- **Prowlarr:** Maps content sites to Jackett.
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
