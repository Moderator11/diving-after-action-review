import type { DetectedDive } from '../types/dive';

// ── Types ─────────────────────────────────────────────────
export type SpikeType = 'hr' | 'descent' | 'ascent';

export interface DiveSpike {
  t: number;         // seconds from dive start
  type: SpikeType;
  value: number;     // bpm change for hr, m/s for rate
  rank: number;      // 1 = highest magnitude within its type
  label: string;     // human-readable Korean
  color: string;
}

// ── Palette ───────────────────────────────────────────────
const COLORS: Record<SpikeType, string> = {
  hr:      '#f97316',  // orange
  descent: '#eab308',  // yellow-amber (fast descent)
  ascent:  '#f43f5e',  // rose (fast ascent = safety concern)
};

// ── Main function ─────────────────────────────────────────
/**
 * Find the top-N largest instantaneous changes in HR and depth rate.
 * Candidates with t=0 or t=diveDuration are excluded (edge artefacts).
 */
export function computeSpikes(dive: DetectedDive, topN = 5): DiveSpike[] {
  const t0   = dive.startTime.getTime();
  const recs = dive.records;
  const durSec = dive.durationSeconds;

  const hrCandidates:      DiveSpike[] = [];
  const descentCandidates: DiveSpike[] = [];
  const ascentCandidates:  DiveSpike[] = [];

  for (let i = 1; i < recs.length; i++) {
    const r    = recs[i];
    const prev = recs[i - 1];
    const dtSec = (r.timestamp.getTime() - prev.timestamp.getTime()) / 1000;
    if (dtSec <= 0) continue;

    const t = (r.timestamp.getTime() - t0) / 1000;
    // Skip boundary samples
    if (t < 2 || t > durSec - 2) continue;

    // ── HR spike ─────────────────────────────────────────
    if (r.heartRate != null && prev.heartRate != null) {
      const delta = r.heartRate - prev.heartRate;
      const absDelta = Math.abs(delta);
      if (absDelta >= 5) {
        hrCandidates.push({
          t, type: 'hr',
          value: absDelta,
          rank: 0,
          label: `심박 ${delta > 0 ? '+' : ''}${delta} bpm`,
          color: COLORS.hr,
        });
      }
    }

    // ── Rate spike ───────────────────────────────────────
    const rateMps = (r.depthM - prev.depthM) / dtSec;
    if (rateMps > 0.05) {
      descentCandidates.push({
        t, type: 'descent',
        value: rateMps,
        rank: 0,
        label: `급하강 ${rateMps.toFixed(2)} m/s`,
        color: COLORS.descent,
      });
    } else if (rateMps < -0.05) {
      ascentCandidates.push({
        t, type: 'ascent',
        value: Math.abs(rateMps),
        rank: 0,
        label: `급상승 ${Math.abs(rateMps).toFixed(2)} m/s`,
        color: COLORS.ascent,
      });
    }
  }

  // ── Rank and slice ────────────────────────────────────
  function rankAndSlice(arr: DiveSpike[]): DiveSpike[] {
    return arr
      .sort((a, b) => b.value - a.value)
      .slice(0, topN)
      .map((s, i) => ({ ...s, rank: i + 1 }));
  }

  const top = [
    ...rankAndSlice(hrCandidates),
    ...rankAndSlice(descentCandidates),
    ...rankAndSlice(ascentCandidates),
  ];

  // Sort chronologically for video crossing detection
  return top.sort((a, b) => a.t - b.t);
}
