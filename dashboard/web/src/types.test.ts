import assert from 'node:assert/strict';
import { test } from 'node:test';

import { isMissing, launchUrl, type ServiceStatus } from './types';

// `serviceUrl` builds links against whatever host the dashboard was loaded
// from, so these tests need a window to read. Set before importing anything
// that calls it at module scope — nothing does today, but the stub is cheap.
(globalThis as unknown as { window: unknown }).window = {
  location: { protocol: 'http:', hostname: 'nas.local' },
};

function service(
  over: Partial<ServiceStatus> = {},
): Pick<ServiceStatus, 'port' | 'state' | 'optional'> {
  return { port: 8096, state: 'up', ...over };
}

test('a running service links to its port on the dashboard host', () => {
  assert.equal(launchUrl(service()), 'http://nas.local:8096');
});

test('a service with no web UI has nothing to open', () => {
  assert.equal(launchUrl(service({ port: null })), null);
});

test('a stopped service still links — the container exists and may be started', () => {
  assert.equal(launchUrl(service({ state: 'down' })), 'http://nas.local:8096');
});

test('an uninstalled optional service does not link', () => {
  // Jellyfin ships commented out of docker-compose.yml but stays in the
  // catalog, so a Plex user would otherwise get a tile linking at :8096.
  assert.equal(launchUrl(service({ state: 'absent', optional: true })), null);
});

test('an absent NON-optional service keeps its link', () => {
  // Compose always defines Radarr, so `absent` here means something unexpected
  // — most often a renamed container. Dropping a link that still works would
  // hide the mismatch instead of surfacing it.
  assert.equal(launchUrl(service({ state: 'absent', port: 7878 })), 'http://nas.local:7878');
});

test('absent optional services still link when container state could not be read', () => {
  // The regression this guards: on a cold start with the socket proxy down,
  // `buildReport` reports every service absent — including both halves of the
  // Plex/Jellyfin swap, the two tiles a user most wants at that moment.
  assert.equal(
    launchUrl(service({ state: 'absent', optional: true }), false),
    'http://nas.local:8096',
  );
});

test('a UI-less service stays unopenable even when state is unknown', () => {
  // Port is static catalog data — unreachable Docker tells us nothing new.
  assert.equal(launchUrl(service({ port: null, state: 'absent' }), false), null);
});

test('isMissing separates a real absence from an unreadable one', () => {
  // The header's Request shortcut hides itself on the first and not the second.
  assert.equal(isMissing({ state: 'absent' }), true);
  assert.equal(isMissing({ state: 'absent' }, false), false);
  assert.equal(isMissing({ state: 'down' }), false);
  assert.equal(isMissing({ state: 'up' }), false);
});

test('isMissing is true for a non-optional service, even though launchUrl links it', () => {
  // The regression this guards: narrowing launchUrl to `optional` services left
  // the Request button rendering a live link to an absent Seerr, because it had
  // delegated its own absence check to launchUrl. The two questions are
  // different and both callers need the right one.
  const seerr = service({ state: 'absent', port: 5055 });
  assert.equal(launchUrl(seerr), 'http://nas.local:5055');
  assert.equal(isMissing(seerr), true);
});
