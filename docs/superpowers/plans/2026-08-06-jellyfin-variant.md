# Jellyfin Variant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Offer Jellyfin as a commented-out, drop-in alternative to Plex, with the dashboard catalog aware of it and the docs honest about which companions are Plex-only.

**Architecture:** Add a fully-formed but commented `jellyfin:` service under `plex:` in `docker-compose.yml`; the user swaps by commenting Plex and uncommenting Jellyfin. Add a matching entry to the dashboard's static service catalog so the panel self-heals when enabled. Document the swap and its caveats in the README, `.env.example`, and `CLAUDE.md`.

**Tech Stack:** Docker Compose, linuxserver/jellyfin image, TypeScript (Fastify BFF service catalog), Markdown docs.

## Global Constraints

- **Never remove the `image:` line** from the dashboard service in favour of `build:` alone (public repo must pull, not build on first `up`).
- **`docker compose config` fails on `.env.example` blanks** for `${VAR:?...}` vars — validate against a throwaway copy of `.env.example` passed with `--env-file`, filling `DB_PASSWORD`, `JWT_SECRET`, `COOKIE_SECRET`, `OPENVPN_PROVIDER`, `OPENVPN_CONFIG`, `OPENVPN_USERNAME`, `OPENVPN_PASSWORD`, as `.github/workflows/compose-validate.yml` does. **Never write to the repo's own `.env`** — it holds the contributor's real credentials.
- **A dashboard `container` field must equal `container_name` in compose exactly**, or health lookups silently report `absent`.
- **No new env var** — `.env.example` stays as it is. Vars there are consumed by compose, with the documented exception of `RADARR_API_KEY` / `SONARR_API_KEY`, which Decluttarr's user fills in after first boot; that exception is not a licence to add more. A var used only by a commented-out service would be a third kind, so Jellyfin gets a comment, not a new var.
- **Jellyfin has no claim token** — do not add a `PLEX_CLAIM` analogue.
- **Self-hosted media stacks may have no outbound internet** — do not introduce CDN/remote asset dependencies.

---

### Task 1: Commented-out Jellyfin service in docker-compose.yml

**Files:**
- Modify: `docker-compose.yml` (insert between the `plex:` service end at line 17 and the `# ============ MONITORING ============` header at line 19)

**Interfaces:**
- Consumes: existing `${PUID}`, `${PGID}`, `${TZ}`, `${USERDIR}` env vars.
- Produces: a container named `jellyfin` (relied on by Task 2's catalog entry) on host port `8096`.

- [ ] **Step 1: Insert the commented Jellyfin block**

Insert the following immediately after the `plex:` service's `restart: unless-stopped` line (line 17), before the blank line and the `# ============ MONITORING ============` header:

```yaml

  # ---- Optional: Jellyfin (Plex alternative) ----
  # Jellyfin is a free, fully open-source media server with no paid tier. To use
  # it INSTEAD of Plex: run `docker compose rm -sf plex` FIRST, then comment out
  # the entire `plex:` service above, uncomment the `jellyfin:` service below,
  # and run `docker compose up -d`. Removing Plex first matters: a commented-out
  # service is invisible to compose, so `up -d` would leave the old container
  # running and you'd have both media servers on the same library.
  # Jellyfin's web UI is on http://<host>:8096 and needs no claim token.
  # Heads up: Tautulli, Watchlistarr, Kometa, and Maintainerr are Plex-only and
  # will NOT work against Jellyfin — see the README "Using Jellyfin instead of
  # Plex" section for the full compatibility list.
  # jellyfin:
  #   container_name: jellyfin
  #   image: linuxserver/jellyfin
  #   network_mode: "host"
  #   environment:
  #     - PUID=${PUID}
  #     - PGID=${PGID}
  #     - TZ=${TZ}
  #   volumes:
  #     - ${USERDIR}/jellyfin/config:/config
  #     - ${USERDIR}/plex/media:/media
  #   restart: unless-stopped
```

- [ ] **Step 2: Verify both the default (Plex) file and the enabled Jellyfin block validate**

One block, because the throwaway env file and the scratch copy have to outlive each
other. Everything lands in a `mktemp -d` directory removed by a trap, so the repo's
`docker-compose.yml` and — importantly — the contributor's real `.env` are never touched:

```bash
SCRATCH="$(mktemp -d)"
trap 'rm -rf "$SCRATCH"' EXIT

# A throwaway env file, never the repo's own .env.
cp .env.example "$SCRATCH/env"
{
  echo "DB_PASSWORD=ci-validation"
  echo "JWT_SECRET=ci-validation"
  echo "COOKIE_SECRET=ci-validation"
  echo "OPENVPN_PROVIDER=ci-validation"
  echo "OPENVPN_CONFIG=ci-validation"
  echo "OPENVPN_USERNAME=ci-validation"
  echo "OPENVPN_PASSWORD=ci-validation"
} >> "$SCRATCH/env"

docker compose --env-file "$SCRATCH/env" config --quiet && echo "DEFAULT OK"

# Prove the block parses when a user uncomments it, on a scratch copy.
cp docker-compose.yml "$SCRATCH/docker-compose.jellyfin.yml"
# Uncomment ONLY the jellyfin service lines (the `#   ` / `# jellyfin:` forms),
# leaving the `# ----`/prose comment lines alone.
sed -i -E 's/^  # (jellyfin:)/  \1/; s/^  #   (.*)$/    \1/' "$SCRATCH/docker-compose.jellyfin.yml"
docker compose -f "$SCRATCH/docker-compose.jellyfin.yml" --env-file "$SCRATCH/env" config --quiet \
  && echo "JELLYFIN BLOCK OK"
```
Expected: prints `DEFAULT OK` (the commented Jellyfin block is invisible to the parser; Plex is unchanged) then `JELLYFIN BLOCK OK`. If the second fails, the indentation in the commented block is wrong — fix Step 1 and re-run.
(Everything lives outside the repo, so there is nothing to clean up for git.)

- [ ] **Step 3: Commit**

```bash
git add docker-compose.yml
git commit -m "feat: add Jellyfin as a commented-out Plex alternative (#56)"
```

---

### Task 2: Jellyfin entry in the dashboard service catalog

**Files:**
- Modify: `dashboard/server/src/services.ts` (MEDIA section, after the `plex` entry at lines 43-52)

**Interfaces:**
- Consumes: the `jellyfin` container name produced by Task 1; the existing `ServiceDef` shape and `Hue` / `ServiceGroup` types.
- Produces: a `SERVICES` entry with `id: 'jellyfin'`, `container: 'jellyfin'`, `port: 8096`.

- [ ] **Step 1: Add the Jellyfin catalog entry**

In `dashboard/server/src/services.ts`, immediately after the closing `},` of the `plex` entry (line 52) and before the `seerr` entry, insert:

```ts
  {
    id: 'jellyfin',
    name: 'Jellyfin',
    mono: 'JF',
    container: 'jellyfin',
    group: 'media',
    hue: 'violet',
    port: 8096,
    blurb: 'Alternative media server',
  },
