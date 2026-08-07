# Jellyfin as a Plex alternative

**Issue:** #56 ("Jellyfin Variant")
**Date:** 2026-08-06
**Branch:** `feat/jellyfin-variant`

## Problem

Plex is steadily moving features behind Plex Pass and raising its price. Users want
the option to run Jellyfin instead. The issue author's request: offer both Plex and
Jellyfin as media servers, with the user commenting out the one they don't want.

## Approach

Add Jellyfin as a **commented-out swap** for Plex, not an always-on second server.
Plex stays the default; a user who wants Jellyfin removes the running Plex container
(`docker compose rm -sf plex`), then comments out `plex:` and uncomments `jellyfin:`.
The removal has to come first: compose only manages services it can still see, so a
commented-out `plex:` leaves its container running rather than tearing it down. This matches the issue author's mental model, introduces no new Compose
concepts, and avoids the `depends_on` cascade that Compose profiles would trigger
(only `tautulli` has `depends_on: plex`, but profiling `plex` would force `tautulli`
and every other Plex companion to be profiled too).

Scope is **swap the media server + document the caveats honestly**. The issue author
assumed "MOST of the services work with jellyfin"; in this stack that is only partly
true, and the README must say so rather than imply a clean drop-in.

### Companion compatibility (as it actually stands in this repo)

- **Plex-only** — will not work against Jellyfin without replacement/reconfig:
  Tautulli, Watchlistarr (syncs the *Plex* watchlist), Kometa / plex-meta-manager,
  Maintainerr. The dashboard's now-playing and poster panels read *through Tautulli*,
  so they are Plex-bound as well.
- **Media-server-agnostic** — work as-is: Radarr, Sonarr, Prowlarr, Bazarr,
  Transmission, and Seerr (`ghcr.io/seerr-team/seerr` supports a Jellyfin backend).

Wiring Jellyfin-native companions (Jellystat, Jellyseerr reconfiguration, etc.) is
**explicitly out of scope** for this PR and left as a follow-up, consistent with the
repo's preference for splitting PRs by concern.

## Changes

### 1. `docker-compose.yml` — commented-out `jellyfin:` service

Directly under the `plex:` block, add a header comment and a fully-formed but commented
service:

- `image: linuxserver/jellyfin`, `container_name: jellyfin`, `network_mode: "host"`
  (parity with Plex; host mode aids DLNA/discovery, UI on `:8096`).
- `environment: PUID / PGID / TZ` — **no claim token** (Jellyfin has none).
- `volumes: ${USERDIR}/jellyfin/config:/config` and `${USERDIR}/plex/media:/media`
  (the same media tree the *arrs write to, so libraries are shared with a Plex install
  or a prior Plex layout).
- `restart: unless-stopped`.
- Header comment states the swap plainly, including the `docker compose rm -sf plex`
  that has to precede it: comment out the `plex:` service above and uncomment
  everything below.

No new network entry (host mode). No named volume added — the existing `plex:` named
volume is itself vestigial (the service uses bind mounts), so that quirk is not mirrored.

### 2. `.env.example` — comment only, no new vars

Jellyfin needs nothing beyond the existing `PUID` / `PGID` / `TZ` / `USERDIR`. Add a
brief comment near the Plex vars pointing at the Jellyfin option. Deliberately introduce
**no new env var**. `.env.example` today holds vars compose consumes, plus one documented
exception — `RADARR_API_KEY` / `SONARR_API_KEY`, which the user fills in after first boot
because the *arr UIs don't exist until then. A var consumed only by a commented-out
service would be a third category with no such justification, so Jellyfin gets none.

### 3. Dashboard catalog — `dashboard/server/src/services.ts`

Add one entry to the MEDIA group:

```ts
{ id: 'jellyfin', name: 'Jellyfin', mono: 'JF', container: 'jellyfin',
  group: 'media', hue: 'violet', port: 8096, blurb: 'Alternative media server' }
```

`container: 'jellyfin'` matches the commented block's `container_name`, so the panel
turns healthy on its own the moment a user uncomments the service — no dashboard restart.
Until then it reports `absent`, which the health UI already handles. The user accepted
that Plex installs will show an idle Jellyfin tile.

### 4. `README.md` — "Using Jellyfin instead of Plex" section

The swap steps, plus an honest caveats table separating Plex-only companions from the
ones that work unchanged (per the compatibility list above). Note that Jellyfin has no
claim token and its web UI is on `:8096`.

### 5. `CLAUDE.md` — one note

A line under the media-server notes recording that Jellyfin is an optional commented
swap and which companions are Plex-bound, so this isn't rediscovered later.

## Verification

- Copy the compose file to a scratch location, uncomment the Jellyfin block (and comment
  Plex), and run `docker compose config` with placeholder env to prove the YAML is valid
  when enabled.
- Run `docker compose config` on the real file to confirm the default (Plex) path still
  validates.
- In `dashboard/`: `npm ci && npm run typecheck && npm run lint && npm test && npm run build`.

## Out of scope

- Jellyfin-native companion services (Jellystat, Jellyseerr, Seerr backend reconfig).
- Making any Plex-only companion work against Jellyfin.
- Data migration between Plex and Jellyfin.
