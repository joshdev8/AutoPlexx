import { test } from 'node:test';
import assert from 'node:assert/strict';

import { __test } from './docker.js';
import { SERVICES } from '../services.js';

const { classify } = __test;

test('classify: running without a healthcheck is up', () => {
  assert.equal(classify({ State: 'running', Status: 'Up 2 hours' }), 'up');
});

test('classify: running and healthy is up', () => {
  assert.equal(classify({ State: 'running', Status: 'Up 2 hours (healthy)' }), 'up');
});

test('classify: unhealthy needs attention', () => {
  assert.equal(classify({ State: 'running', Status: 'Up 5 minutes (unhealthy)' }), 'attn');
});

test('classify: health check still starting is not yet up', () => {
  assert.equal(classify({ State: 'running', Status: 'Up 3 seconds (health: starting)' }), 'starting');
});

test('classify: restart loop needs attention, not "down"', () => {
  assert.equal(classify({ State: 'restarting', Status: 'Restarting (1) 2 seconds ago' }), 'attn');
});

test('classify: exited is down', () => {
  assert.equal(classify({ State: 'exited', Status: 'Exited (0) 1 hour ago' }), 'down');
});

test('classify: missing fields degrade to down rather than throwing', () => {
  assert.equal(classify({}), 'down');
});

test('a proxy outage keeps the last good report instead of blanking it', async (t) => {
  const { buildReport, resetLastGood } = __test;
  resetLastGood();
  t.after(resetLastGood);

  const container = SERVICES.find((s) => s.id === 'radarr')!;
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  // One successful poll establishes a known-good report.
  globalThis.fetch = (async () =>
    new Response(JSON.stringify([{ Names: [`/${container.container}`], State: 'running', Status: 'Up 1 hour' }]), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })) as typeof fetch;

  const good = await buildReport();
  assert.equal(good.reachable, true);
  assert.equal(good.up, 1);
  assert.equal(good.total, 1);

  // The proxy then goes away.
  globalThis.fetch = (async () => {
    throw new Error('connection refused');
  }) as typeof fetch;

  const degraded = await buildReport();
  assert.equal(degraded.reachable, false, 'must report the outage');
  assert.equal(degraded.up, 1, 'but must not forget what was up');
  assert.equal(degraded.total, 1);
  assert.equal(
    degraded.services.find((s) => s.id === 'radarr')?.state,
    'up',
    'a transient outage must not flip services to absent',
  );
  assert.equal(
    degraded.statesKnown,
    true,
    'states are stale during a blip, but they were still observed — the UI keys ' +
      'link suppression off this, and treating a hiccup as "unknown" would flip ' +
      'every optional service back to linkable',
  );
});

test('a failure before any successful poll reports nothing rather than lying', async (t) => {
  const { buildReport, resetLastGood } = __test;
  resetLastGood();
  t.after(resetLastGood);

  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  globalThis.fetch = (async () => {
    throw new Error('connection refused');
  }) as typeof fetch;

  const report = await buildReport();
  assert.equal(report.reachable, false);
  assert.equal(report.total, 0);
  assert.ok(report.services.every((s) => s.state === 'absent'));
  assert.equal(
    report.statesKnown,
    false,
    'nothing was ever observed, so those absents are placeholders and the UI ' +
      'must not treat them as real absences',
  );
});

test('catalog: ids and container names are unique', () => {
  const ids = new Set(SERVICES.map((s) => s.id));
  const containers = new Set(SERVICES.map((s) => s.container));
  assert.equal(ids.size, SERVICES.length, 'duplicate service id');
  assert.equal(containers.size, SERVICES.length, 'duplicate container name');
});

test('catalog: every service with a port has a UI group', () => {
  for (const service of SERVICES) {
    if (service.port !== null) {
      assert.notEqual(service.group, 'system', `${service.id} has a port but is hidden`);
    }
  }
});
