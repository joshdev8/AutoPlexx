# Security Policy

## Reporting a Vulnerability

If you discover a security issue in AutoPlexx — for example, a default configuration that leaks credentials, an insecure port exposure in `docker-compose.yml`, or a secret accidentally committed to the repo — please report it privately rather than opening a public issue.

**Preferred:** use GitHub's [private vulnerability reporting](https://github.com/joshdev8/AutoPlexx/security/advisories/new). This keeps the report confidential until a fix is ready.

**Alternative:** email <joshcain8@gmail.com> with the subject line `AutoPlexx security`.

Please include:

- A description of the issue and where it lives (file path, service, line if applicable)
- Steps to reproduce, or a proof-of-concept config
- The version / commit of AutoPlexx you tested against
- Your assessment of impact (information disclosure, RCE, credential leak, etc.)

You'll get an acknowledgement within a few days. Fixes are issued on a best-effort basis — this is a hobbyist project, not a commercial product.

## Scope

AutoPlexx is a Docker Compose configuration that orchestrates third-party container images. In-scope issues are things that **this repo** controls:

- Insecure defaults in `docker-compose.yml` (exposed ports, missing isolation, weak auth defaults)
- Secrets or credentials committed to the repo
- Documentation that recommends an insecure setup
- The bundled Kometa, Telegraf, and Prometheus configs

Vulnerabilities in upstream images (Plex, Radarr, Sonarr, Transmission, Grafana, etc.) should be reported directly to those projects.

## Required secrets — handle with care

The Tracearr service requires three secrets that must be present in `.env` for the stack to start:

- `DB_PASSWORD`
- `JWT_SECRET`
- `COOKIE_SECRET`

These are never to be committed. `.env` is gitignored; only `.env.example` (placeholder values) belongs in the repo. If you accidentally commit a real secret, rotate it immediately — git history is hard to clean once pushed.
