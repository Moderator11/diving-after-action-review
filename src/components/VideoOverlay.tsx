import {
  useState, useRef, useCallback, useEffect, useMemo,
} from 'react';
import styled, { css, keyframes } from 'styled-components';
import { tokens } from '../styles/GlobalStyle';
import type { DetectedDive, DiveRecord } from '../types/dive';

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

// ── Component ─────────────────────────────────────────────
export function VideoOverlay({ dive }: Props) {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  /** syncOffset: video_time − syncOffset = data_elapsed_seconds
   *  Positive  → video started before dive data began
   *  Negative  → dive data began before video */
  const [syncOffset, setSyncOffset] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const seekRef = useRef<HTMLInputElement>(null);

  // ── Derived ──────────────────────────────────────────────
  const t0Ms = useMemo(
    () => (dive.records.length > 0 ? dive.records[0].timestamp.getTime() : 0),
    [dive],
  );

  const diveDuration = useMemo(() => {
    if (dive.records.length < 2) return 0;
    return (dive.records[dive.records.length - 1].timestamp.getTime() - t0Ms) / 1000;
  }, [dive.records, t0Ms]);

  const dataElapsed = currentTime - syncOffset; // seconds from dive start

  const dataStatus: 'before' | 'active' | 'after' =
    dataElapsed < 0 ? 'before'
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

  const depthFraction = currentRecord
    ? Math.min(currentRecord.depthM / Math.max(dive.maxDepthM, 0.01), 1)
    : 0;

  // Sync slider label
  const syncLabel =
    syncOffset === 0 ? '동기화 없음 (슬라이더로 조정)'
    : syncOffset > 0
      ? `영상이 데이터보다 ${syncOffset.toFixed(1)}초 먼저 시작`
      : `데이터가 영상보다 ${(-syncOffset).toFixed(1)}초 먼저 시작`;

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
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) loadVideo(file);
  }, [loadVideo]);

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

  // Space bar shortcut
  useEffect(() => {
    if (!videoUrl) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' && (e.target as HTMLElement).tagName !== 'INPUT') {
        e.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [videoUrl, togglePlay]);

  // Cleanup blob URL on unmount
  useEffect(() => () => { if (videoUrl) URL.revokeObjectURL(videoUrl); }, []); // eslint-disable-line

  // Sync seek slider thumb fill via CSS variable
  useEffect(() => {
    if (!seekRef.current || duration === 0) return;
    const pct = (currentTime / duration) * 100;
    seekRef.current.style.setProperty('--pct', `${pct}%`);
  }, [currentTime, duration]);

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
          <VideoWrap
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
              onLoadedMetadata={() => setDuration(videoRef.current?.duration ?? 0)}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onEnded={() => setIsPlaying(false)}
            />

            {/* ── Corner data panels ── */}

            {/* Top-left: Depth */}
            <Panel $pos="tl">
              <PLabel>수심</PLabel>
              <PRow>
                <PValue $c={C.depth}>
                  {currentRecord ? currentRecord.depthM.toFixed(1) : '--'}
                </PValue>
                <PUnit>m</PUnit>
                {/* Depth gauge bar */}
                <DepthGauge>
                  <DepthGaugeFill style={{ height: `${depthFraction * 100}%` }} />
                </DepthGauge>
              </PRow>
            </Panel>

            {/* Top-right: Heart rate */}
            {dive.maxHR !== null && (
              <Panel $pos="tr">
                <PLabel style={{ textAlign: 'right' }}>심박수</PLabel>
                <PRow $right>
                  <PValue $c={C.hr}>
                    {currentRecord?.heartRate != null ? currentRecord.heartRate : '--'}
                  </PValue>
                  <PUnit>bpm</PUnit>
                </PRow>
              </Panel>
            )}

            {/* Bottom-left: Descent/ascent rate */}
            <Panel $pos="bl">
              <PLabel>
                {currentRecord && Math.abs(currentRateMps) > 0.05
                  ? currentRateMps > 0 ? '↓ 하강' : '↑ 상승'
                  : '속도'}
              </PLabel>
              <PRow>
                <PValue $c={
                  !currentRecord ? tokens.text.muted
                  : currentRateMps > 0.05 ? C.descent
                  : currentRateMps < -0.05 ? C.ascent
                  : tokens.text.secondary
                }>
                  {currentRecord ? Math.abs(currentRateMps).toFixed(2) : '--'}
                </PValue>
                <PUnit>m/s</PUnit>
              </PRow>
            </Panel>

            {/* Bottom-right: Water temp */}
            {dive.avgTempC !== null && (
              <Panel $pos="br">
                <PLabel style={{ textAlign: 'right' }}>수온</PLabel>
                <PRow $right>
                  <PValue $c={C.temp}>
                    {currentRecord?.temperatureC != null
                      ? currentRecord.temperatureC.toFixed(1)
                      : '--'}
                  </PValue>
                  <PUnit>°C</PUnit>
                </PRow>
              </Panel>
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

            {/* Play icon flash when paused */}
            <PlayOverlay $show={!isPlaying} onClick={togglePlay}>
              <PlayIconWrap>▶</PlayIconWrap>
            </PlayOverlay>

            {/* Drag-to-replace overlay */}
            {isDragOver && (
              <DragReplaceOverlay>
                <span style={{ fontSize: 32 }}>🎬</span>
                <span style={{ fontSize: 14, color: tokens.text.secondary }}>
                  영상 교체
                </span>
              </DragReplaceOverlay>
            )}

            {/* Bottom timeline bar */}
            <VideoTimeline>
              {/* Data range highlight */}
              {duration > 0 && (
                <DataRangeBar
                  style={{
                    left: `${Math.max(0, (syncOffset / duration)) * 100}%`,
                    width: `${Math.min(diveDuration / duration, 1 - Math.max(0, syncOffset / duration)) * 100}%`,
                  }}
                />
              )}
              {/* Playhead */}
              <TimelineFill
                style={{ width: duration > 0 ? `${(currentTime / duration) * 100}%` : '0%' }}
              />
            </VideoTimeline>
          </VideoWrap>

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
                style={{
                  '--pct': `${((syncOffset + 300) / 600) * 100}%`,
                } as React.CSSProperties}
              />
              <SyncEndLbl>+5분</SyncEndLbl>
            </SyncSliderRow>

            {/* Visual timeline to show alignment */}
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
  50% { transform: scale(1.15); }
`;

// ── Styled Components ─────────────────────────────────────
const Wrapper = styled.div`
  background: ${tokens.bg.surface};
  border: 1px solid ${tokens.border.subtle};
  border-radius: ${tokens.radius.lg};
  padding: 20px 24px;
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

/* ── Player ── */
const PlayerArea = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const VideoWrap = styled.div<{ $dragOver: boolean }>`
  position: relative;
  background: #000;
  border-radius: ${tokens.radius.md};
  overflow: hidden;
  aspect-ratio: 16/9;
  cursor: pointer;
  outline: ${({ $dragOver }) => $dragOver ? `2px dashed ${tokens.accent.cyan}` : 'none'};
`;

const VideoEl = styled.video`
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
`;

/* ── Data panels ── */
type PanelPos = 'tl' | 'tr' | 'bl' | 'br';
const panelPos = (pos: PanelPos) => {
  const map: Record<PanelPos, string> = {
    tl: 'top:12px;left:12px;',
    tr: 'top:12px;right:12px;',
    bl: 'bottom:28px;left:12px;',
    br: 'bottom:28px;right:12px;',
  };
  return map[pos];
};

const Panel = styled.div<{ $pos: PanelPos }>`
  position: absolute;
  ${({ $pos }) => panelPos($pos)}
  background: rgba(8, 12, 22, 0.72);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 10px;
  padding: 8px 12px;
  min-width: 76px;
  pointer-events: none;
  user-select: none;
`;

const PLabel = styled.div`
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.4);
  margin-bottom: 4px;
`;

const PRow = styled.div<{ $right?: boolean }>`
  display: flex;
  align-items: baseline;
  gap: 3px;
  ${({ $right }) => $right && 'justify-content: flex-end;'}
`;

const PValue = styled.span<{ $c: string }>`
  font-size: 26px;
  font-weight: 800;
  color: ${({ $c }) => $c};
  line-height: 1;
  letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;
`;

const PUnit = styled.span`
  font-size: 11px;
  font-weight: 500;
  color: rgba(255,255,255,0.45);
  letter-spacing: 0.02em;
`;

/* Depth gauge bar */
const DepthGauge = styled.div`
  width: 4px;
  height: 32px;
  background: rgba(255,255,255,0.08);
  border-radius: 2px;
  margin-left: 6px;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  overflow: hidden;
  align-self: center;
`;

const DepthGaugeFill = styled.div`
  width: 100%;
  background: ${tokens.chart.depth};
  border-radius: 2px;
  transition: height 0.4s ease;
  min-height: 2px;
`;

/* Status badge */
const StatusBadge = styled.div<{ $done?: boolean }>`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(8, 12, 22, 0.8);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 99px;
  padding: 10px 22px;
  font-size: 13px;
  font-weight: 500;
  color: ${({ $done }) => $done ? tokens.accent.teal : tokens.text.secondary};
  white-space: nowrap;
  pointer-events: none;
`;

/* Play overlay */
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
  color: rgba(255,255,255,0.88);
  text-shadow: 0 2px 12px rgba(0,0,0,0.6);
  line-height: 1;
`;

/* Drag replace overlay */
const DragReplaceOverlay = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: rgba(6,182,212,0.12);
  border: 2px dashed ${tokens.accent.cyan};
  border-radius: ${tokens.radius.md};
  pointer-events: none;
`;

/* Bottom timeline */
const VideoTimeline = styled.div`
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 5px;
  background: rgba(255,255,255,0.06);
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
    ${tokens.bg.elevated} var(--pct, 0%)
  );

  &::-webkit-slider-thumb {
    ${rangeThumbCss}
    background: ${tokens.accent.cyan};
    box-shadow: 0 0 0 3px ${tokens.accent.cyan}33;
    transition: box-shadow 0.15s;
  }
  &:hover::-webkit-slider-thumb {
    box-shadow: 0 0 0 5px ${tokens.accent.cyan}44;
  }
  &::-webkit-slider-runnable-track { ${rangeTrackCss} }
  &::-moz-range-thumb {
    ${rangeThumbCss}
    background: ${tokens.accent.cyan};
  }
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
  &:hover::-webkit-slider-thumb {
    box-shadow: 0 0 0 5px #818cf844;
  }
  &::-webkit-slider-runnable-track { ${rangeTrackCss} }
  &::-moz-range-thumb { ${rangeThumbCss} background: #818cf8; }
  &::-moz-range-track { ${rangeTrackCss} background: ${tokens.bg.surface}; }
`;

/* ── Alignment visualisation ── */
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
  background: rgba(255,255,255,0.05);
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
