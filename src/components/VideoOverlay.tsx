import {
  useState, useRef, useCallback, useEffect, useMemo,
} from 'react';
import styled, { css, keyframes } from 'styled-components';
import { tokens } from '../styles/GlobalStyle';
import type { DetectedDive, DiveRecord, DiveEvent, AlertSeverity } from '../types/dive';
import type { DiveSpike } from '../utils/spikes';

// ── Colour tokens ─────────────────────────────────────────
const C = {
  depth:   tokens.chart.depth,
  hr:      tokens.chart.hr,
  temp:    '#a78bfa',
  descent: '#f97316',
  ascent:  '#10b981',
} as const;

// ── Types ─────────────────────────────────────────────────
interface Props {
  dive: DetectedDive;
  spikes?: DiveSpike[];
  events?: DiveEvent[];
  showEvents?:  boolean;
  showHR?:      boolean;
  showDescent?: boolean;
  showAscent?:  boolean;
}

interface AlertToastData {
  label: string;
  color: string;
  icon: string;
  id: number;
}

// Match DivePage palette: purple/violet for events
function severityColor(s: AlertSeverity): string {
  if (s === 'danger')  return '#c026d3'; // fuchsia
  if (s === 'warning') return '#7c3aed'; // violet
  return '#0ea5e9';                       // sky blue
}

// ── Helpers ───────────────────────────────────────────────
function fmtTime(s: number): string {
  if (!isFinite(s) || s < 0) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

/** Binary-search for the record nearest to `targetElapsed` (seconds from dive start) */
function findRecord(
  records: DiveRecord[],
  t0Ms: number,
  targetElapsed: number,
): DiveRecord | null {
  if (records.length === 0) return null;
  let lo = 0, hi = records.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    const e = (records[mid].timestamp.getTime() - t0Ms) / 1000;
    if (e < targetElapsed) lo = mid + 1;
    else hi = mid;
  }
  const a = records[lo];
  const b = lo > 0 ? records[lo - 1] : null;
  if (!b) return a;
  const ea = Math.abs((a.timestamp.getTime() - t0Ms) / 1000 - targetElapsed);
  const eb = Math.abs((b.timestamp.getTime() - t0Ms) / 1000 - targetElapsed);
  return ea <= eb ? a : b;
}

/** Downsample to max `maxPts` points (keep deepest in each bucket) */
function downsample(records: DiveRecord[], maxPts: number): DiveRecord[] {
  if (records.length <= maxPts) return records;
  const ratio = records.length / maxPts;
  const result: DiveRecord[] = [];
  for (let i = 0; i < maxPts; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(Math.floor((i + 1) * ratio), records.length);
    let pick = start;
    for (let j = start + 1; j < end; j++) {
      if (records[j].depthM > records[pick].depthM) pick = j;
    }
    result.push(records[pick]);
  }
  return result;
}

