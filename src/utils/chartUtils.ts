import type { AlertSeverity, DetectedDive } from '../types/dive';
import type { DiveSpike } from './spikes';
import { tokens } from '../styles/GlobalStyle';

// ── Time formatting ───────────────────────────────────────
/**
 * Format seconds into M:SS, supporting negative values (pre-pad context).
 */
export function fmtTick(v: number): string {
  const sign = v < 0 ? '-' : '';
  const abs  = Math.abs(v);
  const m    = Math.floor(abs / 60);
  const s    = Math.floor(abs % 60);
  return `${sign}${m}:${s.toString().padStart(2, '0')}`;
}

// ── Severity helpers ──────────────────────────────────────
export function severityColor(s: AlertSeverity): string {
  if (s === 'danger')  return '#c026d3'; // fuchsia
  if (s === 'warning') return '#7c3aed'; // violet
  return '#0ea5e9';                       // sky blue
}

export function severityIcon(s: AlertSeverity): string {
  if (s === 'danger')  return '🟣';
  if (s === 'warning') return '🔷';
  return '🔵';
}

// ── Spike helpers ─────────────────────────────────────────
export function spikeIcon(type: DiveSpike['type']): string {
  if (type === 'hr')      return '❤️';
  if (type === 'descent') return '↓';
  return '↑';
}

// ── HR status label ───────────────────────────────────────
export function hrStatus(hr: number): { label: string; color: string } {
  if (hr < 70)  return { label: '안정', color: tokens.accent.teal };
  if (hr < 90)  return { label: '보통', color: tokens.accent.cyan };
  if (hr < 110) return { label: '상승', color: '#f59e0b' };
  return           { label: '높음', color: '#f97316' };
}

// ── Chart series builders ─────────────────────────────────
export interface DepthPoint { t: number; depth: number; hr: number | null; }
export interface RatePoint  { t: number; desc: number; asc: number; }

/**
 * Build depth+HR series for a dive, t=0 at dive start.
 */
export function buildDepthSeries(dive: DetectedDive): DepthPoint[] {
  const t0 = dive.startTime.getTime();
  return dive.records.map((r) => ({
    t:     Math.round((r.timestamp.getTime() - t0) / 1000),
    depth: parseFloat(r.depthM.toFixed(2)),
    hr:    r.heartRate,
  }));
}

/**
 * Build descent/ascent rate series for a dive, t=0 at dive start.
 */
export function buildRateSeries(dive: DetectedDive): RatePoint[] {
  const t0   = dive.startTime.getTime();
  const recs = dive.records;
  return recs.map((r, i) => {
    const t = Math.round((r.timestamp.getTime() - t0) / 1000);
    if (i === 0) return { t, desc: 0, asc: 0 };
    const prev   = recs[i - 1];
    const dt     = (r.timestamp.getTime() - prev.timestamp.getTime()) / 1000;
    const rate   = dt > 0 ? (r.depthM - prev.depthM) / dt : 0;
    return {
      t,
      desc: rate >  0.02 ? parseFloat(rate.toFixed(2)) : 0,
      asc:  rate < -0.02 ? parseFloat(Math.abs(rate).toFixed(2)) : 0,
    };
  });
}
