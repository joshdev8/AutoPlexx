import assert from 'node:assert/strict';
import { test } from 'node:test';

import { match, score } from './search';
import type { ServiceGroup, ServiceStatus } from './types';

(globalThis as unknown as { window: unknown }).window = {
  location: { protocol: 'http:', hostname: 'nas.local' },
};

const GROUPS: { id: ServiceGroup }[] = [{ id: 'media' }, { id: 'downloads' }];

function service(over: Partial<ServiceStatus> & { id: string }): ServiceStatus {
  return {
    name: over.id,
    mono: over.id.slice(0, 2).toUpperCase(),
    container: over.id,
    group: 'media',
    hue: 'violet',
    port: 8096,
    blurb: '',
    state: 'up',
    status: null,
    ...over,
  };
}

const PLEX = service({ id: 'plex', name: 'Plex', port: 32400 });
const JELLYFIN = service({
  id: 'jellyfin',
  name: 'Jellyfin',
  port: 8096,
  state: 'absent',
  optional: true,
});
const BAZARR = service({ id: 'bazarr', name: 'Bazarr', port: 6767, state: 'absent' });
const WATCHTOWER = service({ id: 'watchtower', name: 'Watchtower', port: null });

test('an uninstalled optional service is not an openable result', () => {
  // Otherwise it is keyboard-navigable and Enter opens a tab that refuses.
  const { openable, unopenable } = match([PLEX, JELLYFIN], GROUPS, 'jelly');
  assert.deepEqual(
    openable.map((s) => s.id),
    [],
  );
  assert.deepEqual(
    unopenable.map((s) => s.id),
    ['jellyfin'],
  );
});

test('an uninstalled optional service is still named, rather than vanishing from search', () => {
  const { unopenable } = match([PLEX, JELLYFIN], GROUPS, 'jellyfin');
  assert.equal(unopenable.length, 1);
});

test('openable results carry a resolved href', () => {
  const { openable } = match([PLEX], GROUPS, 'plex');
  assert.equal(openable.length, 1);
  assert.equal(openable[0]!.href, 'http://nas.local:32400');
  assert.equal(openable[0]!.port, 32400);
});

test('a UI-less service is named but not offered as a result', () => {
  const { openable, unopenable } = match([WATCHTOWER], GROUPS, 'watch');
  assert.equal(openable.length, 0);
  assert.deepEqual(
    unopenable.map((s) => s.id),
    ['watchtower'],
  );
});

test('absent optional services become openable again when container state is unknown', () => {
  // Socket proxy down on a cold start — search must not go dead too.
  const { openable } = match([PLEX, JELLYFIN], GROUPS, 'jelly', false);
  assert.deepEqual(
    openable.map((s) => s.id),
    ['jellyfin'],
  );
});

test('services outside a visible group are not searchable', () => {
  const proxy = service({ id: 'docker-socket-proxy', name: 'Socket Proxy', group: 'system' });
  const { openable, unopenable } = match([proxy], GROUPS, 'socket');
  assert.equal(openable.length, 0);
  assert.equal(unopenable.length, 0);
});

test('an empty query matches nothing', () => {
  const { openable, unopenable } = match([PLEX, JELLYFIN], GROUPS, '   ');
  assert.equal(openable.length, 0);
  assert.equal(unopenable.length, 0);
});

test('a name prefix outranks a mere substring', () => {
  // Typing "so" should reach Sonarr before Flaresolverr.
  assert.ok(score(service({ id: 'sonarr', name: 'Sonarr' }), 'so')! <
            score(service({ id: 'flaresolverr', name: 'Flaresolverr' }), 'so')!);
});

test('an absent non-optional service stays openable', () => {
  // A renamed container should not silently cost the user a working link.
  const { openable } = match([BAZARR], GROUPS, 'bazarr');
  assert.deepEqual(
    openable.map((s) => s.id),
    ['bazarr'],
  );
});