// ── Component ─────────────────────────────────────────────
export function VideoOverlay({
  dive, spikes = [], events = [],
  showEvents = true, showHR = true, showDescent = true, showAscent = true,
}: Props) {
  const [videoUrl, setVideoUrl]     = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isPlaying, setIsPlaying]   = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration]     = useState(0);
  /** videoRatio: width / height. < 1 = portrait, >= 1 = landscape */
  const [videoRatio, setVideoRatio] = useState<number>(16 / 9);
  const [isFullscreen, setIsFullscreen] = useState(false);
  /** syncOffset: video_time − syncOffset = data_elapsed_seconds */
  const [syncOffset, setSyncOffset] = useState(0);
  /** Which chart to show in the fullscreen side panel */
  type ChartType = 'depth' | 'hr' | 'rate' | 'temp';
  const [chartType, setChartType] = useState<ChartType>('depth');
  /** Fullscreen panel position (drag) */
  const [panelPos, setPanelPos] = useState({ x: 14, y: 14 });

  const videoRef         = useRef<HTMLVideoElement>(null);
  const seekRef          = useRef<HTMLInputElement>(null);
  const wrapRef          = useRef<HTMLDivElement>(null);
  const isPanelDrag      = useRef(false);
  const panelDragStart   = useRef({ mx: 0, my: 0, px: 0, py: 0 });
  const prevDataElapsed  = useRef<number>(NaN);
  const alertTimers      = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const alertIdRef       = useRef(0);

  const [alertQueue, setAlertQueue] = useState<AlertToastData[]>([]);

  // Cleanup all timers on unmount
  useEffect(() => () => { alertTimers.current.forEach(clearTimeout); }, []);

  // ── Derived ──────────────────────────────────────────────
  const t0Ms = useMemo(
    () => (dive.records.length > 0 ? dive.records[0].timestamp.getTime() : 0),
    [dive],
  );

  const diveDuration = useMemo(() => {
    if (dive.records.length < 2) return 0;
    return (dive.records[dive.records.length - 1].timestamp.getTime() - t0Ms) / 1000;
  }, [dive.records, t0Ms]);

  const dataElapsed = currentTime - syncOffset;

  const dataStatus: 'before' | 'active' | 'after' =
    dataElapsed < 0            ? 'before'
    : dataElapsed > diveDuration ? 'after'
    : 'active';

  const currentRecord = useMemo<DiveRecord | null>(() => {
    if (dataStatus !== 'active') return null;
    return findRecord(dive.records, t0Ms, dataElapsed);
  }, [dive.records, t0Ms, dataElapsed, dataStatus]);

  const currentRateMps = useMemo(() => {
    if (!currentRecord) return 0;
    const idx = dive.records.indexOf(currentRecord);
    if (idx <= 0) return 0;
    const prev = dive.records[idx - 1];
    const dt = (currentRecord.timestamp.getTime() - prev.timestamp.getTime()) / 1000;
    return dt > 0 ? (currentRecord.depthM - prev.depthM) / dt : 0;
  }, [currentRecord, dive.records]);

  // Sync slider label
  const syncLabel =
    syncOffset === 0 ? '동기화 없음 (슬라이더로 조정)'
    : syncOffset > 0
      ? `영상이 데이터보다 ${syncOffset.toFixed(1)}초 먼저 시작`
      : `데이터가 영상보다 ${(-syncOffset).toFixed(1)}초 먼저 시작`;

  // ── Alert crossing detection (queue-based) ───────────────
  useEffect(() => {
    const prev = prevDataElapsed.current;
    const curr = dataElapsed;
    prevDataElapsed.current = curr;

    // Only fire when playing forward in active range
    if (!isFinite(prev) || curr <= prev || curr < 0 || curr > diveDuration) return;

    function enqueue(label: string, color: string, icon: string) {
      const id = ++alertIdRef.current;
      setAlertQueue((q) => [...q, { label, color, icon, id }]);
      const timer = setTimeout(() => {
        setAlertQueue((q) => q.filter((a) => a.id !== id));
        alertTimers.current.delete(id);
      }, 4000);
      alertTimers.current.set(id, timer);
    }

    // Collect ALL triggered items in this frame (events + spikes)
    // Events (FIT device confirmed) shown first — only if showEvents is on
    if (showEvents) {
      for (const evt of events) {
        const t = (evt.timestamp.getTime() - dive.startTime.getTime()) / 1000;
        if (t > prev && t <= curr) {
          const icon = evt.severity === 'danger' ? '🟣'
            : evt.severity === 'warning' ? '🔷' : '📋';
          enqueue(evt.label, severityColor(evt.severity), icon);
        }
      }
    }

    // Then spikes — filtered by type toggles
    for (const sp of spikes) {
      if (sp.t > prev && sp.t <= curr) {
        const visible =
          (sp.type === 'hr'      && showHR)      ||
          (sp.type === 'descent' && showDescent) ||
          (sp.type === 'ascent'  && showAscent);
        if (!visible) continue;
        const icon = sp.type === 'hr' ? '❤️' : sp.type === 'descent' ? '↓' : '↑';
        enqueue(sp.label, sp.color, icon);
      }
    }
  }, [dataElapsed]); // intentionally minimal deps

  // ── SVG depth chart paths ────────────────────────────────
  const svgPaths = useMemo(() => {
    const recs = dive.records;
    if (recs.length < 2) return { line: '', area: '' };
    const maxD    = Math.max(dive.maxDepthM, 0.01);
    const totalDur = diveDuration || 1;
    const pts     = downsample(recs, 600);

    const coords = pts.map(r => {
      const elapsed = (r.timestamp.getTime() - t0Ms) / 1000;
      const x = (elapsed / totalDur) * 1000;
      const y = (r.depthM / maxD) * 100;
      return [x, y] as [number, number];
    });

    const lineD = coords
      .map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`)
      .join(' ');

    // Area: from y=0 (surface) down to profile, then close back to y=0
    const first = coords[0];
    const last  = coords[coords.length - 1];
    const areaD =
      `M ${first[0].toFixed(1)} 0 ` +
      coords.map(([x, y]) => `L ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ') +
      ` L ${last[0].toFixed(1)} 0 Z`;

    return { line: lineD, area: areaD };
  }, [dive.records, dive.maxDepthM, diveDuration, t0Ms]);

  /** SVG coordinates of the animated position dot */
  const svgDotPos = useMemo(() => {
    if (!currentRecord) return null;
    const maxD    = Math.max(dive.maxDepthM, 0.01);
    const totalDur = diveDuration || 1;
    const elapsed = (currentRecord.timestamp.getTime() - t0Ms) / 1000;
    return {
      cx: (elapsed / totalDur) * 1000,
      cy: (currentRecord.depthM / maxD) * 100,
    };
  }, [currentRecord, dive.maxDepthM, diveDuration, t0Ms]);

  // ── SVG spike marker positions (for bottom panel chart) ──
  const svgSpikeMarkers = useMemo(() => {
    if (!diveDuration) return [];
    return spikes
      .filter((s) =>
        (s.type === 'descent' && showDescent) ||
        (s.type === 'ascent'  && showAscent)
      )
      .map((s) => ({
        cx:   (s.t / diveDuration) * 1000,
        color: s.color,
        rank:  s.rank,
      }));
  }, [spikes, diveDuration, showDescent, showAscent]);

  // ── Drag & drop ──────────────────────────────────────────
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as HTMLElement)) {
      setIsDragOver(false);
    }
  }, []);

  const loadVideo = useCallback((file: File) => {
    if (!file.type.startsWith('video/')) return;
    setVideoUrl(prev => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setCurrentTime(0);
    setIsPlaying(false);
    setSyncOffset(0);
    setVideoRatio(16 / 9); // reset until metadata loads
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) loadVideo(file);
  }, [loadVideo]);

  // ── Fullscreen ───────────────────────────────────────────
  const toggleFullscreen = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen().catch(console.error);
    } else {
      document.exitFullscreen();
    }
  }, []);

  useEffect(() => {
    const onFsChange = () => {
      const entering = !!document.fullscreenElement;
      setIsFullscreen(entering);
      if (entering) setPanelPos({ x: 14, y: 14 }); // reset position on each entry
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // ── Panel drag ───────────────────────────────────────────
  const onPanelMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isPanelDrag.current = true;
    panelDragStart.current = {
      mx: e.clientX, my: e.clientY,
      px: panelPos.x, py: panelPos.y,
    };
  }, [panelPos]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isPanelDrag.current) return;
      setPanelPos({
        x: panelDragStart.current.px + e.clientX - panelDragStart.current.mx,
        y: panelDragStart.current.py + e.clientY - panelDragStart.current.my,
      });
    };
    const onUp = () => { isPanelDrag.current = false; };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, []);

  // ── Panel chart path (switches with chartType) ───────────
  const panelChart = useMemo(() => {
    const recs = dive.records;
    if (recs.length < 2) return { line: '', area: '', color: C.depth };
    const totalDur = diveDuration || 1;

    type Pt = [number, number]; // [svgX, svgY]
    const coords: Pt[] = [];
    let color: string = C.depth;
    let baseY = 0; // area closes back to this Y

    if (chartType === 'depth') {
      const maxD = Math.max(dive.maxDepthM, 0.01);
      color = C.depth; baseY = 0;
      for (const r of downsample(recs, 600)) {
        const x = ((r.timestamp.getTime() - t0Ms) / 1000 / totalDur) * 1000;
        coords.push([x, (r.depthM / maxD) * 100]);
      }
    } else if (chartType === 'hr') {
      const maxHR = Math.max(dive.maxHR ?? 1, 1);
      color = C.hr; baseY = 100;
      for (const r of downsample(recs, 600)) {
        if (r.heartRate == null) continue;
        const x = ((r.timestamp.getTime() - t0Ms) / 1000 / totalDur) * 1000;
        coords.push([x, 100 - (r.heartRate / maxHR) * 100]);
      }
    } else if (chartType === 'rate') {
      const maxRate = Math.max(dive.maxDescentRateMps, dive.maxAscentRateMps, 0.02);
      color = C.descent; baseY = 100;
      for (let i = 1; i < recs.length; i++) {
        const r = recs[i], prev = recs[i - 1];
        const dt = (r.timestamp.getTime() - prev.timestamp.getTime()) / 1000;
        if (dt <= 0) continue;
        const rate = Math.abs((r.depthM - prev.depthM) / dt);
        const x = ((r.timestamp.getTime() - t0Ms) / 1000 / totalDur) * 1000;
        coords.push([x, 100 - Math.min((rate / maxRate) * 100, 100)]);
      }
    } else {
      // temp
      const temps = recs.filter(r => r.temperatureC != null).map(r => r.temperatureC as number);
      if (temps.length === 0) return { line: '', area: '', color: C.temp };
      const minT = temps.reduce((a, b) => Math.min(a, b), Infinity);
      const maxT = temps.reduce((a, b) => Math.max(a, b), -Infinity);
      const range = Math.max(maxT - minT, 0.1);
      color = C.temp; baseY = 100;
      for (const r of downsample(recs, 600)) {
        if (r.temperatureC == null) continue;
        const x = ((r.timestamp.getTime() - t0Ms) / 1000 / totalDur) * 1000;
        coords.push([x, 100 - ((r.temperatureC - minT) / range) * 100]);
      }
    }

    if (coords.length < 2) return { line: '', area: '', color };
    const line = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
    const area = `M ${coords[0][0].toFixed(1)} ${baseY} `
      + coords.map(([x, y]) => `L ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
      + ` L ${coords[coords.length - 1][0].toFixed(1)} ${baseY} Z`;
    return { line, area, color };
  }, [chartType, dive, diveDuration, t0Ms]);

  // Dot position for the panel chart
  const panelDot = useMemo(() => {
    if (!currentRecord) return null;
    const totalDur = diveDuration || 1;
    const elapsed = (currentRecord.timestamp.getTime() - t0Ms) / 1000;
    const cx = (elapsed / totalDur) * 1000;
    let cy = 50;

    if (chartType === 'depth') {
      cy = (currentRecord.depthM / Math.max(dive.maxDepthM, 0.01)) * 100;
    } else if (chartType === 'hr') {
      if (currentRecord.heartRate == null) return null;
      cy = 100 - (currentRecord.heartRate / Math.max(dive.maxHR ?? 1, 1)) * 100;
    } else if (chartType === 'rate') {
      const idx = dive.records.indexOf(currentRecord);
      if (idx <= 0) return null;
      const prev = dive.records[idx - 1];
      const dt = (currentRecord.timestamp.getTime() - prev.timestamp.getTime()) / 1000;
      const rate = dt > 0 ? Math.abs((currentRecord.depthM - prev.depthM) / dt) : 0;
      const maxRate = Math.max(dive.maxDescentRateMps, dive.maxAscentRateMps, 0.02);
      cy = 100 - Math.min((rate / maxRate) * 100, 100);
    } else {
      if (currentRecord.temperatureC == null) return null;
      const temps = dive.records.filter(r => r.temperatureC != null).map(r => r.temperatureC as number);
      const minT = temps.reduce((a, b) => Math.min(a, b), Infinity);
      const maxT = temps.reduce((a, b) => Math.max(a, b), -Infinity);
      cy = 100 - ((currentRecord.temperatureC - minT) / Math.max(maxT - minT, 0.1)) * 100;
    }
    return { cx, cy: Math.max(0, Math.min(100, cy)) };
  }, [chartType, currentRecord, dive, diveDuration, t0Ms]);

  // ── Playback ─────────────────────────────────────────────
  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play(); else v.pause();
  }, []);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const t = parseFloat(e.target.value);
    if (videoRef.current) videoRef.current.currentTime = t;
    setCurrentTime(t);
  }, []);

  // Keyboard shortcuts: Space = play/pause, F = fullscreen
  useEffect(() => {
    if (!videoUrl) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
      if (e.code === 'KeyF')  { e.preventDefault(); toggleFullscreen(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [videoUrl, togglePlay, toggleFullscreen]);

  // Cleanup blob URL on unmount
  useEffect(() => () => { if (videoUrl) URL.revokeObjectURL(videoUrl); }, []); // eslint-disable-line

  // Sync seek slider fill via CSS variable
  useEffect(() => {
    if (!seekRef.current || duration === 0) return;
    seekRef.current.style.setProperty('--pct', `${(currentTime / duration) * 100}%`);
  }, [currentTime, duration]);

  const isPortrait = videoRatio < 1;

  // ── Render ───────────────────────────────────────────────
  return (
    <Wrapper>
      {/* Header */}
      <CardHeader>
        <HeaderLeft>
          <span style={{ fontSize: 16 }}>🎬</span>
          <CardTitle>영상 오버레이</CardTitle>
        </HeaderLeft>
        {videoUrl && (
          <RemoveBtn onClick={() => {
            URL.revokeObjectURL(videoUrl);
            setVideoUrl(null);
            setCurrentTime(0);
            setSyncOffset(0);
          }}>
            ✕ 영상 제거
          </RemoveBtn>
        )}
      </CardHeader>

      {/* Drop zone */}
      {!videoUrl ? (
        <DropZone
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          $active={isDragOver}
        >
          <DropEmoji $pulse={isDragOver}>🎬</DropEmoji>
          <DropTitle>영상 파일을 여기에 드래그하세요</DropTitle>
          <DropSub>MP4 · MOV · AVI · MKV 등 지원</DropSub>
        </DropZone>
      ) : (
        <PlayerArea>
          {/* ── Video + data overlay ── */}
          <VideoWrapCenter>
            <VideoWrap
              ref={wrapRef}
              $ratio={videoRatio}
              $portrait={isPortrait}
              $isFs={isFullscreen}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              $dragOver={isDragOver}
            >
              <VideoEl
                ref={videoRef}
                src={videoUrl}
                onClick={togglePlay}
                onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime ?? 0)}
                onLoadedMetadata={() => {
                  const v = videoRef.current;
                  if (!v) return;
                  setDuration(v.duration);
                  if (v.videoWidth > 0 && v.videoHeight > 0) {
                    setVideoRatio(v.videoWidth / v.videoHeight);
                  }
                }}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => setIsPlaying(false)}
              />

              {/* ── Normal mode: wide bottom gradient panel ── */}
              {!isFullscreen && (
                <BottomPanel>
                  <MetricsRow>
                    <Metric>
                      <MLabel>수심</MLabel>
                      <MValueRow>
                        <MValue $c={C.depth}>
                          {currentRecord ? currentRecord.depthM.toFixed(1) : '--'}
                        </MValue>
                        <MUnit>m</MUnit>
                      </MValueRow>
                    </Metric>
                    <MDivider />
                    <Metric>
                      <MLabel>
                        {currentRecord && Math.abs(currentRateMps) > 0.05
                          ? currentRateMps > 0 ? '↓ 하강' : '↑ 상승'
                          : '속도'}
                      </MLabel>
                      <MValueRow>
                        <MValue $c={
                          !currentRecord           ? 'rgba(255,255,255,0.35)'
                          : currentRateMps > 0.05  ? C.descent
                          : currentRateMps < -0.05 ? C.ascent
                          : 'rgba(255,255,255,0.7)'
                        }>
                          {currentRecord ? Math.abs(currentRateMps).toFixed(2) : '--'}
                        </MValue>
                        <MUnit>m/s</MUnit>
                      </MValueRow>
                    </Metric>
                    {dive.maxHR !== null && (
                      <>
                        <MDivider />
                        <Metric>
                          <MLabel>심박수</MLabel>
                          <MValueRow>
                            <MValue $c={C.hr}>
                              {currentRecord?.heartRate != null ? currentRecord.heartRate : '--'}
                            </MValue>
                            <MUnit>bpm</MUnit>
                          </MValueRow>
                        </Metric>
                      </>
                    )}
                    {dive.avgTempC !== null && (
                      <>
                        <MDivider />
                        <Metric>
                          <MLabel>수온</MLabel>
                          <MValueRow>
                            <MValue $c={C.temp}>
                              {currentRecord?.temperatureC != null
                                ? currentRecord.temperatureC.toFixed(1) : '--'}
                            </MValue>
                            <MUnit>°C</MUnit>
                          </MValueRow>
                        </Metric>
                      </>
                    )}
                  </MetricsRow>
                  <ChartSvg viewBox="0 0 1000 100" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="dg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={C.depth} stopOpacity="0.4" />
                        <stop offset="100%" stopColor={C.depth} stopOpacity="0.04" />
                      </linearGradient>
                    </defs>
                    {svgPaths.area && <path d={svgPaths.area} fill="url(#dg)" />}
                    {svgPaths.line && (
                      <path d={svgPaths.line} fill="none" stroke={C.depth}
                        strokeWidth="2" vectorEffect="non-scaling-stroke" />
                    )}
                    {/* Descent/ascent spike tick marks */}
                    {svgSpikeMarkers.map((m) => (
                      <line key={m.cx}
                        x1={m.cx} y1={0} x2={m.cx} y2={100}
                        stroke={m.color} strokeWidth={m.rank === 1 ? '2' : '1.2'}
                        strokeDasharray="4 3"
                        opacity={m.rank === 1 ? 0.9 : 0.55}
                        vectorEffect="non-scaling-stroke" />
                    ))}
                    {/* HR spike tick marks */}
                    {showHR && spikes
                      .filter((s) => s.type === 'hr')
                      .map((s) => {
                        const cx = diveDuration ? (s.t / diveDuration) * 1000 : 0;
                        return (
                          <line key={`hr-${cx}`}
                            x1={cx} y1={0} x2={cx} y2={100}
                            stroke={s.color} strokeWidth={s.rank === 1 ? '2' : '1.2'}
                            strokeDasharray="4 3"
                            opacity={s.rank === 1 ? 0.9 : 0.55}
                            vectorEffect="non-scaling-stroke" />
                        );
                      })}
                    {/* Event markers (diveAlert etc.) — only when showEvents is on */}
                    {showEvents && events.map((e) => {
                      const cx = diveDuration
                        ? ((e.timestamp.getTime() - dive.startTime.getTime()) / 1000 / diveDuration) * 1000
                        : 0;
                      if (cx < 0 || cx > 1000) return null;
                      const col = severityColor(e.severity);
                      return (
                        <line key={cx}
                          x1={cx} y1={0} x2={cx} y2={100}
                          stroke={col} strokeWidth="2.5" strokeDasharray="5 3"
                          opacity={0.95} vectorEffect="non-scaling-stroke" />
                      );
                    })}
                    {svgDotPos && (
                      <circle cx={svgDotPos.cx} cy={svgDotPos.cy} r="6"
                        fill={C.depth} stroke="rgba(255,255,255,0.9)"
                        strokeWidth="2" vectorEffect="non-scaling-stroke"
                        style={{ transition: 'cx 0.25s ease-out, cy 0.25s ease-out' }} />
                    )}
                  </ChartSvg>
                </BottomPanel>
              )}

              {/* ── Fullscreen mode: draggable side panel ── */}
              {isFullscreen && (
                <FsSidePanel style={{ left: panelPos.x, top: panelPos.y }}>

                  {/* Drag handle + elapsed time */}
                  <FsPanelHandle onMouseDown={onPanelMouseDown}>
                    <FsElapsed>
                      {dataStatus === 'active'
                        ? `⏱ ${fmtTime(Math.max(0, dataElapsed))}`
                        : dataStatus === 'before' ? '대기 중' : '완료'}
                    </FsElapsed>
                    <FsDragGrip>⠿</FsDragGrip>
                  </FsPanelHandle>

                  <FsPanelDivider />

                  {/* Metrics 2 × 2 grid */}
                  <FsMetricsGrid $cols={dive.maxHR !== null || dive.avgTempC !== null ? 2 : 1}>
                    <FsMetricCell>
                      <MLabel>수심</MLabel>
                      <MValueRow>
                        <MValue $c={C.depth} style={{ fontSize: 26 }}>
                          {currentRecord ? currentRecord.depthM.toFixed(1) : '--'}
                        </MValue>
                        <MUnit>m</MUnit>
                      </MValueRow>
                    </FsMetricCell>
                    <FsMetricCell>
                      <MLabel>
                        {currentRecord && Math.abs(currentRateMps) > 0.05
                          ? currentRateMps > 0 ? '↓ 하강' : '↑ 상승' : '속도'}
                      </MLabel>
                      <MValueRow>
                        <MValue $c={
                          !currentRecord           ? 'rgba(255,255,255,0.35)'
                          : currentRateMps > 0.05  ? C.descent
                          : currentRateMps < -0.05 ? C.ascent
                          : 'rgba(255,255,255,0.7)'
                        } style={{ fontSize: 26 }}>
                          {currentRecord ? Math.abs(currentRateMps).toFixed(2) : '--'}
                        </MValue>
                        <MUnit>m/s</MUnit>
                      </MValueRow>
                    </FsMetricCell>
                    {dive.maxHR !== null && (
                      <FsMetricCell>
                        <MLabel>심박수</MLabel>
                        <MValueRow>
                          <MValue $c={C.hr} style={{ fontSize: 26 }}>
                            {currentRecord?.heartRate != null ? currentRecord.heartRate : '--'}
                          </MValue>
                          <MUnit>bpm</MUnit>
                        </MValueRow>
                      </FsMetricCell>
                    )}
                    {dive.avgTempC !== null && (
                      <FsMetricCell>
                        <MLabel>수온</MLabel>
                        <MValueRow>
                          <MValue $c={C.temp} style={{ fontSize: 26 }}>
                            {currentRecord?.temperatureC != null
                              ? currentRecord.temperatureC.toFixed(1) : '--'}
                          </MValue>
                          <MUnit>°C</MUnit>
                        </MValueRow>
                      </FsMetricCell>
                    )}
                  </FsMetricsGrid>

                  <FsPanelDivider />

                  {/* Chart type tabs */}
                  <FsChartTabs>
                    <FsChartTab $active={chartType === 'depth'} $c={C.depth}
                      onClick={() => setChartType('depth')}>수심</FsChartTab>
                    <FsChartTab $active={chartType === 'rate'} $c={C.descent}
                      onClick={() => setChartType('rate')}>속도</FsChartTab>
                    {dive.maxHR !== null && (
                      <FsChartTab $active={chartType === 'hr'} $c={C.hr}
                        onClick={() => setChartType('hr')}>심박</FsChartTab>
                    )}
                    {dive.avgTempC !== null && (
                      <FsChartTab $active={chartType === 'temp'} $c={C.temp}
                        onClick={() => setChartType('temp')}>수온</FsChartTab>
                    )}
                  </FsChartTabs>

                  {/* Switchable chart */}
                  <FsPanelChartSvg viewBox="0 0 1000 100" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="dg-fs" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={panelChart.color} stopOpacity="0.45" />
                        <stop offset="100%" stopColor={panelChart.color} stopOpacity="0.04" />
                      </linearGradient>
                    </defs>
                    {panelChart.area && <path d={panelChart.area} fill="url(#dg-fs)" />}
                    {panelChart.line && (
                      <path d={panelChart.line} fill="none" stroke={panelChart.color}
                        strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
                    )}
                    {/* Descent/ascent spike markers on depth & rate charts */}
                    {(chartType === 'depth' || chartType === 'rate') && svgSpikeMarkers.map((m) => (
                      <line key={`fs-sp-${m.cx}`}
                        x1={m.cx} y1={0} x2={m.cx} y2={100}
                        stroke={m.color}
                        strokeWidth={m.rank === 1 ? '2' : '1.2'}
                        strokeDasharray="4 3"
                        opacity={m.rank === 1 ? 0.9 : 0.55}
                        vectorEffect="non-scaling-stroke" />
                    ))}
                    {/* HR spike markers on depth chart (same as main page) */}
                    {chartType === 'depth' && showHR && spikes
                      .filter((s) => s.type === 'hr')
                      .map((s) => {
                        const cx = diveDuration ? (s.t / diveDuration) * 1000 : 0;
                        return (
                          <line key={`fs-hr-${cx}`}
                            x1={cx} y1={0} x2={cx} y2={100}
                            stroke={s.color}
                            strokeWidth={s.rank === 1 ? '2' : '1.2'}
                            strokeDasharray="4 3"
                            opacity={s.rank === 1 ? 0.9 : 0.55}
                            vectorEffect="non-scaling-stroke" />
                        );
                      })}
                    {/* FIT event markers on all chart types */}
                    {showEvents && events.map((e) => {
                      const cx = diveDuration
                        ? ((e.timestamp.getTime() - dive.startTime.getTime()) / 1000 / diveDuration) * 1000
                        : 0;
                      if (cx < 0 || cx > 1000) return null;
                      const col = severityColor(e.severity);
                      return (
                        <line key={`fs-evt-${cx}`}
                          x1={cx} y1={0} x2={cx} y2={100}
                          stroke={col} strokeWidth="2.5" strokeDasharray="5 3"
                          opacity={0.95} vectorEffect="non-scaling-stroke" />
                      );
                    })}
                    {panelDot && (
                      <circle cx={panelDot.cx} cy={panelDot.cy} r="7"
                        fill={panelChart.color} stroke="rgba(255,255,255,0.9)"
                        strokeWidth="2.5" vectorEffect="non-scaling-stroke"
                        style={{ transition: 'cx 0.25s ease-out, cy 0.25s ease-out' }} />
                    )}
                  </FsPanelChartSvg>
                </FsSidePanel>
              )}

              {/* Status badge (out-of-range) */}
              {dataStatus === 'before' && (
                <StatusBadge>
                  ⏳ 다이브 시작까지 {Math.abs(dataElapsed).toFixed(0)}초
                </StatusBadge>
              )}
              {dataStatus === 'after' && (
                <StatusBadge $done>✓ 다이브 완료</StatusBadge>
              )}

              {/* Play/pause overlay */}
              <PlayOverlay $show={!isPlaying} onClick={togglePlay}>
                <PlayIconWrap>▶</PlayIconWrap>
              </PlayOverlay>

              {/* Drag-to-replace overlay */}
              {isDragOver && (
                <DragReplaceOverlay>
                  <span style={{ fontSize: 32 }}>🎬</span>
                  <span style={{ fontSize: 14, color: tokens.text.secondary }}>영상 교체</span>
                </DragReplaceOverlay>
              )}

              {/* Alert toast queue — stacks above the bottom metrics panel */}
              {alertQueue.length > 0 && (
                <AlertToastStack>
                  {alertQueue.map((a) => (
                    <AlertToastEl key={a.id} $c={a.color}>
                      <AlertToastIcon>{a.icon}</AlertToastIcon>
                      <AlertToastLabel>{a.label}</AlertToastLabel>
                    </AlertToastEl>
                  ))}
                </AlertToastStack>
              )}

              {/* Corner fullscreen toggle (always visible on hover) */}
              <FsCornerBtn className="fs-corner-btn" onClick={toggleFullscreen} title={isFullscreen ? '전체화면 종료 (F)' : '전체화면 (F)'}>
                {isFullscreen ? '⊡' : '⛶'}
              </FsCornerBtn>

              {/* Fullscreen-only seek/control bar (sits above BottomPanel) */}
              {isFullscreen && (
                <FsControlsBar>
                  <FsPlayBtn onClick={togglePlay}>{isPlaying ? '⏸' : '▶'}</FsPlayBtn>
                  <FsTimeLabel>{fmtTime(currentTime)}</FsTimeLabel>
                  <FsSeekWrap>
                    <FsSeekInput
                      type="range"
                      min={0}
                      max={duration || 0}
                      step={0.033}
                      value={currentTime}
                      onChange={handleSeek}
                      style={{
                        '--pct': `${duration > 0 ? (currentTime / duration) * 100 : 0}%`,
                      } as React.CSSProperties}
                    />
                  </FsSeekWrap>
                  <FsTimeLabel>{fmtTime(duration)}</FsTimeLabel>
                  <FsExitBtn onClick={toggleFullscreen} title="전체화면 종료 (F / Esc)">✕</FsExitBtn>
                </FsControlsBar>
              )}

              {/* Timeline bar at very bottom */}
              <VideoTimeline>
                {duration > 0 && (
                  <DataRangeBar style={{
                    left:  `${Math.max(0, syncOffset / duration) * 100}%`,
                    width: `${Math.min(
                      diveDuration / duration,
                      1 - Math.max(0, syncOffset / duration),
                    ) * 100}%`,
                  }} />
                )}
                <TimelineFill style={{
                  width: duration > 0 ? `${(currentTime / duration) * 100}%` : '0%',
                }} />
              </VideoTimeline>
            </VideoWrap>
          </VideoWrapCenter>

          {/* ── Playback controls ── */}
          <Controls>
            <PlayBtn onClick={togglePlay} title="재생 / 일시정지 (Space)">
              {isPlaying ? '⏸' : '▶'}
            </PlayBtn>
            <TimeLbl>{fmtTime(currentTime)}</TimeLbl>
            <SeekTrack>
              <SeekInput
                ref={seekRef}
                type="range"
                min={0}
                max={duration || 0}
                step={0.033}
                value={currentTime}
                onChange={handleSeek}
                style={{ '--pct': '0%' } as React.CSSProperties}
              />
            </SeekTrack>
            <TimeLbl $dim>{fmtTime(duration)}</TimeLbl>
            <FsToggleBtn onClick={toggleFullscreen} title="전체화면 (F)">⛶</FsToggleBtn>
          </Controls>

          {/* ── Sync panel ── */}
          <SyncBox>
            <SyncHeader>
              <SyncTitle>⚙️ 타임스탬프 동기화</SyncTitle>
              <SyncBadge $active={syncOffset !== 0}>{syncLabel}</SyncBadge>
              {syncOffset !== 0 && (
                <ResetBtn onClick={() => setSyncOffset(0)}>↺ 초기화</ResetBtn>
              )}
            </SyncHeader>

            <SyncSliderRow>
              <SyncEndLbl>−5분</SyncEndLbl>
              <SyncInput
                type="range"
                min={-300}
                max={300}
                step={0.5}
                value={syncOffset}
                onChange={e => setSyncOffset(parseFloat(e.target.value))}
                style={{ '--pct': `${((syncOffset + 300) / 600) * 100}%` } as React.CSSProperties}
              />
              <SyncEndLbl>+5분</SyncEndLbl>
            </SyncSliderRow>

            <SyncViz>
              <SyncTrack>
                <SyncTrackLabel>🎬 영상</SyncTrackLabel>
                <SyncBar $color={tokens.accent.cyan}>
                  <SyncBarInner style={{
                    marginLeft: `${syncOffset > 0 ? (syncOffset / Math.max(diveDuration + Math.abs(syncOffset), 1)) * 100 : 0}%`,
                    width: `${(Math.max(duration, 0) / Math.max(duration + Math.abs(syncOffset), 1)) * 100}%`,
                  }} $color={tokens.accent.cyan} />
                </SyncBar>
              </SyncTrack>
              <SyncTrack>
                <SyncTrackLabel>🤿 데이터</SyncTrackLabel>
                <SyncBar $color={tokens.accent.teal}>
                  <SyncBarInner style={{
                    marginLeft: `${syncOffset < 0 ? ((-syncOffset) / Math.max(diveDuration + Math.abs(syncOffset), 1)) * 100 : 0}%`,
                    width: `${(diveDuration / Math.max(duration + Math.abs(syncOffset), 1)) * 100}%`,
                  }} $color={tokens.accent.teal} />
                </SyncBar>
              </SyncTrack>
            </SyncViz>

            <SyncHint>
              영상 속 특정 장면(예: 입수 순간)에서 일시정지 후,
              슬라이더로 데이터 시작 시점을 맞추세요.
            </SyncHint>
          </SyncBox>
        </PlayerArea>
      )}
    </Wrapper>
  );
}

// ── Animations ────────────────────────────────────────────
const pulse = keyframes`
  0%, 100% { transform: scale(1); }
  50%       { transform: scale(1.15); }
`;

const slideIn = keyframes`
  from { opacity: 0; transform: translateY(-8px) scale(0.96); }
  to   { opacity: 1; transform: translateY(0)   scale(1);    }
`;

const fadeOut = keyframes`
  0%   { opacity: 1; }
  70%  { opacity: 1; }
  100% { opacity: 0; }
`;

// ── Styled Components ─────────────────────────────────────
const Wrapper = styled.div`
  background: ${tokens.bg.surface};
  border: 1px solid ${tokens.border.subtle};
  border-radius: ${tokens.radius.lg};
  padding: 20px 24px;
  width: 100%;
`;

const CardHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
`;

const HeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const CardTitle = styled.h2`
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: ${tokens.text.secondary};
`;

const RemoveBtn = styled.button`
  font-size: 11px;
  color: ${tokens.text.muted};
  background: ${tokens.bg.elevated};
  border: 1px solid ${tokens.border.subtle};
  border-radius: ${tokens.radius.sm};
  padding: 4px 10px;
  transition: all 0.15s;
  &:hover { color: ${tokens.accent.danger}; border-color: ${tokens.accent.danger}33; }
`;

/* ── Drop zone ── */
const DropZone = styled.div<{ $active: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  height: 180px;
  border: 2px dashed ${({ $active }) => $active ? tokens.accent.cyan : tokens.border.default};
  border-radius: ${tokens.radius.lg};
  background: ${({ $active }) => $active ? `${tokens.accent.cyan}0a` : tokens.bg.elevated};
  transition: all 0.2s;
`;

const DropEmoji = styled.div<{ $pulse: boolean }>`
  font-size: 40px;
  line-height: 1;
  ${({ $pulse }) => $pulse && css`animation: ${pulse} 0.8s ease infinite;`}
`;

const DropTitle = styled.div`
  font-size: 14px;
  font-weight: 600;
  color: ${tokens.text.secondary};
`;

const DropSub = styled.div`
  font-size: 12px;
  color: ${tokens.text.muted};
`;

/* ── Player layout ── */
const PlayerArea = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

/** Outer wrapper that centres portrait videos */
const VideoWrapCenter = styled.div`
  display: flex;
  justify-content: center;
`;

/** Adapts to portrait vs landscape; $portrait drives sizing strategy */
const VideoWrap = styled.div<{
  $ratio: number;
  $portrait: boolean;
  $isFs: boolean;
  $dragOver: boolean;
}>`
  position: relative;
  background: #000;
  border-radius: ${tokens.radius.md};
  overflow: hidden;
  cursor: pointer;
  outline: ${({ $dragOver }) => $dragOver ? `2px dashed ${tokens.accent.cyan}` : 'none'};

  /* In fullscreen the browser overrides dimensions — just ensure video fills it */
  ${({ $isFs }) => $isFs && css`
    width: 100% !important;
    height: 100% !important;
    border-radius: 0;
    max-height: none;
  `}

  ${({ $portrait, $ratio, $isFs }) => !$isFs && (
    $portrait
      ? css`
          /* Portrait: constrain by height, auto width */
          height: min(82vh, 780px);
          aspect-ratio: ${$ratio};
          width: auto;
          max-width: 100%;
        `
      : css`
          /* Landscape: fill width */
          width: 100%;
          aspect-ratio: ${$ratio};
          max-height: 78vh;
        `
  )}

  /* Reveal corner fullscreen button on hover */
  &:hover > .fs-corner-btn { opacity: 1; }
`;

const VideoEl = styled.video`
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
`;

/* ── Combined overlay panel ── */
const BottomPanel = styled.div`
  position: absolute;
  bottom: 5px; /* sit above the 5px VideoTimeline bar */
  left: 0;
  right: 0;
  padding: 28px 14px 10px;
  background: linear-gradient(
    to bottom,
    transparent 0%,
    rgba(4, 8, 18, 0.65) 35%,
    rgba(4, 8, 18, 0.90) 100%
  );
  pointer-events: none;
  user-select: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const MetricsRow = styled.div`
  display: flex;
  align-items: center;
`;

const Metric = styled.div`
  flex: 1;
  text-align: center;
`;

const MDivider = styled.div`
  width: 1px;
  height: 34px;
  background: rgba(255, 255, 255, 0.1);
  flex-shrink: 0;
`;

const MLabel = styled.div`
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.4);
  margin-bottom: 3px;
`;

const MValueRow = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 2px;
`;

const MValue = styled.span<{ $c: string }>`
  font-size: 22px;
  font-weight: 800;
  color: ${({ $c }) => $c};
  line-height: 1;
  letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;
`;

const MUnit = styled.span`
  font-size: 10px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.38);
  letter-spacing: 0.02em;
`;

/** The SVG depth mini-chart */
const ChartSvg = styled.svg`
  width: 100%;
  height: 48px;
  display: block;
  overflow: visible;
`;

/* ── Alert toast stack ── */
/** Container floats just above the BottomPanel metrics area */
const AlertToastStack = styled.div`
  position: absolute;
  /* sit above BottomPanel (≈ 160px) + VideoTimeline (5px) */
  bottom: 172px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  z-index: 25;
  pointer-events: none;
`;

const AlertToastEl = styled.div<{ $c: string }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 20px;
  background: rgba(4, 8, 18, 0.92);
  backdrop-filter: blur(14px);
  border: 1.5px solid ${({ $c }) => $c}88;
  border-radius: 12px;
  box-shadow:
    0 0 0 3px ${({ $c }) => $c}18,
    0 6px 24px rgba(0, 0, 0, 0.5);
  white-space: nowrap;
  animation: ${slideIn} 0.2s ease both, ${fadeOut} 4s ease forwards;
`;

const AlertToastIcon = styled.span`
  font-size: 15px;
  line-height: 1;
  flex-shrink: 0;
`;

const AlertToastLabel = styled.span`
  font-size: 13px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.95);
  letter-spacing: 0.01em;
`;

/* ── Status badge ── */
const StatusBadge = styled.div<{ $done?: boolean }>`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(8, 12, 22, 0.8);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 99px;
  padding: 10px 22px;
  font-size: 13px;
  font-weight: 500;
  color: ${({ $done }) => $done ? tokens.accent.teal : tokens.text.secondary};
  white-space: nowrap;
  pointer-events: none;
`;

/* ── Play overlay ── */
const PlayOverlay = styled.div<{ $show: boolean }>`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${({ $show }) => $show ? 'rgba(0,0,0,0.28)' : 'rgba(0,0,0,0)'};
  opacity: ${({ $show }) => $show ? 1 : 0};
  transition: opacity 0.18s, background 0.18s;
  pointer-events: ${({ $show }) => $show ? 'auto' : 'none'};
`;

const PlayIconWrap = styled.div`
  font-size: 52px;
  color: rgba(255, 255, 255, 0.88);
  text-shadow: 0 2px 12px rgba(0, 0, 0, 0.6);
  line-height: 1;
`;

/* ── Drag-replace overlay ── */
const DragReplaceOverlay = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: rgba(6, 182, 212, 0.12);
  border: 2px dashed ${tokens.accent.cyan};
  border-radius: ${tokens.radius.md};
  pointer-events: none;
`;

/* ── Bottom progress timeline ── */
const VideoTimeline = styled.div`
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 5px;
  background: rgba(255, 255, 255, 0.06);
  pointer-events: none;
`;

const DataRangeBar = styled.div`
  position: absolute;
  top: 0;
  height: 100%;
  background: ${tokens.accent.teal}55;
`;

const TimelineFill = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: ${tokens.accent.cyan};
  transition: width 0.08s linear;
`;

/* ── Playback controls ── */
const rangeThumbCss = css`
  -webkit-appearance: none;
  appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  cursor: pointer;
  border: none;
  margin-top: -5px;
`;

const rangeTrackCss = css`
  height: 4px;
  border-radius: 2px;
`;

const Controls = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 2px;
`;

const PlayBtn = styled.button`
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: ${tokens.bg.elevated};
  border: 1px solid ${tokens.border.subtle};
  color: ${tokens.text.primary};
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.15s;
  &:hover { border-color: ${tokens.accent.cyan}; color: ${tokens.accent.cyan}; }
`;

const TimeLbl = styled.span<{ $dim?: boolean }>`
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: ${({ $dim }) => $dim ? tokens.text.muted : tokens.text.secondary};
  min-width: 36px;
  text-align: center;
  flex-shrink: 0;
`;

const SeekTrack = styled.div`
  flex: 1;
  position: relative;
`;

const SeekInput = styled.input`
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 4px;
  border-radius: 2px;
  outline: none;
  cursor: pointer;
  background: linear-gradient(
    to right,
    ${tokens.accent.cyan} var(--pct, 0%),
    ${tokens.bg.elevated}  var(--pct, 0%)
  );

  &::-webkit-slider-thumb {
    ${rangeThumbCss}
    background: ${tokens.accent.cyan};
    box-shadow: 0 0 0 3px ${tokens.accent.cyan}33;
    transition: box-shadow 0.15s;
  }
  &:hover::-webkit-slider-thumb { box-shadow: 0 0 0 5px ${tokens.accent.cyan}44; }
  &::-webkit-slider-runnable-track { ${rangeTrackCss} }
  &::-moz-range-thumb { ${rangeThumbCss} background: ${tokens.accent.cyan}; }
  &::-moz-range-track { ${rangeTrackCss} background: ${tokens.bg.elevated}; }
`;

/* ── Sync panel ── */
const SyncBox = styled.div`
  background: ${tokens.bg.elevated};
  border: 1px solid ${tokens.border.subtle};
  border-radius: ${tokens.radius.md};
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const SyncHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
`;

const SyncTitle = styled.span`
  font-size: 12px;
  font-weight: 600;
  color: ${tokens.text.secondary};
  flex-shrink: 0;
`;

const SyncBadge = styled.span<{ $active: boolean }>`
  font-size: 11px;
  color: ${({ $active }) => $active ? tokens.accent.cyan : tokens.text.muted};
  background: ${({ $active }) => $active ? `${tokens.accent.cyan}14` : 'transparent'};
  border: 1px solid ${({ $active }) => $active ? `${tokens.accent.cyan}44` : 'transparent'};
  padding: 2px 10px;
  border-radius: 99px;
  transition: all 0.2s;
`;

const ResetBtn = styled.button`
  margin-left: auto;
  font-size: 11px;
  color: ${tokens.text.muted};
  background: none;
  border: 1px solid ${tokens.border.subtle};
  border-radius: ${tokens.radius.sm};
  padding: 3px 10px;
  transition: all 0.15s;
  &:hover { color: ${tokens.text.secondary}; }
`;

const SyncSliderRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const SyncEndLbl = styled.span`
  font-size: 10px;
  color: ${tokens.text.muted};
  min-width: 30px;
  text-align: center;
  flex-shrink: 0;
`;

const SyncInput = styled.input`
  -webkit-appearance: none;
  appearance: none;
  flex: 1;
  height: 4px;
  border-radius: 2px;
  outline: none;
  cursor: pointer;
  background: linear-gradient(
    to right,
    #818cf8 var(--pct, 50%),
    ${tokens.bg.surface} var(--pct, 50%)
  );

  &::-webkit-slider-thumb {
    ${rangeThumbCss}
    background: #818cf8;
    box-shadow: 0 0 0 3px #818cf833;
    transition: box-shadow 0.15s;
  }
  &:hover::-webkit-slider-thumb { box-shadow: 0 0 0 5px #818cf844; }
  &::-webkit-slider-runnable-track { ${rangeTrackCss} }
  &::-moz-range-thumb { ${rangeThumbCss} background: #818cf8; }
  &::-moz-range-track { ${rangeTrackCss} background: ${tokens.bg.surface}; }
`;

const SyncViz = styled.div`
  display: flex;
  flex-direction: column;
  gap: 5px;
`;

const SyncTrack = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const SyncTrackLabel = styled.span`
  font-size: 10px;
  color: ${tokens.text.muted};
  width: 54px;
  flex-shrink: 0;
`;

const SyncBar = styled.div<{ $color: string }>`
  flex: 1;
  height: 6px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 3px;
  overflow: hidden;
  position: relative;
`;

const SyncBarInner = styled.div<{ $color: string }>`
  position: absolute;
  top: 0;
  height: 100%;
  background: ${({ $color }) => $color}66;
  border-radius: 3px;
  min-width: 4px;
`;

const SyncHint = styled.p`
  font-size: 11px;
  color: ${tokens.text.muted};
  line-height: 1.6;
`;

/* ── Fullscreen corner toggle button (shows on video hover) ── */
const FsCornerBtn = styled.button`
  position: absolute;
  top: 10px;
  right: 10px;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: rgba(8, 12, 22, 0.65);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.75);
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.18s, background 0.15s, color 0.15s;
  z-index: 20;
  cursor: pointer;
  pointer-events: auto;
  &:hover {
    background: rgba(6, 182, 212, 0.25);
    color: ${tokens.accent.cyan};
    border-color: ${tokens.accent.cyan}55;
  }
`;

/* ── Fullscreen seek/controls bar (overlaid on video in FS mode) ── */
const FsControlsBar = styled.div`
  position: absolute;
  bottom: 5px;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 14px 8px;
  z-index: 30;
  pointer-events: auto;
`;

const FsPlayBtn = styled.button`
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: rgba(8, 12, 22, 0.72);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.14);
  color: rgba(255, 255, 255, 0.9);
  font-size: 15px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  cursor: pointer;
  transition: all 0.15s;
  &:hover { border-color: ${tokens.accent.cyan}; color: ${tokens.accent.cyan}; }
`;

const FsTimeLabel = styled.span`
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: rgba(255, 255, 255, 0.6);
  min-width: 36px;
  text-align: center;
  flex-shrink: 0;
`;

const FsSeekWrap = styled.div`
  flex: 1;
`;

const FsSeekInput = styled.input`
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 4px;
  border-radius: 2px;
  outline: none;
  cursor: pointer;
  background: linear-gradient(
    to right,
    ${tokens.accent.cyan} var(--pct, 0%),
    rgba(255, 255, 255, 0.18) var(--pct, 0%)
  );

  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    cursor: pointer;
    border: none;
    margin-top: -5px;
    background: ${tokens.accent.cyan};
    box-shadow: 0 0 0 3px ${tokens.accent.cyan}33;
    transition: box-shadow 0.15s;
  }
  &:hover::-webkit-slider-thumb { box-shadow: 0 0 0 5px ${tokens.accent.cyan}44; }
  &::-webkit-slider-runnable-track { height: 4px; border-radius: 2px; }
  &::-moz-range-thumb {
    width: 14px; height: 14px; border-radius: 50%;
    background: ${tokens.accent.cyan}; border: none; cursor: pointer;
  }
  &::-moz-range-track { height: 4px; border-radius: 2px; background: rgba(255,255,255,0.18); }
`;

const FsExitBtn = styled.button`
  width: 30px;
  height: 30px;
  border-radius: 6px;
  background: rgba(8, 12, 22, 0.65);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.6);
  font-size: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  cursor: pointer;
  transition: all 0.15s;
  &:hover { border-color: ${tokens.accent.danger}55; color: ${tokens.accent.danger}; }
`;

/* ── Fullscreen toggle button in the regular controls bar ── */
const FsToggleBtn = styled.button`
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: ${tokens.bg.elevated};
  border: 1px solid ${tokens.border.subtle};
  color: ${tokens.text.muted};
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  cursor: pointer;
  transition: all 0.15s;
  &:hover { border-color: ${tokens.accent.cyan}; color: ${tokens.accent.cyan}; }
`;

/* ── Fullscreen side panel ── */
const FsSidePanel = styled.div`
  position: absolute;
  /* top / left overridden by inline style (drag) */
  width: 256px;
  background: rgba(4, 8, 18, 0.84);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.11);
  border-radius: 14px;
  padding: 10px 12px 12px;
  display: flex;
  flex-direction: column;
  gap: 9px;
  pointer-events: none; /* children opt-in with pointer-events: auto */
  user-select: none;
  z-index: 15;
