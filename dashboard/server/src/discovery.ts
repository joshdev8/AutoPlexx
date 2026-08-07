import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { memoize } from './cache.js';

/**
 * API key auto-discovery.
 *
 * AutoPlexx is a public repo people clone and run, so the dashboard must not
 * ask anyone to paste API keys. Every service it talks to already writes its
 * key to a file inside a config directory the stack bind-mounts; those
 * directories are mounted read-only at /discover/<service> and parsed here.
 *
 * Two properties this module has to hold:
 *
 *  - Resolution order is env var -> discovered file -> unconfigured. The env
 *    var survives as an override for anyone running a service outside this
 *    stack.
 *  - Discovery re-runs while the process is alive. On a clean install these
 *    files do not exist yet — each service writes one on its first boot — so a
 *    short TTL means integrations light up on their own without a restart.
 */

export type SourceId = 'sonarr' | 'radarr' | 'prowlarr' | 'bazarr' | 'tautulli' | 'seerr';

export type DiscoveryState =
  /** A key is available; the integration can be used. */
  | 'live'
  /** No key yet — the service probably hasn't written its config. Keep looking. */
  | 'waiting'
  /** A key exists but the service needs a change before the API will answer. */
  | 'blocked';

export interface Credential {
  source: SourceId;
  apiKey: string | null;
  state: DiscoveryState;
  /** Where the key came from, for the Setup panel. */
  origin: 'env' | 'discovered' | 'none';
  /** One concrete step the user can take, when something needs doing. */
  hint: string | null;
  /**
   * URL base, if the service is configured to serve under a sub-path. Empty for
   * a default install; the *arrs expose this as <UrlBase> in config.xml.
   */
  urlBase: string;
}

const DISCOVER_ROOT = process.env.DISCOVER_ROOT ?? '/discover';

/** Env override per source, checked before any file is read. */
const ENV_VAR: Record<SourceId, string> = {
  sonarr: 'SONARR_API_KEY',
  radarr: 'RADARR_API_KEY',
  prowlarr: 'PROWLARR_API_KEY',
  bazarr: 'BAZARR_API_KEY',
  tautulli: 'TAUTULLI_API_KEY',
  seerr: 'SEERR_API_KEY',
};

const WAITING_HINT: Record<SourceId, string> = {
  sonarr: 'Waiting for Sonarr to write its config. Start Sonarr and open it once.',
  radarr: 'Waiting for Radarr to write its config. Start Radarr and open it once.',
  prowlarr: 'Waiting for Prowlarr to write its config. Start Prowlarr and open it once.',
  bazarr: 'Waiting for Bazarr to write its config. Start Bazarr and open it once.',
  tautulli: 'Waiting for Tautulli to write its config. Start Tautulli and open it once.',
  seerr: 'Waiting for Seerr to write its config. Complete the Seerr setup wizard.',
};

async function readIfPresent(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf8');
  } catch {
    // Missing file is the normal pre-first-boot case, and an unreadable one
    // (wrong ownership, mount not declared) is equally non-fatal — the
    // integration simply stays unconfigured.
    return null;
  }
}

/**
 * Minimal extraction of a single element's text from the *arr `config.xml`.
 *
 * A real XML parser would be a dependency for one tag in a file this stack
 * writes itself; a scoped regex is proportionate. Deliberately anchored to the
 * exact tag so it can't match a substring of another element.
 */
function xmlTag(xml: string, tag: string): string | null {
  const match = new RegExp(`<${tag}>([^<]*)</${tag}>`, 'i').exec(xml);
  return match?.[1]?.trim() || null;
}

/**
 * Reads `key = value` from a named INI section.
 *
 * Line-based rather than a section-slicing regex: Tautulli reuses key names
 * across sections (`api_key` appears under both [General] and [PMS]), so the
 * section boundary has to be tracked exactly. Nested `[[subsections]]` are
 * treated as part of their parent, which is enough for the keys read here.
 */
