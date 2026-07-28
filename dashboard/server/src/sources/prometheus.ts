import { config } from '../config.js';
import { memoize } from '../cache.js';
import { getJson, safely, type Result } from '../http.js';

/**
 * Resource gauges, from node-exporter via Prometheus.
 *
 * prometheus/prometheus.yml already scrapes node-exporter and cAdvisor, so
 * these need no configuration at all — which is why the gauges work on a
 * completely unconfigured stack.
 */

interface PromResponse {
  status: string;
  data?: { result?: { value?: [number, string] }[] };
}

export interface Gauge {
  id: 'cpu' | 'memory' | 'storage' | 'network';
  label: string;
  value: string;
  sub: string;
  /** 0-1, drives the conic-gradient ring. Null when the metric has no ceiling. */
  fraction: number | null;
}

/** Runs one instant query and returns the first sample's value. */
async function query(expr: string): Promise<number | null> {
  const url = `${config.upstream.prometheus}/api/v1/query?query=${encodeURIComponent(expr)}`;
  const body = await getJson<PromResponse>(url);
  if (body.status !== 'success') return null;
  const raw = body.data?.result?.[0]?.value?.[1];
  if (raw === undefined) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 100 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

async function load(): Promise<{ gauges: Gauge[] }> {
  // `mode="idle"` inverted gives busy time across all cores.
  const cpuExpr = '100 - (avg(rate(node_cpu_seconds_total{mode="idle"}[2m])) * 100)';
  const coresExpr = 'count(count by (cpu) (node_cpu_seconds_total))';
  const memTotalExpr = 'node_memory_MemTotal_bytes';
  const memAvailExpr = 'node_memory_MemAvailable_bytes';
  // Exclude pseudo-filesystems so "storage" reflects real disks. Summed across
  // mountpoints because media commonly spans several.
  const fsFilter = '{fstype!~"tmpfs|overlay|squashfs|ramfs|devtmpfs"}';
  const fsSizeExpr = `sum(node_filesystem_size_bytes${fsFilter})`;
  const fsAvailExpr = `sum(node_filesystem_avail_bytes${fsFilter})`;
  // Exclude loopback and virtual interfaces so the rate reflects real traffic.
  const netFilter = '{device!~"lo|veth.*|docker.*|br-.*"}';
  const rxExpr = `sum(rate(node_network_receive_bytes_total${netFilter}[2m]))`;
  const txExpr = `sum(rate(node_network_transmit_bytes_total${netFilter}[2m]))`;

  const [cpu, cores, memTotal, memAvail, fsSize, fsAvail, rx, tx] = await Promise.all([
    query(cpuExpr),
    query(coresExpr),
    query(memTotalExpr),
    query(memAvailExpr),
    query(fsSizeExpr),
    query(fsAvailExpr),
    query(rxExpr),
    query(txExpr),
  ]);

  const memUsed = memTotal !== null && memAvail !== null ? memTotal - memAvail : null;
  const fsUsed = fsSize !== null && fsAvail !== null ? fsSize - fsAvail : null;

  const gauges: Gauge[] = [
    {
      id: 'cpu',
      label: 'CPU',
      value: cpu === null ? '—' : `${Math.round(cpu)}%`,
      sub: cores === null ? 'host' : `${cores} core${cores === 1 ? '' : 's'}`,
      fraction: cpu === null ? null : Math.min(cpu / 100, 1),
    },
    {
      id: 'memory',
      label: 'Memory',
      value: memUsed === null ? '—' : formatBytes(memUsed),
      sub: memTotal === null ? 'host' : `of ${formatBytes(memTotal)}`,
      fraction: memUsed !== null && memTotal ? Math.min(memUsed / memTotal, 1) : null,
    },
    {
      id: 'storage',
      label: 'Storage',
      value: fsUsed === null ? '—' : formatBytes(fsUsed),
      sub: fsSize === null ? 'disks' : `of ${formatBytes(fsSize)}`,
      fraction: fsUsed !== null && fsSize ? Math.min(fsUsed / fsSize, 1) : null,
    },
    {
      id: 'network',
      label: 'Network',
      value: rx === null ? '—' : `${formatBytes(rx)}/s`,
      sub: tx === null ? 'down' : `down · ${formatBytes(tx)}/s up`,
      // Throughput has no ceiling to divide by, so the ring stays unfilled.
      fraction: null,
    },
  ];

  return { gauges };
}

export const getMetrics = memoize<Result<{ gauges: Gauge[] }>>(
  () => safely(load, 'Prometheus scrapes node-exporter; check both are running.'),
  config.ttl.metrics,
);

export const __test = { formatBytes };
