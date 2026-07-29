import { useState } from 'react';

/**
 * A poster tile that degrades to the design's monogram placeholder.
 *
 * Artwork is proxied from Plex and can be missing for ordinary reasons — an
 * item with no poster, Tautulli still booting, a key not discovered yet — so
 * the placeholder is the default state rather than an error state. The image
 * simply replaces it once it loads.
 */
export function Poster({
  src,
  mono,
  width,
  height,
}: {
  src: string | null;
  mono: string;
  width: number;
  height: number;
}) {
  // Tracking which src failed (rather than a boolean) means a new poster gets
  // its own attempt without needing an effect to reset the flag.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImage = src !== null && failedSrc !== src;

  const frame = {
    width,
    height,
    flex: 'none' as const,
    borderRadius: 'var(--radius-sm)',
    overflow: 'hidden' as const,
  };

  if (!showImage) {
    return (
      <div
        aria-hidden="true"
        style={{
          ...frame,
          background:
            'repeating-linear-gradient(135deg, var(--color-neutral-800) 0 7px, var(--color-surface) 7px 14px)',
          display: 'flex',
          alignItems: 'flex-end',
          padding: 4,
          fontSize: 8,
          color: 'var(--color-neutral-500)',
        }}
      >
        {mono}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      loading="lazy"
      onError={() => setFailedSrc(src)}
      style={{ ...frame, objectFit: 'cover', background: 'var(--color-neutral-800)' }}
    />
  );
}
