import { useMemo } from 'react';
import { computeSpikes } from '../utils/spikes';
import type { DiveSpike } from '../utils/spikes';
import type { DetectedDive, DiveEvent, DiveRecord, DiveSession } from '../types/dive';

export interface DepthPoint { t: number; depth: number; hr: number | null; }
export interface RatePoint  { t: number; desc: number; asc: number; }
export interface TempPoint  { t: number; temp: number | null; }

interface Input {
  dive:    DetectedDive | undefined;
  session: DiveSession;
  prePad:  number;  // minutes of context before dive start
  postPad: number;  // minutes of context after dive end
  topN:    number;  // top-N spikes to detect
}

interface Output {
  spikes:      DiveSpike[];
  diveEvents:  DiveEvent[];
  depthData:   DepthPoint[];
  rateData:    RatePoint[];
  tempData:    TempPoint[];
  hasTemp:     boolean;
  maxDepth:    number;
  tempMin:     number;
  tempMax:     number;
  maxRate:     number;
  t0Ms:        number;
  diveDurSec:  number;
}

/**
 * Derives all chart-related data for a single dive page.
 * All values are memoized and only recomputed when their inputs change.
 * Accepts `dive: undefined` and returns safe empty defaults so hooks are
 * always called unconditionally (never after an early return).
 */
export function useDiveChartData({ dive, session, prePad, postPad, topN }: Input): Output {
  const t0Ms      = dive ? dive.startTime.getTime() : 0;
  const diveEndMs = dive ? dive.records[dive.records.length - 1].timestamp.getTime() : 0;
  const diveDurSec = Math.round((diveEndMs - t0Ms) / 1000);

  const spikes = useMemo(
    () => (dive ? computeSpikes(dive, topN) : []),
    [dive, topN],
  );

  const diveEvents = useMemo<DiveEvent[]>(
    () => !dive ? [] : session.events.filter((e) => {
      const t = (e.timestamp.getTime() - t0Ms) / 1000;
      return t >= -5 && t <= diveDurSec + 5; // ±5 s tolerance
    }),
    [dive, session.events, t0Ms, diveDurSec],
  );

  const extendedRecs = useMemo<DiveRecord[]>(() => {
    if (!dive) return [];
    if (prePad === 0 && postPad === 0) return dive.records;
    const from = t0Ms      - prePad  * 60_000;
    const to   = diveEndMs + postPad * 60_000;
    return session.records.filter((r) => {
      const t = r.timestamp.getTime();
      return t >= from && t <= to;
    });
  }, [dive, prePad, postPad, session.records, t0Ms, diveEndMs]);

  const depthData = useMemo<DepthPoint[]>(
    () => extendedRecs.map((r) => ({
      t:     Math.round((r.timestamp.getTime() - t0Ms) / 1000),
      depth: parseFloat(r.depthM.toFixed(2)),
      hr:    r.heartRate,
    })),
    [extendedRecs, t0Ms],
  );

  const rateData = useMemo<RatePoint[]>(
    () => extendedRecs.map((r, i) => {
      const t = Math.round((r.timestamp.getTime() - t0Ms) / 1000);
      if (i === 0) return { t, desc: 0, asc: 0 };
      const prev   = extendedRecs[i - 1];
      const dt     = (r.timestamp.getTime() - prev.timestamp.getTime()) / 1000;
      const rateMps = dt > 0 ? (r.depthM - prev.depthM) / dt : 0;
      return {
        t,
        desc: rateMps >  0.02 ? parseFloat(rateMps.toFixed(2)) : 0,
        asc:  rateMps < -0.02 ? parseFloat(Math.abs(rateMps).toFixed(2)) : 0,
      };
    }),
    [extendedRecs, t0Ms],
  );

  const tempData = useMemo<TempPoint[]>(
    () => extendedRecs
      .filter((r) => r.temperatureC !== null)
      .map((r) => ({
        t:    Math.round((r.timestamp.getTime() - t0Ms) / 1000),
        temp: r.temperatureC,
      })),
    [extendedRecs, t0Ms],
  );

  const hasTemp  = tempData.length > 0;
  const maxDepth = dive ? Math.ceil(dive.maxDepthM + 1) : 10;

  const tempMin = hasTemp
    ? Math.floor(Math.min(...tempData.map((d) => d.temp!)) - 1)
    : 0;
  const tempMax = hasTemp
    ? Math.ceil(Math.max(...tempData.map((d) => d.temp!)) + 1)
    : 40;

  const maxRate = useMemo(
    () => Math.ceil(Math.max(...rateData.map((d) => Math.max(d.desc, d.asc)), 5) / 5) * 5,
    [rateData],
  );

  return {
    spikes, diveEvents,
    depthData, rateData, tempData,
    hasTemp, maxDepth, tempMin, tempMax, maxRate,
    t0Ms, diveDurSec,
  };
}
