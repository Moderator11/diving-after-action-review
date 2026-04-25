/**
 * AIDA recommended surface interval calculator.
 *
 * Rule 1 (time-based):  surface interval ≥ 2 × dive time
 * Rule 2 (depth-based): surface interval ≥ (maxDepthM ÷ 5) minutes
 * Apply: whichever is longer.
 * Deep exception: for dives deeper than 55 m this rest period
 *   should only be counted once per 24 hours.
 */

export interface AidaResult {
  /** Rule 1 required rest: 2 × dive time (seconds) */
  byTimeSec: number;
  /** Rule 2 required rest: depth ÷ 5 minutes → seconds */
  byDepthSec: number;
  /** Final required rest = max(byTimeSec, byDepthSec) */
  requiredSec: number;
  /** Binding rule for the required value */
  bindingRule: 'time' | 'depth';
  /** True when depth > 55 m — deep dive exception applies */
  deepException: boolean;
}

/**
 * Calculate the AIDA-recommended minimum surface interval after a single dive.
 *
 * @param depthM     Maximum depth of the completed dive (metres)
 * @param diveTimeSec Total dive duration (seconds, surface-to-surface)
 */
export function calcAidaInterval(depthM: number, diveTimeSec: number): AidaResult {
  const byTimeSec  = diveTimeSec * 2;
  const byDepthSec = (depthM / 5) * 60;
  const requiredSec = Math.max(byTimeSec, byDepthSec);
  return {
    byTimeSec,
    byDepthSec,
    requiredSec,
    bindingRule: byDepthSec >= byTimeSec ? 'depth' : 'time',
    deepException: depthM > 55,
  };
}

/** Result for a single interval between two consecutive dives */
export interface IntervalCompliance {
  /** 0-based index of the dive that was just completed */
  prevDiveIdx: number;
  /** 0-based index of the next dive that started */
  nextDiveIdx: number;
  /** Actual surface interval (seconds) */
  actualSec: number;
  /** AIDA recommendation based on the completed dive */
  aida: AidaResult;
  /** True if the diver waited at least as long as required */
  passed: boolean;
  /** Shortfall in seconds when !passed, 0 when passed */
  shortfallSec: number;
}

/**
 * Compute AIDA compliance for every consecutive pair of dives in a session.
 * Returns one entry per gap (so length = dives.length - 1).
 */
export function computeSessionCompliance(
  dives: Array<{
    index: number;
    maxDepthM: number;
    durationSeconds: number;
    startTime: Date;
    records: Array<{ timestamp: Date }>;
  }>,
): IntervalCompliance[] {
  const result: IntervalCompliance[] = [];

  for (let i = 1; i < dives.length; i++) {
    const prev = dives[i - 1];
    const curr = dives[i];

    const prevEndMs  = prev.records[prev.records.length - 1].timestamp.getTime();
    const actualSec  = (curr.startTime.getTime() - prevEndMs) / 1000;
    const aida       = calcAidaInterval(prev.maxDepthM, prev.durationSeconds);
    const passed     = actualSec >= aida.requiredSec;

    result.push({
      prevDiveIdx: prev.index,
      nextDiveIdx: curr.index,
      actualSec,
      aida,
      passed,
      shortfallSec: passed ? 0 : aida.requiredSec - actualSec,
    });
  }

  return result;
}
