import { useCallback, useEffect, useRef, useState } from 'react';

export interface Polled<T> {
  data: T | null;
  error: string | null;
  /** True only until the first response — refreshes never blank the UI. */
  loading: boolean;
}

/**
 * Polls a JSON endpoint on an interval.
 *
 * Two behaviours matter for this dashboard: a failed refresh keeps the last good
 * data on screen (a brief upstream blip must not blank a widget), and polling
 * pauses while the tab is hidden so an idle dashboard doesn't sit on the stack's
 * APIs all day.
 */
export function usePolled<T>(url: string, intervalMs: number): Polled<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const cancelled = useRef(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      const json = (await response.json()) as T;
      if (cancelled.current) return;
      setData(json);
      setError(null);
    } catch (cause) {
      if (cancelled.current) return;
      setError(cause instanceof Error ? cause.message : 'request failed');
    } finally {
      if (!cancelled.current) setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    cancelled.current = false;
    void load();

    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, intervalMs);

    // Catch up immediately on return rather than waiting out the interval.
    const onVisible = () => {
      if (document.visibilityState === 'visible') void load();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled.current = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load, intervalMs]);

  return { data, error, loading };
}