```

- [ ] **Step 2: Run the full dashboard verification**

```bash
cd dashboard
npm ci && npm run typecheck && npm run lint && npm test && npm run build
```
Expected: all four stages pass. The new entry is plain data conforming to `ServiceDef`, so typecheck/lint should be clean and existing tests unaffected.

- [ ] **Step 3: Commit**

```bash
cd ..
git add dashboard/server/src/services.ts
git commit -m "feat(dashboard): add Jellyfin to the service catalog (#56)"
```

---

### Task 3: Documentation — README, .env.example, CLAUDE.md

**Files:**
- Modify: `README.md` (Media Server table at lines 132-138)
- Modify: `.env.example` (Plex section at lines 14-17)
- Modify: `CLAUDE.md` (media-server architecture notes)

**Interfaces:**
- Consumes: the swap mechanism and container from Task 1.
- Produces: user-facing docs; no code interface.

- [ ] **Step 1: Add the README "Using Jellyfin instead of Plex" subsection**

In `README.md`, after the Kometa paragraph at line 138 (and before `### Content Management` at line 140), insert:

```markdown

<details>
<summary><strong>Using Jellyfin instead of Plex</strong></summary>

Plex has moved features behind Plex Pass over time. If you'd rather run
[Jellyfin](https://jellyfin.org/) — free and fully open-source, no paid tier — the
stack ships a ready-to-use Jellyfin service, commented out in `docker-compose.yml`.

To switch:

1. In `docker-compose.yml`, comment out the entire `plex:` service.
2. Uncomment the `jellyfin:` service directly below it.
3. `docker compose up -d`. Jellyfin's web UI is at `http://<host>:8096` — no claim token needed.

**What still works, and what doesn't.** Jellyfin serves the same media library, but
several companions in this stack talk to Plex's API specifically:

| Works with Jellyfin as-is | Plex-only (won't work against Jellyfin) |
|---------------------------|------------------------------------------|
| Radarr, Sonarr, Prowlarr, Bazarr | Tautulli (Plex analytics) |
| Transmission | Watchlistarr (syncs the *Plex* watchlist) |
| Seerr (supports a Jellyfin backend) | Kometa / Plex Meta Manager |
| | Maintainerr |

Because the dashboard's now-playing and poster panels read through Tautulli, those
panels are Plex-bound too. Jellyfin-native replacements (e.g. Jellystat) are a possible
future addition but aren't wired up here yet.

</details>
```

- [ ] **Step 2: Add the Jellyfin pointer to .env.example**

In `.env.example`, replace the Plex section header comment (line 14, `# ============ Plex ============`) block so it notes the Jellyfin alternative without adding a variable. Change:

```dotenv
# ============ Plex ============
# Obtain immediately before `docker compose up -d`. Claim tokens expire in
# roughly 4 minutes. See https://www.plex.tv/claim
PLEX_CLAIM=
```

to:

```dotenv
# ============ Plex ============
# Obtain immediately before `docker compose up -d`. Claim tokens expire in
# roughly 4 minutes. See https://www.plex.tv/claim
# Prefer Jellyfin? It needs no token — see the commented `jellyfin:` service in
# docker-compose.yml and "Using Jellyfin instead of Plex" in the README.
PLEX_CLAIM=
```

- [ ] **Step 3: Add the CLAUDE.md note**

In `CLAUDE.md`, under the "Architecture notes that aren't obvious from a glance" area near the Plex/media discussion, add a new bolded note paragraph:

```markdown
**Jellyfin is an optional, commented-out swap for Plex.** `docker-compose.yml` carries a
fully-formed but commented `jellyfin:` service (host network, port `8096`, no claim
token) directly under `plex:`; the intended workflow is to comment out one and uncomment
the other, per issue #56. The dashboard catalog (`services.ts`) already lists Jellyfin so
its panel self-heals when enabled. Tautulli, Watchlistarr, Kometa, and Maintainerr are
Plex-API-specific and do NOT work against Jellyfin — and since the dashboard's now-playing
and poster panels read through Tautulli, those are Plex-bound too. Wiring Jellyfin-native
companions is deliberately left as a follow-up.
```

- [ ] **Step 4: Verify docs render / no broken structure**

```bash
grep -n "Using Jellyfin instead of Plex" README.md
grep -n "jellyfin:" CLAUDE.md
grep -n "Prefer Jellyfin" .env.example
```
Expected: each grep returns a match, confirming the three edits landed.

- [ ] **Step 5: Commit**

```bash
git add README.md .env.example CLAUDE.md
git commit -m "docs: document Jellyfin-instead-of-Plex swap and caveats (#56)"
```

---

### Task 4: Open the pull request

**Files:** none (git/gh only).

- [ ] **Step 1: Push the branch**

```bash
git push -u origin feat/jellyfin-variant
```

- [ ] **Step 2: Open the PR closing issue #56**

```bash
gh pr create --base main --head feat/jellyfin-variant \
  --title "Add Jellyfin as a commented-out Plex alternative" \
  --body "$(cat <<'EOF'
Closes #56.

Adds Jellyfin as a drop-in, opt-in alternative to Plex without changing the default
experience.

## What's in here
- **docker-compose.yml** — a fully-formed but commented `jellyfin:` service under `plex:`
  (linuxserver/jellyfin, host network, `:8096`, no claim token). Swap by commenting Plex
  and uncommenting Jellyfin.
- **dashboard** — a Jellyfin entry in the service catalog so its panel self-heals the
  moment the service is enabled; renders `absent` for Plex users.
- **docs** — README "Using Jellyfin instead of Plex" section with an honest
  works/doesn't-work table, a `.env.example` pointer, and a `CLAUDE.md` note.

## Explicitly out of scope
Wiring Jellyfin-native companions (Jellystat, Seerr backend reconfig). Tautulli,
Watchlistarr, Kometa, and Maintainerr remain Plex-only; the README says so.

## Verification
- `docker compose config --quiet` passes on the default file, and on a scratch copy with
  the Jellyfin block uncommented.
- `npm ci && npm run typecheck && npm run lint && npm test && npm run build` pass in `dashboard/`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review

**Spec coverage:**
- Spec §1 (commented compose service) → Task 1. ✓
- Spec §2 (.env.example comment, no new var) → Task 3 Step 2. ✓
- Spec §3 (dashboard catalog entry) → Task 2. ✓
- Spec §4 (README section + caveats table) → Task 3 Step 1. ✓
- Spec §5 (CLAUDE.md note) → Task 3 Step 3. ✓
- Spec verification (compose config both ways + dashboard build) → Task 1 Steps 2-3, Task 2 Step 2. ✓
- Spec branch/PR (closes #56) → Task 4. ✓

**Placeholder scan:** No TBD/TODO/"handle edge cases"; every code/edit step carries literal content. ✓

**Type consistency:** The catalog entry uses only existing `ServiceDef` fields with valid `Hue` (`'violet'`) and `ServiceGroup` (`'media'`) values; `container: 'jellyfin'` matches the `container_name: jellyfin` produced in Task 1. ✓
