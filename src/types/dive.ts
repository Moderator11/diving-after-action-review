export interface DiveRecord {
  elapsedSeconds: number;
  depthM: number;
  heartRate: number | null;
  temperatureC: number | null;
  timestamp: Date;
}

export interface DiveLap {
  index: number;
  startTime: Date;
  durationSeconds: number;
  maxDepthM: number;
  avgDepthM: number;
  calories: number;
  maxHR: number | null;
  avgHR: number | null;
  isDive: boolean;
}

export interface SessionStats {
  maxDepthM: number;
  totalDives: number;
  longestDiveSeconds: number;
  maxHR: number | null;
  totalCalories: number;
  avgWaterTempC: number | null;
  sessionDate: Date;
  totalDurationSeconds: number;
}

// Generic row from any FIT message type
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type FitRow = Record<string, any>;

export interface FitMessageGroup {
  key: string;       // e.g. "recordMesgs"
  label: string;     // e.g. "Record"
  count: number;
  columns: string[];
  rows: FitRow[];
}

export interface DetectedDive {
  index: number;              // 0-based
  records: DiveRecord[];      // all records from surface entry → deep → surface exit
  startTime: Date;
  durationSeconds: number;
  maxDepthM: number;
  avgDepthM: number;
  bottomTimeSeconds: number;  // time spent at or below 2 m
  maxDescentRateMps: number;  // m/s (positive = going down)
  avgDescentRateMps: number;
  maxAscentRateMps: number;   // m/s (positive = going up)
  avgAscentRateMps: number;
  maxHR: number | null;
  avgHR: number | null;
  avgTempC: number | null;
}

// ── FIT Events ───────────────────────────────────────────
export type AlertSeverity = 'info' | 'warning' | 'danger';

export interface DiveEvent {
  timestamp: Date;
  elapsedSeconds: number;   // seconds from session start
  event: string;            // FIT event string (e.g. 'diveAlert', 'hrHighAlert')
  eventType: string;        // FIT event_type string (e.g. 'marker')
  data: number | null;      // event-specific numeric data
  label: string;            // Korean human-readable label
  severity: AlertSeverity;
  isDiveAlert: boolean;
}

export interface DiveSession {
  filename: string;
  stats: SessionStats;
  records: DiveRecord[];
  laps: DiveLap[];
  dives: DetectedDive[];
  events: DiveEvent[];
  allMessages: FitMessageGroup[];
}
