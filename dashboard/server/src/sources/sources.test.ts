import { test } from 'node:test';
import assert from 'node:assert/strict';

import { __test as tautulli } from './tautulli.js';
import { __test as transmission } from './transmission.js';
import { __test as seerr } from './seerr.js';
import { __test as arr } from './arr.js';
import { __test as prometheus } from './prometheus.js';
import { __test as activity } from './activity.js';
import { __test as posters } from './posters.js';

// ---- Tautulli --------------------------------------------------------------

test('duration formats under an hour without a leading hour', () => {
  assert.equal(tautulli.duration(12 * 60 * 1000 + 44 * 1000), '12:44');
});

test('duration formats over an hour with zero-padded minutes', () => {
  assert.equal(tautulli.duration((1 * 3600 + 2 * 60 + 11) * 1000), '1:02:11');
});

test('duration handles zero and nonsense without throwing', () => {
  assert.equal(tautulli.duration(0), '0:00');
  assert.equal(tautulli.duration(Number.NaN), '0:00');
  assert.equal(tautulli.duration(-5), '0:00');
});

test('transcode decision maps to the design’s three modes', () => {
  assert.equal(tautulli.mode('transcode'), 'Transcode');
  assert.equal(tautulli.mode('copy'), 'Direct Stream');
  assert.equal(tautulli.mode('direct play'), 'Direct Play');
  assert.equal(tautulli.mode(undefined), 'Direct Play');
});

test('monogram initialises multi-word titles and truncates single words', () => {
  assert.equal(tautulli.monogram('The Bear'), 'TB');
  assert.equal(tautulli.monogram('Oppenheimer'), 'OPPE');
  assert.equal(tautulli.monogram('Dune: Part Two'), 'DPT');
  assert.equal(tautulli.monogram(''), '—');
});

test('episode sessions render as SxxEyy, movies as a year', () => {
  const episode = tautulli.toStream({
    media_type: 'episode',
    grandparent_title: 'The Bear',
    parent_media_index: '3',
    media_index: '5',
  });
  assert.equal(episode.title, 'The Bear');
  assert.equal(episode.meta, 'S03E05');

  const movie = tautulli.toStream({ media_type: 'movie', title: 'Dune', year: '2024' });
  assert.equal(movie.meta, '2024');
});

test('each poster source accepts only its own reference shape', () => {
  assert.ok(posters.isValidRef('plex', '/library/metadata/130222/thumb/1785273308'));
  assert.ok(posters.isValidRef('plex', '/library/metadata/49126/art/1784188852'));
  assert.ok(posters.isValidRef('sonarr', '1034'));
  assert.ok(posters.isValidRef('radarr', '1'));
  assert.ok(posters.isValidRef('tmdb', '/u4YZhMms48mgP756hniUcw6PQPU.jpg'));

  // A ref round-trips through the browser before coming back to the poster
  // route, so anything that would widen it beyond one image must be refused —
  // traversal, absolute URLs and query smuggling in particular. Refs must not
  // be interchangeable between sources either: a Plex path accepted as a TMDb
  // one would reach a different host entirely.
  const bad: [string, string][] = [
    ['plex', '/library/metadata/1/thumb/1/../../../etc/passwd'],
    ['plex', 'http://evil.example/pwn.png'],
    ['plex', '//evil.example/pwn.png'],
    ['plex', '/library/metadata/1/thumb/1&cmd=get_settings'],
    ['plex', '/library/sections/1/all'],
    ['plex', '/library/metadata/abc/thumb/1'],
    ['plex', '/u4YZhMms48mgP756hniUcw6PQPU.jpg'],
    ['tmdb', '/library/metadata/1/thumb/1'],
    ['tmdb', '/../../etc/passwd.jpg'],
    ['tmdb', '/nested/path/poster.jpg'],
    ['tmdb', 'https://evil.example/x.jpg'],
    ['sonarr', '0'],
    ['sonarr', '-1'],
    ['sonarr', '1;rm -rf /'],
    ['sonarr', '../../etc/passwd'],
    ['radarr', '1.5'],
    ['nope', '1'],
    ['plex', ''],
  ];
  for (const [source, ref] of bad) {
    assert.equal(posters.isValidRef(source as never, ref), false, `${source}: ${ref}`);
  }
});

test('a poster URL names its source and escapes its reference', () => {
  assert.equal(
    posters.url('plex', '/library/metadata/34279/thumb/1785309193'),
    '/api/poster?src=plex&ref=%2Flibrary%2Fmetadata%2F34279%2Fthumb%2F1785309193',
  );
  assert.equal(posters.url('sonarr', '1034'), '/api/poster?src=sonarr&ref=1034');
  // An invalid ref yields no URL at all rather than one that 404s on use.
  assert.equal(posters.url('tmdb', '/nested/path.jpg'), null);
  assert.equal(posters.url('plex', undefined), null);
});

