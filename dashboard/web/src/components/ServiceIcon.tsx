import { HUE_VAR, type Hue } from '../types';

/**
 * Vendored service logos, keyed by service id.
 *
 * Self-hosted for the same reason Inter and Phosphor are: this stack may have
 * no route out, and an icon set that only renders with internet access is worse
 * than none. Sourced from homarr-labs/dashboard-icons (Apache 2.0) — provenance
 * is recorded in NOTICE.md beside the assets.
 *
 * Globbed rather than listed, so dropping `<service id>.svg` into that folder is
 * the whole of adding a logo. Anything without one keeps its monogram, which is
 * why the services the set doesn't cover need no special handling here.
 */
const LOGOS = import.meta.glob('../assets/services/*.svg', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

const BY_ID: Record<string, string> = Object.fromEntries(
  Object.entries(LOGOS).map(([path, url]) => [path.split('/').pop()!.replace(/\.svg$/, ''), url]),
);

interface Props {
  /** Service id, used to find its logo. Without a match, the monogram stands in. */
  id?: string;
  mono: string;
  hue: Hue;
  size?: number;
}

/** A service's logo, or the tinted monogram tile that stands in for one. */
export function ServiceIcon({ id, mono, hue, size = 24 }: Props) {
  const color = HUE_VAR[hue];
  const logo = id ? BY_ID[id] : undefined;
  const radius = size >= 36 ? 'var(--radius-md)' : 'var(--radius-sm)';

  if (logo) {
    return (
      <img
        src={logo}
        alt=""
        aria-hidden="true"
        style={{
          width: size,
          height: size,
          flex: 'none',
          borderRadius: radius,
          // These are square logos that carry their own padding; `contain`
          // keeps a wide wordmark from being cropped into nonsense.
          objectFit: 'contain',
        }}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        flex: 'none',
        borderRadius: radius,
        background: `color-mix(in srgb, ${color} 18%, transparent)`,
        color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--font-heading)',
        fontWeight: 500,
        fontSize: size >= 36 ? 14 : 10,
      }}
    >
      {mono}
    </span>
  );
}
