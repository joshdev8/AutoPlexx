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
