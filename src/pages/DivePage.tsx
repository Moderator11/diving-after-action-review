import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import styled from 'styled-components';
import {
  ResponsiveContainer, Area, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ComposedChart, ReferenceLine,
} from 'recharts';

import { tokens } from '../styles/GlobalStyle';
import { useRequireSession } from '../hooks/useRequireSession';
import { useDiveChartData } from '../hooks/useDiveChartData';
import { fmtTick, severityColor } from '../utils/chartUtils';
import { formatDuration } from '../utils/parseFit';
import type { AlertSeverity } from '../types/dive';
import type { DiveSpike } from '../utils/spikes';

import { DiveSummaryCard } from '../components/DiveSummaryCard';
import { SpikeEventLog }   from '../components/SpikeEventLog';
import { VideoOverlay }    from '../components/VideoOverlay';
import { TtBox, TtTime, TtRow } from '../components/ui/ChartTooltip';
import { PageEl } from '../components/layout/TopBarPrimitives';
import { TopBar } from '../components/layout/TopBar';
import { Footer } from '../components/layout/Footer';

// ── Colour tokens ─────────────────────────────────────────
const C = {
  depth:   tokens.chart.depth,
  hr:      tokens.chart.hr,
  temp:    '#a78bfa',
  descent: '#f97316',
  ascent:  '#10b981',
} as const;

const PAD_OPTIONS = [0, 1, 3, 5] as const;

// ── Small UI helpers ──────────────────────────────────────
function StatBadge({ label, value, unit, color }: {
  label: string; value: string | number; unit?: string; color?: string;
}) {
  return (
    <StatItem>
      <StatValue style={{ color: color ?? tokens.text.primary }}>
        {value}<StatUnit>{unit}</StatUnit>
      </StatValue>
      <StatLabel>{label}</StatLabel>
    </StatItem>
  );
}

function ToggleChip({ label, color, checked, onClick }: {
  label: string; color: string; checked: boolean; onClick: () => void;
}) {
  return (
    <ToggleChipEl $c={color} $on={checked} onClick={onClick}>
      <ToggleDotEl $c={color} $on={checked} />
      {label}
    </ToggleChipEl>
  );
}

function PadToggle({ label, value, onChange }: {
  label: string; value: number; onChange: (v: number) => void;
}) {
  return (
    <PadGroup>
      <PadLabel>{label}</PadLabel>
      {PAD_OPTIONS.map((opt) => (
        <PadBtn key={opt} $active={value === opt} onClick={() => onChange(opt)}>
          {opt === 0 ? '끄기' : `${opt}분`}
        </PadBtn>
      ))}
    </PadGroup>
  );
}

function ChartCard({ title, icon, children, controls }: {
  title: string; icon: string; children: React.ReactNode; controls?: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardIcon>{icon}</CardIcon>
        <CardTitle>{title}</CardTitle>
        {controls && <CardControls>{controls}</CardControls>}
      </CardHeader>
      {children}
    </Card>
  );
}

// ── Custom tooltips ───────────────────────────────────────
const DepthTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const depth = payload.find((p: any) => p.dataKey === 'depth');
  const hr    = payload.find((p: any) => p.dataKey === 'hr');
  return (
    <TtBox>
      <TtTime>{fmtTick(Number(label))}</TtTime>
      {depth && <TtRow $c={C.depth}><span>수심</span><strong>{depth.value.toFixed(1)} m</strong></TtRow>}
      {hr && hr.value != null && <TtRow $c={C.hr}><span>심박수</span><strong>{hr.value} bpm</strong></TtRow>}
    </TtBox>
  );
};

const RateTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const desc = payload.find((p: any) => p.dataKey === 'desc');
  const asc  = payload.find((p: any) => p.dataKey === 'asc');
  return (
    <TtBox>
      <TtTime>{fmtTick(Number(label))}</TtTime>
      {desc && desc.value > 0 && <TtRow $c={C.descent}><span>하강</span><strong>{desc.value.toFixed(2)} m/s</strong></TtRow>}
      {asc  && asc.value  > 0 && <TtRow $c={C.ascent}><span>상승</span><strong>{asc.value.toFixed(2)} m/s</strong></TtRow>}
    </TtBox>
  );
};

const TempTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const temp = payload.find((p: any) => p.dataKey === 'temp');
  return (
    <TtBox>
      <TtTime>{fmtTick(Number(label))}</TtTime>
      {temp && temp.value != null && <TtRow $c={C.temp}><span>수온</span><strong>{temp.value.toFixed(1)} °C</strong></TtRow>}
    </TtBox>
  );
};

// ── Reference line helpers ────────────────────────────────
function depthSpikeLines(
  spikes: DiveSpike[], showDescent: boolean, showAscent: boolean, yAxisId?: string,
) {
  return spikes
    .filter((s) =>
      (s.type === 'descent' && showDescent) ||
      (s.type === 'ascent'  && showAscent)
    )
    .map((s) => {
      const typeKr   = s.type === 'descent' ? '↓급하강' : '↑급상승';
      const position = s.rank % 2 === 1 ? 'insideTopRight' : 'insideTopLeft';
      return (
        <ReferenceLine
          key={`ds-${s.t}-${s.type}`}
          {...(yAxisId ? { yAxisId } : {})} x={s.t}
          stroke={s.color}
          strokeWidth={s.rank === 1 ? 2 : 1.2}
          strokeDasharray={s.rank === 1 ? '5 3' : '3 4'}
          opacity={Math.max(0.5, 0.9 - s.rank * 0.1)}
          label={{ value: `${typeKr} Top${s.rank}`, position, fill: s.color, fontSize: 9, fontWeight: 700 }}
        />
      );
    });
}

function hrSpikeLines(spikes: DiveSpike[], showHR: boolean, yAxisId?: string) {
  return spikes
    .filter((s) => s.type === 'hr' && showHR)
    .map((s) => {
      const position = s.rank % 2 === 1 ? 'insideTopRight' : 'insideTopLeft';
      return (
        <ReferenceLine
          key={`hr-${s.t}`}
          {...(yAxisId ? { yAxisId } : {})} x={s.t}
          stroke={s.color}
          strokeWidth={s.rank === 1 ? 2 : 1.2}
          strokeDasharray={s.rank === 1 ? '5 3' : '3 4'}
          opacity={Math.max(0.5, 0.9 - s.rank * 0.1)}
          label={{ value: `❤️급변 Top${s.rank}`, position, fill: s.color, fontSize: 9, fontWeight: 700 }}
        />
      );
    });
}

function eventRefLines(
  events: import('../types/dive').DiveEvent[],
  showEvents: boolean, t0Ms: number, yAxisId?: string,
) {
  if (!showEvents) return null;
  return events.map((e, i) => {
    const t   = Math.round((e.timestamp.getTime() - t0Ms) / 1000);
    const col = severityColor(e.severity as AlertSeverity);
    const position = i % 2 === 0 ? 'insideTopLeft' : 'insideTopRight';
    return (
      <ReferenceLine
        key={`evt-${t}-${e.event}-${i}`}
        {...(yAxisId ? { yAxisId } : {})} x={t}
        stroke={col} strokeWidth={2} strokeDasharray="6 2"
        label={{
          value: e.label.length > 14 ? e.label.slice(0, 13) + '…' : e.label,
          position, fill: col, fontSize: 9, fontWeight: 700,
        }}
      />
    );
  });
}

