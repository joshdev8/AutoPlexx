import { test } from 'node:test';
import assert from 'node:assert/strict';

import { __test } from './discovery.js';

const { xmlTag, iniValue, SOURCES, ENV_VAR } = __test;

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

test('every source has an env override variable', () => {
  for (const source of SOURCES) {
    assert.ok(ENV_VAR[source], `${source} has no env override`);
  }
});