test('an episode posts the show poster; a movie its own', () => {
  const episode = tautulli.toStream({
    media_type: 'episode',
    grandparent_thumb: '/library/metadata/49126/thumb/1784188852',
    thumb: '/library/metadata/130248/thumb/1785326051',
  });
  // The episode's own thumb is the still frame; the design's tile wants the
  // show's poster.
  assert.equal(
    episode.poster,
    '/api/poster?src=plex&ref=%2Flibrary%2Fmetadata%2F49126%2Fthumb%2F1784188852',
  );

  const movie = tautulli.toStream({
    media_type: 'movie',
    thumb: '/library/metadata/130222/thumb/1785273308',
  });
  assert.equal(
    movie.poster,
    '/api/poster?src=plex&ref=%2Flibrary%2Fmetadata%2F130222%2Fthumb%2F1785273308',
  );
});

test('a missing or unusable thumb yields no poster rather than a broken URL', () => {
  assert.equal(tautulli.toStream({ media_type: 'movie' }).poster, null);
  assert.equal(
    tautulli.toStream({ media_type: 'movie', thumb: 'http://evil.example/x.png' }).poster,
    null,
  );
  // An episode with no show poster falls back to the monogram, not to its still.
  assert.equal(tautulli.toStream({ media_type: 'episode' }).poster, null);
});

test('progress percent is clamped to 0-100', () => {
  assert.equal(tautulli.toStream({ progress_percent: '150' }).percent, 100);
  assert.equal(tautulli.toStream({ progress_percent: '-10' }).percent, 0);
  assert.equal(tautulli.toStream({ progress_percent: 'abc' }).percent, 0);
});

// ---- Transmission ----------------------------------------------------------

test('speed switches units at 1 MB/s', () => {
  assert.equal(transmission.formatSpeed(42_000_000), '42.0 MB/s');
  assert.equal(transmission.formatSpeed(500_000), '500 KB/s');
  assert.equal(transmission.formatSpeed(0), '0 MB/s');
});

test('negative ETA means unknown, not a negative duration', () => {
  // Transmission uses -1 for "unknown" and -2 for "not downloading".
  assert.equal(transmission.formatEta(-1), '—');
  assert.equal(transmission.formatEta(-2), '—');
  assert.equal(transmission.formatEta(undefined), '—');
});

test('ETA scales through seconds, minutes, hours and days', () => {
  assert.equal(transmission.formatEta(45), '45s');
  assert.equal(transmission.formatEta(180), '3m');
  assert.equal(transmission.formatEta(3600 * 2 + 60 * 30), '2h 30m');
  assert.equal(transmission.formatEta(86_400 * 3), '3d');
});

test('the failure hint matches the failure, not a generic one', () => {
  assert.match(
    transmission.hintFor('Transmission rejected the RPC credentials'),
    /TRANSMISSION_RPC_USERNAME/,
  );
  assert.match(transmission.hintFor('connection refused'), /LOCAL_NETWORK/);
  assert.match(transmission.hintFor('upstream timed out'), /LOCAL_NETWORK/);
  assert.match(transmission.hintFor('HTTP 500'), /logs/);
});

test('attribution falls back to OTHER rather than guessing', () => {
  const index = transmission.indexQueues(
    [{ title: 'Show.S01E01.1080p', seriesId: 7 }],
    [{ title: 'Movie.2024.2160p', movieId: 9 }],
  );

  const show = transmission.attribute('Show.S01E01.1080p', index);
  assert.equal(show.source, 'SONARR');
  assert.equal(show.poster, '/api/poster?src=sonarr&ref=7');

  const movie = transmission.attribute('Movie.2024.2160p', index);
  assert.equal(movie.source, 'RADARR');
  assert.equal(movie.poster, '/api/poster?src=radarr&ref=9');

  // A torrent no *arr tracks keeps its placeholder rather than borrowing art
  // from a near-miss — a wrong poster is worse than none.
  const unknown = transmission.attribute('Something.Else', index);
  assert.equal(unknown.source, 'OTHER');
  assert.equal(unknown.poster, null);
});

test('a queue record without an id still attributes, just without art', () => {
  const index = transmission.indexQueues([{ title: 'Show.S01E01.1080p' }], []);
  const show = transmission.attribute('Show.S01E01.1080p', index);
  assert.equal(show.source, 'SONARR');
  assert.equal(show.poster, null);
});

// ---- Seerr -----------------------------------------------------------------

test('relative time reads naturally across ranges', () => {
  const now = new Date('2026-07-28T12:00:00Z');
  const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();
  assert.equal(seerr.relative(ago(30 * 60_000), now), '30m ago');
  assert.equal(seerr.relative(ago(5 * 3600_000), now), '5h ago');
  assert.equal(seerr.relative(ago(26 * 3600_000), now), 'Yesterday');
  assert.equal(seerr.relative(ago(3 * 86_400_000), now), '3d ago');
  assert.equal(seerr.relative(undefined, now), '');
});

test('an approved request that is processing reads as Downloading', () => {
  assert.equal(seerr.statusOf({ status: 2, media: { status: 3 } }), 'Downloading');
  assert.equal(seerr.statusOf({ status: 2, media: { status: 5 } }), 'Available');
  assert.equal(seerr.statusOf({ status: 2, media: { status: 1 } }), 'Approved');
  assert.equal(seerr.statusOf({ status: 1 }), 'Pending');
  assert.equal(seerr.statusOf({ status: 3 }), 'Declined');
});

