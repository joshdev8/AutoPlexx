# Contributing to AutoPlexx

Thanks for your interest in improving AutoPlexx. This repo is a Docker Compose stack — there's no application source code, build step, or test suite. Most contributions edit `docker-compose.yml`, the `.env.example` contract, the Kometa config under `plex-meta-manager/config/`, or the README.

## Before you open a PR

1. **Validate the compose file.** This catches YAML typos and env interpolation errors before anything boots:

    ```bash
    docker compose config
    ```

2. **Try the change locally.** For service edits, bring the affected service up with `docker compose up -d <service>` and tail its logs:

    ```bash
    docker compose logs -f <service>
    ```

3. **Don't commit secrets.** `.env` is gitignored — only `.env.example` (placeholder values) belongs in the repo. The Tracearr-required `DB_PASSWORD`, `JWT_SECRET`, and `COOKIE_SECRET` must never appear in commits.

## Branching and commits

Recent history follows a `type/short-description` pattern:

- `feat/` — new service or capability
- `fix/` — bug fix in an existing service or config
- `docs/` — README, CLAUDE.md, or other documentation
- `chore/` — repo hygiene, CI, config files
- `cleanup/` — removing dead files or unused config

Keep commit subjects in the imperative ("Add Radarr to compose", not "Added Radarr"). Use the commit body for the *why* when it isn't obvious from the diff.

## What makes a good PR

- **One concern per PR.** A README rewrite and a new service should be separate PRs unless the docs explicitly cover the service being added.
- **Update the relevant docs.** New service? Add it to the README's service table and the network architecture section. New env var? Add it to `.env.example` with a placeholder and a comment explaining what it does.
- **Network membership is deliberate.** Services on a different bridge network cannot reach each other. When adding a service, pick the right network(s) — see [CLAUDE.md](CLAUDE.md) for the current layout.
- **Fill in the PR template.** It exists so reviewers don't have to ask the same questions every time.

## Questions vs. issues

- **"How do I…"** or "should we consider…" → [Discussions](https://github.com/joshdev8/AutoPlexx/discussions)
- **"This is broken"** → [Bug report](https://github.com/joshdev8/AutoPlexx/issues/new?template=bug_report.yml)
- **"Add this service / change this convention"** → [Feature request](https://github.com/joshdev8/AutoPlexx/issues/new?template=feature_request.yml)

## Code of Conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md). By participating, you agree to abide by its terms.
