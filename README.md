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
- Requestrr - Add ability for users to request content via Discord bot

### Docker Environment Management

- Portainer - container management
- Watchtower - automated container updates
- Overseer - content request and centralized management interface

### Monitoring

- Tautulli - Monitoring and statistics of Plex Media Server usage
- Netdata - Live host monitoring (CPU, memory etc.)
- Telegraf + Prometheus + InfluxDB - Host data aggregators that feed data into Grafana
- Grafana - Visualizer and dashboard for metrics passed in from Telegraf, Prometheus, and InfluxDB

### Getting Started
Create a .env file at the root of the repo, and add the following values

- TZ=America/New_York [more options](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones#List)

- PUID=1000 [HERE](https://docs.linuxserver.io/general/understanding-puid-and-pgid)
- PGID=1000

- HOSTNAME Sets the hostname inside the docker container. For example -h PlexServer will set the servername to PlexServer. Not needed in Host Networking.
TZ Set the timezone inside the container. For example: Europe/London. The complete list can be found here: https://en.wikipedia.org/wiki/List_of_tz_database_time_zones

- PLEX_CLAIM The claim token for the server to obtain a real server token. If not provided, server will not be automatically logged in. If server is already logged in, this parameter is ignored. You can obtain a claim token to login your server to your plex account by visiting https://www.plex.tv/claim

- ADVERTISE_IP This variable defines the additional IPs on which the server may be found. For example: http://10.1.1.23:32400. This adds to the list where the server advertises that it can be found. This is only needed in Bridge Networking.

- USERDIR=path to your home directory, or wherever you want

Info on how to find the following open vpn values [HERE](https://haugene.github.io/docker-transmission-openvpn/config-options/)
- OPENVPN_PROVIDER
- OPENVPN_USERNAME
- OPENVPN_PASSWORD
- OPENVPN_CONFIG

- TRANSMISSION_USERNAME=username you want to set to log into transmission container frontend
- TRANSMISSION_RPC_PASSWORD=password to log into the frontend