test('the pending count comes from a filtered query, not the visible page', async () => {
  const calls: string[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string) => {
    calls.push(String(url));
    return new Response(JSON.stringify({ pageInfo: { results: 23 }, results: [] }), {
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;

  try {
    // 23 outstanding, far beyond what the 8-row page could show.
    assert.equal(await seerr.pendingCount('key', 3), 23);
    assert.ok(calls[0]?.includes('filter=pending'), 'query must be filtered to pending');
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('a failed or shapeless pending count falls back to the visible rows', async () => {
  const realFetch = globalThis.fetch;

  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ results: [] }), {
      headers: { 'content-type': 'application/json' },
    })) as typeof fetch;
  try {
    // No pageInfo in the response — an older Seerr, or a changed shape.
    assert.equal(await seerr.pendingCount('key', 3), 3);
  } finally {
    globalThis.fetch = realFetch;
  }

  for (const results of ['23', -1, Number.NaN, null]) {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ pageInfo: { results } }), {
        headers: { 'content-type': 'application/json' },
      })) as typeof fetch;
    try {
      // A 200 carrying a count that isn't a count at all — the body is typed,
      // not validated, so the value has to be checked before the panel sees it.
      assert.equal(await seerr.pendingCount('key', 3), 3, `results: ${String(results)}`);
    } finally {
      globalThis.fetch = realFetch;
    }
  }

  globalThis.fetch = (async () => {
    throw new Error('connection refused');
  }) as typeof fetch;
  try {
    // The list already loaded; a failed count must not cost the panel its rows.
    assert.equal(await seerr.pendingCount('key', 3), 3);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('a request describes itself with its title and poster from Seerr detail data', async () => {
  const realFetch = globalThis.fetch;

  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({ title: 'Ransom Canyon', posterPath: '/u4YZhMms48mgP756hniUcw6PQPU.jpg' }),
      { headers: { 'content-type': 'application/json' } },
    )) as typeof fetch;
  try {
    const described = await seerr.describe({ type: 'tv', media: { tmdbId: 504 } }, 'key');
    assert.equal(described.title, 'Ransom Canyon');
    assert.equal(described.poster, '/api/poster?src=tmdb&ref=%2Fu4YZhMms48mgP756hniUcw6PQPU.jpg');
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('a request with no tmdbId yet describes as unknown, without a fetch', async () => {
  const realFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = (async () => {
    called = true;
    throw new Error('should not be called');
  }) as typeof fetch;
  try {
    const described = await seerr.describe({ type: 'movie', media: {} }, 'key');
    assert.equal(described.title, 'Unknown title');
    assert.equal(described.poster, null);
    // A request the media server hasn't matched yet has no id to look up —
    // this must short-circuit rather than making a doomed request.
    assert.equal(called, false);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('a failed detail lookup describes as unknown rather than dropping the row', async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new Error('connection refused');
  }) as typeof fetch;
  try {
    const described = await seerr.describe({ type: 'movie', media: { tmdbId: 27205 } }, 'key');
    assert.equal(described.title, 'Unknown title');
    assert.equal(described.poster, null);
  } finally {
    globalThis.fetch = realFetch;
  }
});

// ---- Sonarr calendar -------------------------------------------------------

test('an episode with a file is downloaded regardless of air date', () => {
  const now = new Date('2026-07-28T12:00:00Z');
  assert.equal(arr.classify({ hasFile: true, airDateUtc: '2026-07-01T00:00:00Z' }, now), 'downloaded');
});

test('a future episode is airing; a past one without a file is missing', () => {
  const now = new Date('2026-07-28T12:00:00Z');
  assert.equal(arr.classify({ hasFile: false, airDateUtc: '2026-07-30T00:00:00Z' }, now), 'airing');
  assert.equal(arr.classify({ hasFile: false, airDateUtc: '2026-07-20T00:00:00Z' }, now), 'missing');
});

// ---- Prometheus ------------------------------------------------------------

test('byte formatting steps through units', () => {
  assert.equal(prometheus.formatBytes(512), '512 B');
  assert.equal(prometheus.formatBytes(1024 * 1024 * 1.5), '1.5 MB');
  assert.equal(prometheus.formatBytes(1024 ** 4 * 7.8), '7.8 TB');
});

// ---- Activity feed ---------------------------------------------------------

test('servarr event types map to feed icons', () => {
  assert.equal(activity.kindOf('grabbed'), 'grab');
  assert.equal(activity.kindOf('downloadFolderImported'), 'download');
  assert.equal(activity.kindOf('somethingNew'), 'other');
});

test('feed phrasing names the service that acted', () => {
  assert.equal(activity.phrase('grabbed', 'Sonarr', 'Show.S01E01'), 'Sonarr grabbed Show.S01E01');
  assert.equal(activity.phrase('movieFileImported', 'Radarr', 'Movie.2024'), 'Imported Movie.2024');
});
