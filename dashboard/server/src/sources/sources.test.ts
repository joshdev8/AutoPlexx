import { test } from 'node:test';
import assert from 'node:assert/strict';

import { __test as tautulli } from './tautulli.js';
import { __test as transmission } from './transmission.js';
import { __test as seerr } from './seerr.js';
import { __test as arr } from './arr.js';
import { __test as prometheus } from './prometheus.js';
import { __test as activity } from './activity.js';

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
  const sonarr = new Set(['Show.S01E01.1080p']);
  const radarr = new Set(['Movie.2024.2160p']);
  assert.equal(transmission.attribute('Show.S01E01.1080p', sonarr, radarr), 'SONARR');
  assert.equal(transmission.attribute('Movie.2024.2160p', sonarr, radarr), 'RADARR');
  assert.equal(transmission.attribute('Something.Else', sonarr, radarr), 'OTHER');
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
