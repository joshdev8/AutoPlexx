import { test } from 'node:test';
import assert from 'node:assert/strict';

import { describeError, safely, upstreamHint } from './http.js';

const SONARR = { name: 'Sonarr', urlVar: 'SONARR_URL' };

test('upstreamHint sends an unresolvable host to the network, not the API key', () => {
  // The failure that motivated this: a service on a network the dashboard
  // doesn't share resolves to nothing, and a bare reason with no next step
  // sends people to check credentials that were never the problem.
  const hint = upstreamHint(SONARR)('host not found');
  assert.match(hint, /network/i);
  assert.match(hint, /SONARR_URL/);
  assert.doesNotMatch(hint, /API key/i);
});

test('upstreamHint sends a rejected credential to the API key, not the network', () => {
  const hint = upstreamHint(SONARR)('authentication rejected (401)');
  assert.match(hint, /API key/i);
  assert.doesNotMatch(hint, /network/i);
});

test('upstreamHint distinguishes a refused connection from an unresolved one', () => {
  const refused = upstreamHint(SONARR)('connection refused');
  const missing = upstreamHint(SONARR)('host not found');
  assert.notEqual(refused, missing);
  assert.match(refused, /starting|listening/i);
});

test('upstreamHint names the service in every branch', () => {
  for (const reason of [
    'host not found',
    'connection refused',
    'upstream timed out',
    'authentication rejected (403)',
    'something nobody predicted',
  ]) {
    assert.match(upstreamHint(SONARR)(reason), /Sonarr/, `no service name for: ${reason}`);
  }
});

test('describeError maps a DNS failure to a host-not-found reason', () => {
  // EAI_AGAIN is what a container name on an unshared network actually returns.
  const dns = Object.assign(new Error('fetch failed'), { cause: { code: 'EAI_AGAIN' } });
  assert.equal(describeError(dns), 'host not found');
});

test('safely accepts a reason-derived hint, not just a fixed string', async () => {
  const result = await safely(async () => {
    throw Object.assign(new Error('fetch failed'), { cause: { code: 'ENOTFOUND' } });
  }, upstreamHint(SONARR));

  assert.equal(result.available, false);
  if (result.available) return;
  assert.equal(result.reason, 'host not found');
  assert.match(result.hint ?? '', /SONARR_URL/);
});

test('safely still accepts a plain string hint', async () => {
  const result = await safely(async () => {
    throw new Error('boom');
  }, 'do the thing');

  assert.equal(result.available, false);
  if (result.available) return;
  assert.equal(result.hint, 'do the thing');
});

test('safely attaches no hint when none is given', async () => {
  const result = await safely(async () => {
    throw new Error('boom');
  });

  assert.equal(result.available, false);
  if (result.available) return;
  assert.equal(result.hint, undefined);
});
