// @ts-ignore – @garmin/fitsdk ships CJS without type declarations
import { Decoder, Stream } from '@garmin/fitsdk';
import type {
  DiveSession, DiveRecord, DiveLap, SessionStats,
  FitMessageGroup, FitRow, DetectedDive,
} from '../types/dive';

/** Depth (m) that triggers "in dive" detection */
const DIVE_ONSET_M = 2.0;
/** Depth (m) considered "at surface" — dive ends when returning here */
const SURFACE_M = 0.5;

// FIT epoch offset: seconds from Unix epoch (1970-01-01) to FIT epoch (1989-12-31)
const FIT_EPOCH_OFFSET = 631065600;

// ── Known message labels ──────────────────────────────────
const KNOWN_LABELS: Record<string, string> = {
  fileIdMesgs: 'File ID',
  fileCreatorMesgs: 'File Creator',
  activityMesgs: 'Activity',
  sessionMesgs: 'Session',
  timeInZoneMesgs: 'Time in Zone',
  diveSummaryMesgs: 'Dive Summary',
  lapMesgs: 'Lap',
  splitMesgs: 'Split',
  timestampCorrelationMesgs: 'Timestamp Correlation',
  eventMesgs: 'Event',
  deviceInfoMesgs: 'Device Info',
  deviceSettingsMesgs: 'Device Settings',
  userProfileMesgs: 'User Profile',
  sportMesgs: 'Sport',
  trainingSettingsMesgs: 'Training Settings',
  zonesTargetMesgs: 'Zones Target',
  diveSettingsMesgs: 'Dive Settings',
  recordMesgs: 'Record',
};

// Numeric global message IDs that the SDK drops (vendor/undocumented)
const UNKNOWN_MSG_LABELS: Record<string, string> = {
  '22':  'Device Used',
  '79':  'User Metrics',
  '104': 'Device Status',
  '140': 'Activity Metrics',
  '141': 'CPE Status',
  '233': 'mesg 233',
  '288': 'mesg 288',
  '325': 'mesg 325',
  '326': 'GPS Event',
  '327': 'mesg 327',
  '394': 'mesg 394',
  '499': 'mesg 499',
};

