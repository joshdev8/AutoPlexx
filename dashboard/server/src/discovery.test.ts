import { test } from 'node:test';
import assert from 'node:assert/strict';

import { __test } from './discovery.js';

const { xmlTag, iniValue, yamlValue, SOURCES, ENV_VAR } = __test;

// Shaped after a real Radarr config.xml.
const ARR_XML = `<Config>
  <LogLevel>Info</LogLevel>
  <Port>7878</Port>
  <UrlBase></UrlBase>
  <ApiKey>abc123def456</ApiKey>
  <InstanceName>Radarr</InstanceName>
</Config>`;

test('xmlTag reads the API key', () => {
  assert.equal(xmlTag(ARR_XML, 'ApiKey'), 'abc123def456');
});

test('xmlTag returns null for an empty element rather than an empty string', () => {
  assert.equal(xmlTag(ARR_XML, 'UrlBase'), null);
});

test('xmlTag returns null for a missing element', () => {
  assert.equal(xmlTag(ARR_XML, 'NotThere'), null);
});

test('xmlTag does not match a tag that merely shares a prefix', () => {
  // <ApiKeyBackup> must not satisfy a lookup for <ApiKey>.
  const xml = '<Config><ApiKeyBackup>wrong</ApiKeyBackup><ApiKey>right</ApiKey></Config>';
  assert.equal(xmlTag(xml, 'ApiKey'), 'right');
});

test('xmlTag reads a populated UrlBase', () => {
  const xml = '<Config><UrlBase>/radarr</UrlBase></Config>';
  assert.equal(xmlTag(xml, 'UrlBase'), '/radarr');
});

// Shaped after a real Tautulli config.ini.
const TAUTULLI_INI = `[General]
api_enabled = 1
api_key = tautullikey123
api_sql = 0

[PMS]
pms_url = http://localhost:32400
api_key = wrong_section_key
`;

test('iniValue reads a key from the requested section', () => {
  assert.equal(iniValue(TAUTULLI_INI, 'General', 'api_key'), 'tautullikey123');
});

test('iniValue does not leak a same-named key from a later section', () => {
  assert.equal(iniValue(TAUTULLI_INI, 'PMS', 'api_key'), 'wrong_section_key');
});

test('iniValue reads the api_enabled flag', () => {
  assert.equal(iniValue(TAUTULLI_INI, 'General', 'api_enabled'), '1');
});

test('iniValue returns null for a missing key', () => {
  assert.equal(iniValue(TAUTULLI_INI, 'General', 'nope'), null);
});

// Shaped after a real Bazarr config/config.yaml. Bazarr is Python and writes
// YAML, not the .NET `config.xml` the *arrs use — and it stores an `apikey`
// under a dozen sections, including the *arrs it talks to. Section ordering is
// alphabetical, so `auth` genuinely sits near the top of a real file; nothing
// may depend on that.
const BAZARR_YAML = `addic7ed:
  password: ''
  username: ''
anticaptcha:
  anti_captcha_key: ''
auth:
  apikey: bazarrkey123
  password: ''
  type: null
general:
  port: 6767
  base_url: ''
radarr:
  apikey: radarrkey_must_not_be_used
  ip: 127.0.0.1
sonarr:
  apikey: sonarrkey_must_not_be_used
  ip: 127.0.0.1
subdl:
  api_key: ''
`;

test('yamlValue reads the API key from the auth section', () => {
  assert.equal(yamlValue(BAZARR_YAML, 'auth', 'apikey'), 'bazarrkey123');
});

test('yamlValue does not return a same-named key from another section', () => {
  // The failure that matters: Bazarr stores the Radarr and Sonarr keys it was
  // given under their own sections. Handing one of those back as Bazarr's own
  // would authenticate against the wrong service.
  assert.notEqual(yamlValue(BAZARR_YAML, 'auth', 'apikey'), 'radarrkey_must_not_be_used');
  assert.equal(yamlValue(BAZARR_YAML, 'radarr', 'apikey'), 'radarrkey_must_not_be_used');
});

test('yamlValue returns null for an empty value rather than an empty string', () => {
  assert.equal(yamlValue(BAZARR_YAML, 'subdl', 'api_key'), null);
});

test('yamlValue returns null for a missing section or key', () => {
  assert.equal(yamlValue(BAZARR_YAML, 'nosuch', 'apikey'), null);
  assert.equal(yamlValue(BAZARR_YAML, 'auth', 'nosuch'), null);
});

test('yamlValue strips quotes around a value', () => {
  assert.equal(yamlValue("auth:\n  apikey: 'quoted123'\n", 'auth', 'apikey'), 'quoted123');
  assert.equal(yamlValue('auth:\n  apikey: "quoted456"\n', 'auth', 'apikey'), 'quoted456');
});

test('yamlValue reads the base_url Bazarr serves under', () => {
  assert.equal(yamlValue('general:\n  base_url: /bazarr\n', 'general', 'base_url'), '/bazarr');
});

test('every source has an env override variable', () => {
  for (const source of SOURCES) {
    assert.ok(ENV_VAR[source], `${source} has no env override`);
  }
});
