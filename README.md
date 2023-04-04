# PLEX MEDIA SERVER STACK

## utilizes [Docker](https://www.docker.com/) and [docker-compose](https://docs.linuxserver.io/general/docker-compose) to setup several services for an automated plex environment.

*Once all env variables are set, run `docker-compose -f ~/docker/docker-compose.yml up -d` swapping out ~/docker/docker-compose.yml with wherever your docker-compose.yml file is located*

### Media Server

- Plex Media Server
- Plex Meta Manager - Automated metadata curation of plex content

### Content Downloaders

- Radarr - movies
- Sonarr - tv shows
- Lidarr - music
- Bazarr - subtitles
- Transmission-VPN - torrent downloader with VPN built in
- Jackett - Connects Radarr/Sonarr/Lidarr to content sites
- Prowlarr - Maps content sites to jackett to be connected to Radarr/Sonarr/Lidarr

### Docker Environment Management

- Portainer - container management
- Watchtower - automated container updates
- Overseer - content request and centralized management interface

### Monitoring

- Tautulli - Monitoring and statistics of Plex Media Server usage
- Netdata - Live host monitoring (CPU, memory etc.)
- Telegraf + Prometheus + InfluxDB - Host data aggregators that feed data into Grafana
- Grafana - Visualizer and dashboard for metrics passed in from Telegraf, Prometheus, and InfluxDB