function iniValue(ini: string, section: string, key: string): string | null {
  let current: string | null = null;

  for (const rawLine of ini.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || line.startsWith(';')) continue;

    // A top-level header, i.e. [General] but not [[subsection]].
    if (line.startsWith('[') && !line.startsWith('[[') && line.endsWith(']')) {
      current = line.slice(1, -1).trim();
      continue;
    }

    if (current !== section) continue;

    const separator = line.indexOf('=');
    if (separator === -1) continue;
    if (line.slice(0, separator).trim() !== key) continue;

    return line.slice(separator + 1).trim() || null;
  }

  return null;
}

/**
 * Reads `key: value` from a top-level YAML section, for Bazarr's config.yaml.
 *
 * Same reasoning as `iniValue`: a YAML dependency for two scalars out of a file
 * this stack writes itself isn't proportionate, and the section boundary has to
 * be exact. Bazarr stores an `apikey` under a dozen sections — including
 * `radarr:` and `sonarr:`, whose keys belong to those services — so a document-
 * wide search for the first `apikey` would eventually hand back someone else's
 * credential. Only two-level `section: / key: value` is understood, which is
 * all the values read here are.
 */
function yamlValue(yaml: string, section: string, key: string): string | null {
  let inSection = false;

  for (const rawLine of yaml.split(/\r?\n/)) {
    if (!rawLine.trim() || rawLine.trimStart().startsWith('#')) continue;

    // A top-level key is unindented; anything indented belongs to the current
    // one. This is what keeps `radarr:`'s apikey out of `auth:`.
    if (!/^\s/.test(rawLine)) {
      inSection = rawLine.split(':')[0]?.trim() === section;
      continue;
    }

    if (!inSection) continue;

    const separator = rawLine.indexOf(':');
    if (separator === -1) continue;
    if (rawLine.slice(0, separator).trim() !== key) continue;

    // Bazarr quotes some values and not others, and writes '' for unset. Its
    // config.yaml is round-tripped by ruamel, so a comment a user adds by hand
    // survives every rewrite — and ` # note` trailing an unquoted key would
    // otherwise become part of the credential. Inside quotes a `#` is data,
    // so the comment is only stripped from the unquoted form.
    const raw = rawLine.slice(separator + 1).trim();
    const quoted = /^(['"])((?:(?!\1).)*)\1/.exec(raw);
    const value = quoted ? quoted[2] : raw.replace(/\s+#.*$/, '').trim();
    return value || null;
  }

  return null;
}

/**
 * Bazarr, which despite sitting alongside the *arrs shares none of their
 * config format.
 *
 * It is Python, not .NET: there is no `config.xml` anywhere in its tree, and
 * treating it as an *arr left this integration permanently `waiting` while
 * telling the user to start Bazarr — advice that could never help, because
 * Bazarr had already written the config we weren't reading. The key lives at
 * `config/config.yaml` *inside* the config directory, so it is reachable
 * through the existing `${USERDIR}/bazarr/config` mount with no compose change.
 */
async function discoverBazarr(): Promise<Omit<Credential, 'source'>> {
  const yaml = await readIfPresent(join(DISCOVER_ROOT, 'bazarr', 'config', 'config.yaml'));
  if (!yaml) {
    return { apiKey: null, state: 'waiting', origin: 'none', hint: WAITING_HINT.bazarr, urlBase: '' };
  }

  const apiKey = yamlValue(yaml, 'auth', 'apikey');
  const urlBase = yamlValue(yaml, 'general', 'base_url') ?? '';

  if (!apiKey) {
    return {
      apiKey: null,
      state: 'waiting',
      origin: 'none',
      hint: 'Found Bazarr’s config.yaml but no auth.apikey in it yet.',
      urlBase,
    };
  }
  return { apiKey, state: 'live', origin: 'discovered', hint: null, urlBase };
}

/** Sonarr / Radarr / Prowlarr all use the same `config.xml` shape. */
async function discoverArr(source: SourceId): Promise<Omit<Credential, 'source'>> {
  const xml = await readIfPresent(join(DISCOVER_ROOT, source, 'config.xml'));
  if (!xml) {
    return { apiKey: null, state: 'waiting', origin: 'none', hint: WAITING_HINT[source], urlBase: '' };
  }

  const apiKey = xmlTag(xml, 'ApiKey');
  const urlBase = xmlTag(xml, 'UrlBase') ?? '';

  if (!apiKey) {
    return {
      apiKey: null,
      state: 'waiting',
      origin: 'none',
      hint: `Found ${source}'s config.xml but no <ApiKey> in it yet.`,
      urlBase,
    };
  }
  return { apiKey, state: 'live', origin: 'discovered', hint: null, urlBase };
}

async function discoverTautulli(): Promise<Omit<Credential, 'source'>> {
  const ini = await readIfPresent(join(DISCOVER_ROOT, 'tautulli', 'config.ini'));
  if (!ini) {
    return { apiKey: null, state: 'waiting', origin: 'none', hint: WAITING_HINT.tautulli, urlBase: '' };
  }

  const apiKey = iniValue(ini, 'General', 'api_key');
  // Tautulli ships with the API disabled; a key alone isn't enough to call it,
  // and reporting a generic failure here would send people hunting in the wrong
  // place.
  const enabled = iniValue(ini, 'General', 'api_enabled') === '1';

  if (!apiKey) {
    return {
      apiKey: null,
      state: 'waiting',
      origin: 'none',
      hint: 'Tautulli has no API key yet. Settings -> Web Interface -> API.',
      urlBase: '',
    };
  }
  if (!enabled) {
    return {
      apiKey,
      state: 'blocked',
      origin: 'discovered',
      hint: 'Tautulli’s API is disabled. Enable it in Settings -> Web Interface -> API.',
      urlBase: '',
    };
  }
  return { apiKey, state: 'live', origin: 'discovered', hint: null, urlBase: '' };
}

async function discoverSeerr(): Promise<Omit<Credential, 'source'>> {
  const raw = await readIfPresent(join(DISCOVER_ROOT, 'seerr', 'settings.json'));
  if (!raw) {
    return { apiKey: null, state: 'waiting', origin: 'none', hint: WAITING_HINT.seerr, urlBase: '' };
  }

  try {
    const parsed = JSON.parse(raw) as { main?: { apiKey?: unknown } };
    const apiKey = typeof parsed.main?.apiKey === 'string' ? parsed.main.apiKey : null;
    if (!apiKey) {
      return {
        apiKey: null,
        state: 'waiting',
        origin: 'none',
        hint: 'Seerr’s settings.json has no API key yet. Finish the setup wizard.',
        urlBase: '',
      };
    }
    return { apiKey, state: 'live', origin: 'discovered', hint: null, urlBase: '' };
  } catch {
    // Seerr rewrites this file in place; a read during a write can catch it
    // mid-flight. Treat it as "not ready" and try again on the next cycle.
    return {
      apiKey: null,
      state: 'waiting',
      origin: 'none',
      hint: 'Seerr’s settings.json could not be parsed; retrying.',
      urlBase: '',
    };
  }
}

async function discoverOne(source: SourceId): Promise<Credential> {
  const override = process.env[ENV_VAR[source]]?.trim();
  if (override) {
    return { source, apiKey: override, state: 'live', origin: 'env', hint: null, urlBase: '' };
  }

  const found =
    source === 'tautulli'
      ? await discoverTautulli()
      : source === 'seerr'
        ? await discoverSeerr()
        : source === 'bazarr'
          ? await discoverBazarr()
          : await discoverArr(source);

  return { source, ...found };
}

const SOURCES: SourceId[] = ['sonarr', 'radarr', 'prowlarr', 'bazarr', 'tautulli', 'seerr'];

async function discoverAll(): Promise<Record<SourceId, Credential>> {
  const results = await Promise.all(SOURCES.map(discoverOne));
  return Object.fromEntries(results.map((c) => [c.source, c])) as Record<SourceId, Credential>;
}

/**
 * Cached for a minute: long enough that per-request polling doesn't re-read six
 * files, short enough that a service coming up for the first time is picked up
 * without anyone restarting the dashboard.
 */
export const getCredentials = memoize(
  discoverAll,
  Number(process.env.DISCOVERY_TTL_MS) || 60_000,
);

export async function credentialFor(source: SourceId): Promise<Credential> {
  return (await getCredentials())[source];
}

export const __test = { xmlTag, iniValue, yamlValue, SOURCES, ENV_VAR };