`;

/** Drag handle — grab cursor, pointer-events enabled */
const FsPanelHandle = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: grab;
  pointer-events: auto;
  padding: 2px 0;
  &:active { cursor: grabbing; }
`;

const FsElapsed = styled.span`
  font-size: 11px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.06em;
  color: rgba(255, 255, 255, 0.55);
`;

const FsDragGrip = styled.span`
  font-size: 14px;
  color: rgba(255, 255, 255, 0.22);
  line-height: 1;
`;

const FsChartTabs = styled.div`
  display: flex;
  gap: 4px;
  pointer-events: auto;
`;

const FsChartTab = styled.button<{ $active: boolean; $c: string }>`
  flex: 1;
  padding: 4px 0;
  border-radius: 6px;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
  cursor: pointer;
  transition: all 0.15s;
  border: 1px solid ${({ $active, $c }) => $active ? $c + '88' : 'rgba(255,255,255,0.08)'};
  background: ${({ $active, $c }) => $active ? $c + '22' : 'transparent'};
  color: ${({ $active, $c }) => $active ? $c : 'rgba(255,255,255,0.35)'};
  &:hover {
    color: ${({ $c }) => $c};
    border-color: ${({ $c }) => $c + '55'};
  }
`;

const FsMetricsGrid = styled.div<{ $cols: number }>`
  display: grid;
  grid-template-columns: ${({ $cols }) => `repeat(${$cols}, 1fr)`};
  gap: 1px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  overflow: hidden;
`;

const FsMetricCell = styled.div`
  background: rgba(4, 8, 18, 0.6);
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 3px;
`;

const FsPanelDivider = styled.div`
  height: 1px;
  background: rgba(255, 255, 255, 0.08);
  margin: 0 -2px;
`;

const FsPanelChartSvg = styled.svg`
  width: 100%;
  height: 58px;
  display: block;
  overflow: visible;
`;