// ── Main page ─────────────────────────────────────────────
export default function DivePage() {
  const navigate = useNavigate();
  const { id }   = useParams<{ id: string }>();
  const session  = useRequireSession();

  const [prePad,      setPrePad]      = useState(0);
  const [postPad,     setPostPad]     = useState(0);
  const [topN,        setTopN]        = useState(1);
  const [showEvents,  setShowEvents]  = useState(true);
  const [showHR,      setShowHR]      = useState(true);
  const [showDescent, setShowDescent] = useState(true);
  const [showAscent,  setShowAscent]  = useState(true);

  if (!session) return null;

  const diveIdx = parseInt(id ?? '0', 10);
  const dive    = session.dives[diveIdx]; // may be undefined

  // Hook must be called unconditionally (before any early returns below)
  const {
    spikes, diveEvents, depthData, rateData, tempData,
    hasTemp, maxDepth, tempMin, tempMax, maxRate,
    t0Ms, diveDurSec,
  } = useDiveChartData({ dive, session, prePad, postPad, topN });

  if (!dive) {
    return (
      <PageEl>
        <TopBar />
        <Content><p style={{ color: tokens.text.muted }}>다이브를 찾을 수 없습니다.</p></Content>
        <Footer />
      </PageEl>
    );
  }

  const totalDives = session.dives.length;

  const showPadLines = prePad > 0 || postPad > 0;

  // ── Shared chart X-axis ────────────────────────────────
  const sharedXAxis = (
    <XAxis
      dataKey="t" type="number" domain={['dataMin', 'dataMax']}
      tickFormatter={fmtTick}
      tick={{ fill: tokens.text.muted, fontSize: 11 }} tickLine={false}
      axisLine={{ stroke: tokens.border.subtle }} interval="preserveStartEnd"
    />
  );

  // ── Visibility toggle chips ────────────────────────────
  const DESCENT_COLOR = '#eab308';
  const ASCENT_COLOR  = '#f43f5e';
  const EVENT_COLOR   = severityColor('warning');

  const toggleControls = (
    <ToggleGroup>
      <ToggleChip label="다이브 이벤트" color={EVENT_COLOR}   checked={showEvents}  onClick={() => setShowEvents(v => !v)} />
      <ToggleChip label="심박 급변"     color={C.hr}          checked={showHR}      onClick={() => setShowHR(v => !v)} />
      <ToggleChip label="급하강"        color={DESCENT_COLOR} checked={showDescent} onClick={() => setShowDescent(v => !v)} />
      <ToggleChip label="급상승"        color={ASCENT_COLOR}  checked={showAscent}  onClick={() => setShowAscent(v => !v)} />
    </ToggleGroup>
  );

  const topNControl = (
    <TopNGroup>
      <PadLabel>Top N</PadLabel>
      {[1, 2, 3].map((n) => (
        <PadBtn key={n} $active={topN === n} onClick={() => setTopN(n)}>{n}</PadBtn>
      ))}
    </TopNGroup>
  );

  const padControls = (
    <PadControls>
      <PadToggle label="입수 전" value={prePad}  onChange={setPrePad}  />
      <PadToggle label="입수 후" value={postPad} onChange={setPostPad} />
    </PadControls>
  );

  // ── Pad boundary reference lines (reusable) ────────────
  const padRefLines = (yAxisId?: string) => showPadLines ? (
    <>
      <ReferenceLine
        {...(yAxisId ? { yAxisId } : {})} x={0}
        stroke={tokens.accent.cyan} strokeDasharray="4 3" strokeWidth={1.5}
        label={{ value: '입수', position: 'insideTopRight', fill: tokens.accent.cyan, fontSize: 10 }}
      />
      <ReferenceLine
        {...(yAxisId ? { yAxisId } : {})} x={diveDurSec}
        stroke={tokens.accent.teal} strokeDasharray="4 3" strokeWidth={1.5}
        label={{ value: '출수', position: 'insideTopLeft', fill: tokens.accent.teal, fontSize: 10 }}
      />
    </>
  ) : null;

  return (
    <PageEl>
      <TopBar diveIdx={diveIdx} diveStartTime={dive.startTime} />

      <Content>
        {/* ── Dive navigation ── */}
        <DiveNav>
          <NavButton disabled={diveIdx <= 0} onClick={() => navigate(`/dive/${diveIdx - 1}`)}>
            ‹ 이전
          </NavButton>
          <DiveCounter>{diveIdx + 1} / {totalDives}</DiveCounter>
          <NavButton disabled={diveIdx >= totalDives - 1} onClick={() => navigate(`/dive/${diveIdx + 1}`)}>
            다음 ›
          </NavButton>
        </DiveNav>

        {/* ── Summary card ── */}
        <DiveSummaryCard dive={dive} diveIdx={diveIdx} session={session} />

        {/* ── Video overlay ── */}
        <VideoOverlay
          dive={dive} spikes={spikes} events={diveEvents}
          showEvents={showEvents} showHR={showHR}
          showDescent={showDescent} showAscent={showAscent}
        />

        {/* ── Stats bar ── */}
        <StatsBar>
          <StatBadge label="최대 수심"     value={dive.maxDepthM.toFixed(1)}         unit="m"    color={C.depth} />
          <StatDivider />
          <StatBadge label="총 시간"       value={formatDuration(dive.durationSeconds)} />
          <StatDivider />
          <StatBadge label="잠수 시간"     value={formatDuration(dive.bottomTimeSeconds)} color={tokens.accent.teal} />
          <StatDivider />
          <StatBadge label="평균 수심"     value={dive.avgDepthM.toFixed(1)}         unit="m" />
          <StatDivider />
          <StatBadge label="최대 하강속도" value={dive.maxDescentRateMps.toFixed(2)} unit=" m/s" color={C.descent} />
          <StatDivider />
          <StatBadge label="최대 상승속도" value={dive.maxAscentRateMps.toFixed(2)}  unit=" m/s" color={C.ascent} />
          <StatDivider />
          {dive.maxHR != null && <>
            <StatBadge label="최고 심박수" value={dive.maxHR} unit=" bpm" color={C.hr} />
            <StatDivider />
          </>}
          {dive.avgTempC != null && (
            <StatBadge label="평균 수온" value={dive.avgTempC} unit="°C" color={C.temp} />
          )}
        </StatsBar>

        {/* ── Depth + HR chart ── */}
        <ChartCard
          title="수심 프로파일" icon="📈"
          controls={<>{toggleControls}{topNControl}{padControls}</>}
        >
          <ChartLegend>
            <LegDot $c={C.depth} /> 수심 &nbsp;
            <LegDot $c={C.hr}    /> 심박수
            {showPadLines && (
              <><LegLine $c={tokens.accent.cyan} />
              <span style={{ color: tokens.text.muted, fontSize: 11 }}>입수 / 출수</span></>
            )}
          </ChartLegend>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={depthData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="dg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor={C.depth} stopOpacity={0.45} />
                  <stop offset="100%" stopColor={C.depth} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={tokens.chart.grid} vertical={false} />
              {sharedXAxis}
              <YAxis yAxisId="d" orientation="left" reversed domain={[0, maxDepth]}
                tickFormatter={(v) => `${v}m`}
                tick={{ fill: tokens.text.muted, fontSize: 11 }} tickLine={false} axisLine={false} width={44} />
              <YAxis yAxisId="h" orientation="right" domain={[40, 180]}
                tick={{ fill: tokens.text.muted, fontSize: 11 }} tickLine={false} axisLine={false} width={36} />
              <Tooltip content={<DepthTooltip />} />
              <ReferenceLine yAxisId="d" y={0} stroke={tokens.border.default} strokeDasharray="4 4" />
              {padRefLines('d')}
              {depthSpikeLines(spikes, showDescent, showAscent, 'd')}
              {hrSpikeLines(spikes, showHR, 'd')}
              {eventRefLines(diveEvents, showEvents, t0Ms, 'd')}
              <Area yAxisId="d" dataKey="depth" type="monotone"
                stroke={C.depth} strokeWidth={2} fill="url(#dg)"
                dot={false} activeDot={{ r: 4, fill: C.depth }} isAnimationActive={false} />
              <Line yAxisId="h" dataKey="hr" type="monotone"
                stroke={C.hr} strokeWidth={1.5} dot={false}
                activeDot={{ r: 3, fill: C.hr }} connectNulls isAnimationActive={false} opacity={0.8} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* ── Descent / Ascent rate chart ── */}
        <ChartCard title="하강 · 상승 속도" icon="🚀">
          <ChartLegend>
            <LegDot $c={C.descent} /> 하강 &nbsp;
            <LegDot $c={C.ascent}  /> 상승
          </ChartLegend>
          <ResponsiveContainer width="100%" height={200}>
            <ComposedChart data={rateData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="descGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor={C.descent} stopOpacity={0.5} />
                  <stop offset="100%" stopColor={C.descent} stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="ascGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor={C.ascent} stopOpacity={0.5} />
                  <stop offset="100%" stopColor={C.ascent} stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={tokens.chart.grid} vertical={false} />
              {sharedXAxis}
              <YAxis domain={[0, maxRate]}
                tick={{ fill: tokens.text.muted, fontSize: 11 }} tickLine={false} axisLine={false} width={36} />
              <Tooltip content={<RateTooltip />} />
              {padRefLines()}
              {depthSpikeLines(spikes, showDescent, showAscent)}
              {hrSpikeLines(spikes, showHR)}
              {eventRefLines(diveEvents, showEvents, t0Ms)}
              <Area dataKey="desc" type="monotone"
                stroke={C.descent} strokeWidth={1.5} fill="url(#descGrad)"
                dot={false} isAnimationActive={false} />
              <Area dataKey="asc" type="monotone"
                stroke={C.ascent} strokeWidth={1.5} fill="url(#ascGrad)"
                dot={false} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
          <AxisUnit>m / s</AxisUnit>
        </ChartCard>

        {/* ── Heart rate chart ── */}
        {depthData.some((d) => d.hr != null) && (
          <ChartCard title="심박수" icon="❤️">
            <ResponsiveContainer width="100%" height={180}>
              <ComposedChart data={depthData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="hrGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor={C.hr} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={C.hr} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={tokens.chart.grid} vertical={false} />
                {sharedXAxis}
                <YAxis domain={[40, 180]}
                  tick={{ fill: tokens.text.muted, fontSize: 11 }} tickLine={false} axisLine={false} width={36} />
                <Tooltip content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  return (
                    <TtBox>
                      <TtTime>{fmtTick(Number(label))}</TtTime>
                      <TtRow $c={C.hr}><span>심박수</span><strong>{payload[0].value} bpm</strong></TtRow>
                    </TtBox>
                  );
                }} />
                {padRefLines()}
                {depthSpikeLines(spikes, showDescent, showAscent)}
                {hrSpikeLines(spikes, showHR)}
                {eventRefLines(diveEvents, showEvents, t0Ms)}
                <Area dataKey="hr" type="monotone"
                  stroke={C.hr} strokeWidth={1.5} fill="url(#hrGrad)"
                  dot={false} connectNulls isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
            <AxisUnit>bpm</AxisUnit>
          </ChartCard>
        )}

        {/* ── Water temperature chart ── */}
        {hasTemp && (
          <ChartCard title="수온" icon="🌡️">
            <ResponsiveContainer width="100%" height={180}>
              <ComposedChart data={tempData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="tempGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor={C.temp} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={C.temp} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={tokens.chart.grid} vertical={false} />
                {sharedXAxis}
                <YAxis domain={[tempMin, tempMax]} tickFormatter={(v) => `${v}°`}
                  tick={{ fill: tokens.text.muted, fontSize: 11 }} tickLine={false} axisLine={false} width={36} />
                <Tooltip content={<TempTooltip />} />
                {padRefLines()}
                {depthSpikeLines(spikes, showDescent, showAscent)}
                {hrSpikeLines(spikes, showHR)}
                {eventRefLines(diveEvents, showEvents, t0Ms)}
                <Area dataKey="temp" type="monotone"
                  stroke={C.temp} strokeWidth={1.5} fill="url(#tempGrad)"
                  dot={false} connectNulls isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
            <AxisUnit>°C</AxisUnit>
          </ChartCard>
        )}

        {/* ── Spike & Event Log ── */}
        <SpikeEventLog
          spikes={spikes} diveEvents={diveEvents} t0Ms={t0Ms}
          showHR={showHR} showDescent={showDescent}
          showAscent={showAscent} showEvents={showEvents}
        />
      </Content>
      <Footer />
    </PageEl>
  );
}

/* ── Styled components ──────────────────────────────────── */

const Content = styled.main`
  flex: 1;
  max-width: 1100px;
  width: 100%;
  margin: 0 auto;
  padding: 28px 24px 60px;
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

const DiveNav = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
`;

const NavButton = styled.button<{ disabled?: boolean }>`
  font-size: 13px;
  padding: 6px 18px;
  border-radius: ${tokens.radius.md};
  border: 1px solid ${tokens.border.subtle};
  background: ${tokens.bg.surface};
  color: ${({ disabled }) => disabled ? tokens.text.muted : tokens.text.secondary};
  cursor: ${({ disabled }) => disabled ? 'not-allowed' : 'pointer'};
  opacity: ${({ disabled }) => disabled ? 0.4 : 1};
  transition: all 0.15s;
  &:hover:not(:disabled) { border-color: ${tokens.accent.cyan}; color: ${tokens.accent.cyan}; }
`;

const DiveCounter = styled.span`
  font-size: 13px;
  color: ${tokens.text.muted};
  min-width: 60px;
  text-align: center;
`;

const StatsBar = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0;
  background: ${tokens.bg.surface};
  border: 1px solid ${tokens.border.subtle};
  border-radius: ${tokens.radius.lg};
  padding: 20px 28px;
`;

const StatItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 0 20px;
`;

const StatValue = styled.span`
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1;
`;

const StatUnit = styled.span`
  font-size: 12px;
  font-weight: 400;
  opacity: 0.7;
  margin-left: 2px;
`;

const StatLabel = styled.span`
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: ${tokens.text.muted};
`;

const StatDivider = styled.div`
  width: 1px;
  height: 36px;
  background: ${tokens.border.subtle};
  flex-shrink: 0;
`;

const Card = styled.div`
  background: ${tokens.bg.surface};
  border: 1px solid ${tokens.border.subtle};
  border-radius: ${tokens.radius.lg};
  padding: 20px 24px 16px;
`;

const CardHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  flex-wrap: wrap;
`;

const CardIcon = styled.span`font-size: 16px; line-height: 1;`;

const CardTitle = styled.h2`
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: ${tokens.text.secondary};
`;

const CardControls = styled.div`
  margin-left: auto;
  display: flex;
  align-items: center;
`;

const ChartLegend = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: ${tokens.text.secondary};
  margin-bottom: 12px;
`;

const LegDot = styled.span<{ $c: string }>`
  display: inline-block;
  width: 8px; height: 8px;
  border-radius: 50%;
  background: ${({ $c }) => $c};
`;

const LegLine = styled.span<{ $c: string }>`
  display: inline-block;
  width: 18px; height: 2px;
  background: ${({ $c }) => $c};
  border-radius: 1px;
  vertical-align: middle;
  margin-right: 4px;
`;

const AxisUnit = styled.div`
  text-align: right;
  font-size: 10px;
  color: ${tokens.text.muted};
  margin-top: 4px;
  padding-right: 4px;
  opacity: 0.6;
  letter-spacing: 0.04em;
`;

const PadControls = styled.div`
  display: flex;
  align-items: center;
  gap: 14px;
  margin-left: auto;
`;

const PadGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 3px;
`;

const PadLabel = styled.span`
  font-size: 11px;
  color: ${tokens.text.muted};
  margin-right: 4px;
  white-space: nowrap;
`;

const PadBtn = styled.button<{ $active: boolean }>`
  font-size: 11px;
  padding: 3px 9px;
  border-radius: 6px;
  border: 1px solid ${({ $active }) => $active ? tokens.accent.cyan : tokens.border.subtle};
  background: ${({ $active }) => $active ? `${tokens.accent.cyan}22` : 'transparent'};
  color: ${({ $active }) => $active ? tokens.accent.cyan : tokens.text.muted};
  cursor: pointer;
  transition: all 0.15s;
  &:hover { border-color: ${tokens.accent.cyan}; color: ${tokens.accent.cyan}; }
`;

const TopNGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 3px;
  margin-right: 12px;
  padding-right: 12px;
  border-right: 1px solid ${tokens.border.subtle};
`;

const ToggleGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 5px;
  margin-right: 10px;
  padding-right: 10px;
  border-right: 1px solid ${tokens.border.subtle};
`;

const ToggleChipEl = styled.button<{ $c: string; $on: boolean }>`
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
  padding: 3px 9px 3px 6px;
  border-radius: 999px;
  border: 1px solid ${({ $on, $c }) => $on ? $c + '88' : tokens.border.subtle};
  background: ${({ $on, $c }) => $on ? $c + '18' : 'transparent'};
  color: ${({ $on, $c }) => $on ? $c : tokens.text.muted};
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
  &:hover { border-color: ${({ $c }) => $c + '66'}; color: ${({ $c }) => $c}; }
`;

const ToggleDotEl = styled.span<{ $c: string; $on: boolean }>`
  display: inline-block;
  width: 7px; height: 7px;
  border-radius: 50%;
  background: ${({ $on, $c }) => $on ? $c : tokens.border.default};
  transition: background 0.15s;
  flex-shrink: 0;
`;