function toLabel(key: string): string {
  if (KNOWN_LABELS[key]) return KNOWN_LABELS[key];
  if (UNKNOWN_MSG_LABELS[key]) return UNKNOWN_MSG_LABELS[key];
  return key
    .replace(/Mesgs$/, '')
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

/**
 * Robustly convert a FIT timestamp field to a JavaScript Date.
 *
 * The Garmin FIT SDK with `convertDateTimesToDates: false` returns raw FIT epoch
 * integers (seconds since 1989-12-31 UTC). Values in range 0 – 2e9 are treated
 * as FIT epoch seconds; larger values or ISO strings are treated as-is.
 */
function toDate(v: unknown): Date {
  if (v instanceof Date) return v;
  if (typeof v === 'number') {
    // FIT epoch seconds for 2010–2030 are roughly 0.6e9 – 1.3e9.
    // Unix milliseconds for the same period are ~ 1.2e12 – 1.9e12.
    // Threshold 2e9: anything below is FIT epoch seconds.
    return new Date((v + FIT_EPOCH_OFFSET) * 1000);
  }
  if (typeof v === 'string') {
    const n = Number(v);
    // Pure integer string that fits the FIT epoch range
    if (!isNaN(n) && /^\d+$/.test(v.trim()) && n < 2e9) {
      return new Date((n + FIT_EPOCH_OFFSET) * 1000);
    }
    return new Date(v); // ISO string
  }
  return new Date();
}

/** Convert FIT raw timestamp integer to ISO string (used for unknown message rows) */
function fitTsToIso(v: number): string {
  return new Date((v + FIT_EPOCH_OFFSET) * 1000).toISOString();
}

/** Rename numeric field keys to "field_N"; decode field 253 as timestamp */
function normalizeUnknownRow(row: FitRow): FitRow {
  const out: FitRow = {};
  for (const [k, v] of Object.entries(row)) {
    const num = Number(k);
    if (!isNaN(num)) {
      if (num === 253 && typeof v === 'number') {
        out['timestamp'] = fitTsToIso(v);
      } else {
        out[`field_${k}`] = Array.isArray(v) ? JSON.stringify(v) : v;
      }
    } else {
      out[k] = v;
    }
  }
  return out;
}

function serializeRow(row: FitRow): FitRow {
  const out: FitRow = {};
  for (const [k, v] of Object.entries(row)) {
    if (v === null || v === undefined) { out[k] = null; continue; }
    if (v instanceof Date) { out[k] = v.toISOString(); continue; }
    if (typeof v === 'bigint') { out[k] = Number(v); continue; }
    if (Array.isArray(v)) { out[k] = JSON.stringify(v); continue; }
    out[k] = v;
  }
  return out;
}

// ── Dive detection ────────────────────────────────────────

function buildDetectedDive(index: number, recs: DiveRecord[]): DetectedDive {
  const depths = recs.map((r) => r.depthM);
  const maxDepthM = Math.max(...depths);
  const avgDepthM = depths.reduce((a, b) => a + b, 0) / depths.length;
  const durationSeconds =
    (recs[recs.length - 1].timestamp.getTime() - recs[0].timestamp.getTime()) / 1000;

  // Bottom time: time spent at or below DIVE_ONSET_M
  let bottomTimeSeconds = 0;
  for (let i = 1; i < recs.length; i++) {
    if (recs[i].depthM >= DIVE_ONSET_M && recs[i - 1].depthM >= DIVE_ONSET_M) {
      bottomTimeSeconds +=
        (recs[i].timestamp.getTime() - recs[i - 1].timestamp.getTime()) / 1000;
    }
  }

  // Descent / ascent rates (m/s)
  const descentRates: number[] = [];
  const ascentRates: number[] = [];
  for (let i = 1; i < recs.length; i++) {
    const dt = (recs[i].timestamp.getTime() - recs[i - 1].timestamp.getTime()) / 1000;
    if (dt <= 0) continue;
    const dDepth = recs[i].depthM - recs[i - 1].depthM; // positive = descending
    const rateMps = dDepth / dt; // m/s
    if (rateMps >  0.02) descentRates.push(rateMps);
    else if (rateMps < -0.02) ascentRates.push(Math.abs(rateMps));
  }

  const hrs   = recs.map((r) => r.heartRate).filter((h): h is number => h !== null);
  const temps = recs.map((r) => r.temperatureC).filter((t): t is number => t !== null);
  const avg   = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;

  return {
    index,
    records: recs,
    startTime: recs[0].timestamp,
    durationSeconds: parseFloat(durationSeconds.toFixed(1)),
    maxDepthM: parseFloat(maxDepthM.toFixed(2)),
    avgDepthM: parseFloat(avgDepthM.toFixed(2)),
    bottomTimeSeconds: parseFloat(bottomTimeSeconds.toFixed(1)),
    maxDescentRateMps: descentRates.length > 0
      ? parseFloat(Math.max(...descentRates).toFixed(2)) : 0,
    avgDescentRateMps: descentRates.length > 0
      ? parseFloat(avg(descentRates).toFixed(2)) : 0,
    maxAscentRateMps: ascentRates.length > 0
      ? parseFloat(Math.max(...ascentRates).toFixed(2)) : 0,
    avgAscentRateMps: ascentRates.length > 0
      ? parseFloat(avg(ascentRates).toFixed(2)) : 0,
    maxHR:  hrs.length   > 0 ? Math.max(...hrs)         : null,
    avgHR:  hrs.length   > 0 ? Math.round(avg(hrs))     : null,
    avgTempC: temps.length > 0 ? Math.round(avg(temps)) : null,
  };
}

/**
 * Detect individual dives from the record stream.
 *
 * Algorithm:
 *   - A dive starts when depth first crosses DIVE_ONSET_M (going down).
 *   - Walk back (from onset) while current record depth > SURFACE_M,
 *     capped at the end of the previous dive to avoid overlapping.
 *     This includes the surface approach (last few records at 0m).
 *   - The dive ends when depth returns to ≤ SURFACE_M after having gone deep.
 *   - Depth oscillations that never fully resurface count as one dive.
 */
function detectDives(records: DiveRecord[]): DetectedDive[] {
  if (records.length === 0) return [];

  const dives: DetectedDive[] = [];
  let inDive    = false;
  let onsetIdx  = -1;
  let prevDiveEnd = -1; // end index of the most recently finished dive

  for (let i = 0; i < records.length; i++) {
    const d = records[i].depthM;

    if (!inDive && d >= DIVE_ONSET_M) {
      inDive   = true;
      onsetIdx = i;
    }

    if (inDive && d <= SURFACE_M) {
      // Walk back from onset to find the last near-surface record,
      // but never cross into the previous dive's territory.
      let startIdx = onsetIdx;
      while (
        startIdx > prevDiveEnd + 1 &&
        records[startIdx].depthM > SURFACE_M
      ) {
        startIdx--;
      }

      const diveRecs = records.slice(startIdx, i + 1);
      if (diveRecs.length >= 3) {
        dives.push(buildDetectedDive(dives.length, diveRecs));
      }
      prevDiveEnd = i;
      inDive   = false;
      onsetIdx = -1;
    }
  }

  // Handle a dive that never resurfaces before end of file
  if (inDive && onsetIdx >= 0) {
    let startIdx = onsetIdx;
    while (
      startIdx > prevDiveEnd + 1 &&
      records[startIdx].depthM > SURFACE_M
    ) {
      startIdx--;
    }
    const diveRecs = records.slice(startIdx);
    if (diveRecs.length >= 3) {
      dives.push(buildDetectedDive(dives.length, diveRecs));
    }
  }

  return dives;
}

// ── Main parser ───────────────────────────────────────────

export function parseFitFile(buffer: ArrayBuffer, filename: string): Promise<DiveSession> {
  return new Promise((resolve, reject) => {
    try {
      // ── Pass 1: clean decode (named fields, for chart/stats) ──
      const stream1 = Stream.fromArrayBuffer(buffer);
      const { messages, errors } = new Decoder(stream1).read({
        mergeHeartRates: false,
        expandSubFields: true,
        expandComponents: true,
        convertDateTimesToDates: false, // keep as FIT epoch integers; toDate() handles conversion
      });

      if (errors?.length) console.warn('FIT decode warnings:', errors);

      // ── Pass 2: include unknown messages (for raw display) ──
      const stream2 = Stream.fromArrayBuffer(buffer);
      const { messages: messagesAll } = new Decoder(stream2).read({
        mergeHeartRates: false,
        expandSubFields: true,
        expandComponents: true,
        includeUnknownData: true,
        convertDateTimesToDates: false,
      });

      // ── Build allMessages ────────────────────────────────────
      const allMessages: FitMessageGroup[] = [];

      for (const [key, val] of Object.entries(messages)) {
        if (!Array.isArray(val) || val.length === 0) continue;
        const rows = (val as FitRow[]).map(serializeRow);
        const columns = [...new Set(rows.flatMap((r) => Object.keys(r)))];
        allMessages.push({ key, label: toLabel(key), count: rows.length, columns, rows });
      }

      const knownKeys = new Set(Object.keys(messages));
      for (const [key, val] of Object.entries(messagesAll)) {
        if (knownKeys.has(key)) continue;
        if (!Array.isArray(val) || val.length === 0) continue;
        const rows = (val as FitRow[]).map(normalizeUnknownRow);
        const columns = [...new Set(rows.flatMap((r) => Object.keys(r)))];
        const sorted = ['timestamp', ...columns.filter((c) => c !== 'timestamp')];
        allMessages.push({
          key,
          label: toLabel(key),
          count: rows.length,
          columns: sorted.filter((c) => columns.includes(c)),
          rows,
        });
      }

      // ── Processed records for chart ───────────────────────
      const rawRecs: FitRow[] = (messages.recordMesgs as FitRow[]) ?? [];
      const sessionStartMs = rawRecs.length > 0
        ? toDate(rawRecs[0].timestamp).getTime()
        : 0;

      const records: DiveRecord[] = rawRecs.map((r) => {
        const ts = toDate(r.timestamp);
        return {
          elapsedSeconds: (ts.getTime() - sessionStartMs) / 1000,
          depthM:       typeof r.depth       === 'number' ? parseFloat(r.depth.toFixed(3))       : 0,
          heartRate:    typeof r.heartRate   === 'number' ? r.heartRate                           : null,
          temperatureC: typeof r.temperature === 'number' ? r.temperature                         : null,
          timestamp: ts,
        };
      });

      // ── FIT Laps (kept for reference / Raw Data page) ────
      const rawLaps: FitRow[] = (messages.lapMesgs as FitRow[]) ?? [];
      const laps: DiveLap[] = rawLaps.map((lap, i) => {
        const lapStart = toDate(lap.startTime);
        const lapStartMs = lapStart.getTime();
        const lapEndMs   = lapStartMs + (lap.totalElapsedTime as number) * 1000;

        const lapRecs = records.filter((r) => {
          const t = r.timestamp.getTime();
          return t >= lapStartMs && t <= lapEndMs;
        });

        const depths = lapRecs.map((r) => r.depthM);
        const hrs    = lapRecs.map((r) => r.heartRate).filter((h): h is number => h !== null);
        const maxDepthM = depths.length > 0 ? Math.max(...depths) : 0;
        const avgDepthM = depths.length > 0
          ? depths.reduce((a, b) => a + b, 0) / depths.length : 0;

        return {
          index: i,
          startTime: lapStart,
          durationSeconds: lap.totalElapsedTime as number,
          maxDepthM: parseFloat(maxDepthM.toFixed(2)),
          avgDepthM: parseFloat(avgDepthM.toFixed(2)),
          calories:  (lap.totalCalories as number) ?? 0,
          maxHR: hrs.length > 0 ? Math.max(...hrs) : null,
          avgHR: hrs.length > 0
            ? Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length) : null,
          isDive: maxDepthM > DIVE_ONSET_M,
        };
      });

      // ── Depth-based dive detection ────────────────────────
      const dives = detectDives(records);

      // ── Session stats ─────────────────────────────────────
      const rawSession: FitRow = ((messages.sessionMesgs as FitRow[]) ?? [])[0] ?? {};
      const allHRs  = records.map((r) => r.heartRate).filter((h): h is number => h !== null);
      const allTemps = records.map((r) => r.temperatureC).filter((t): t is number => t !== null);
      const maxDepthM = records.length > 0
        ? Math.max(...records.map((r) => r.depthM)) : 0;

      const stats: SessionStats = {
        maxDepthM: parseFloat(maxDepthM.toFixed(2)),
        totalDives: dives.length,
        longestDiveSeconds: dives.length > 0
          ? Math.max(...dives.map((d) => d.durationSeconds)) : 0,
        maxHR: allHRs.length > 0 ? Math.max(...allHRs) : null,
        totalCalories: (rawSession.totalCalories as number)
          ?? laps.reduce((sum, l) => sum + l.calories, 0),
        avgWaterTempC: allTemps.length > 0
          ? Math.round(allTemps.reduce((a, b) => a + b, 0) / allTemps.length) : null,
        sessionDate: rawSession.startTime
          ? toDate(rawSession.startTime) : new Date(),
        totalDurationSeconds: (rawSession.totalElapsedTime as number) ?? 0,
      };

      resolve({ filename, stats, records, laps, dives, allMessages });
    } catch (e) {
      reject(new Error(`FIT parse error: ${e instanceof Error ? e.message : String(e)}`));
    }
  });
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
  });
}
