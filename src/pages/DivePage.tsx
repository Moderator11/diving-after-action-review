import { useEffect, useMemo } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import styled from 'styled-components';
import {
  ResponsiveContainer,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ComposedChart,
  ReferenceLine,
} from 'recharts';
import { tokens } from '../styles/GlobalStyle';
import { useDiveSession } from '../store/DiveContext';
import { formatDuration, formatDate } from '../utils/parseFit';
import type { DetectedDive } from '../types/dive';

// ── Colour tokens ─────────────────────────────────────────
const C = {
  depth:   tokens.chart.depth,       // cyan
  hr:      tokens.chart.hr,          // orange
  temp:    '#a78bfa',                // violet
  descent: '#f97316',                // orange
  ascent:  '#10b981',                // emerald
} as const;

// ── Chart point types ─────────────────────────────────────
interface DepthPoint { t: number; depth: number; hr: number | null; }
interface RatePoint  { t: number; desc: number; asc: number; }
interface TempPoint  { t: number; temp: number | null; }

// ── Helpers ───────────────────────────────────────────────
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

// ── Custom tooltip ────────────────────────────────────────
const DepthTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const depth = payload.find((p: any) => p.dataKey === 'depth');
  const hr    = payload.find((p: any) => p.dataKey === 'hr');
  return (
    <TtBox>
      <TtTime>{Number(label).toFixed(0)}초</TtTime>
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
      <TtTime>{Number(label).toFixed(0)}초</TtTime>
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
      <TtTime>{Number(label).toFixed(0)}초</TtTime>
      {temp && temp.value != null && <TtRow $c={C.temp}><span>수온</span><strong>{temp.value.toFixed(1)} °C</strong></TtRow>}
    </TtBox>
  );
};

// ── Chart sub-component ───────────────────────────────────
function ChartCard({ title, icon, children }: {
  title: string; icon: string; children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardIcon>{icon}</CardIcon>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      {children}
    </Card>
  );
}

// ── Main page ─────────────────────────────────────────────
export default function DivePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();
  const { session } = useDiveSession();

  useEffect(() => { if (!session) navigate('/'); }, [session, navigate]);
  if (!session) return null;

  const diveIdx = parseInt(id ?? '0', 10);
  const dive: DetectedDive | undefined = session.dives[diveIdx];

  if (!dive) {
    return (
      <Page>
        <TopBar>
          <BackButton onClick={() => navigate('/session')}>← 세션으로</BackButton>
        </TopBar>
        <Content><p style={{ color: tokens.text.muted }}>다이브를 찾을 수 없습니다.</p></Content>
      </Page>
    );
  }

  const totalDives = session.dives.length;

  // ── Chart data ──────────────────────────────────────────
  const depthData = useMemo<DepthPoint[]>(() => {
    const recs = dive.records;
    const t0 = recs[0].timestamp.getTime();
    return recs.map((r) => ({
      t: Math.round((r.timestamp.getTime() - t0) / 1000),
      depth: parseFloat(r.depthM.toFixed(2)),
      hr: r.heartRate,
    }));
  }, [dive]);

  const rateData = useMemo<RatePoint[]>(() => {
    const recs = dive.records;
    const t0 = recs[0].timestamp.getTime();
    return recs.map((r, i) => {
      const t = Math.round((r.timestamp.getTime() - t0) / 1000);
      if (i === 0) return { t, desc: 0, asc: 0 };
      const dt = (r.timestamp.getTime() - recs[i - 1].timestamp.getTime()) / 1000;
      const rateMps = dt > 0 ? (r.depthM - recs[i - 1].depthM) / dt : 0; // m/s
      return {
        t,
        desc: rateMps >  0.02 ? parseFloat(rateMps.toFixed(2)) : 0,
        asc:  rateMps < -0.02 ? parseFloat(Math.abs(rateMps).toFixed(2)) : 0,
      };
    });
  }, [dive]);

  const tempData = useMemo<TempPoint[]>(() => {
    const recs = dive.records;
    const t0 = recs[0].timestamp.getTime();
    return recs
      .filter((r) => r.temperatureC !== null)
      .map((r) => ({
        t: Math.round((r.timestamp.getTime() - t0) / 1000),
        temp: r.temperatureC,
      }));
  }, [dive]);

  const hasTemp = tempData.length > 0;
  const maxDepth = Math.ceil(dive.maxDepthM + 1);

  const tempMin = hasTemp
    ? Math.floor(Math.min(...tempData.map((d) => d.temp!)) - 1)
    : 0;
  const tempMax = hasTemp
    ? Math.ceil(Math.max(...tempData.map((d) => d.temp!)) + 1)
    : 40;

  const maxRate = useMemo(() => {
    const m = Math.max(
      ...rateData.map((d) => Math.max(d.desc, d.asc)),
      5,
    );
    return Math.ceil(m / 5) * 5;
  }, [rateData]);

  /** Format elapsed seconds as m:ss (e.g. 0:05, 1:30, 2:45) */
  const xTickFormatter = (v: number) => {
    const m = Math.floor(v / 60);
    const s = Math.floor(v % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <Page>
      {/* ── Top bar ── */}
      <TopBar>
        <BackButton onClick={() => navigate('/session')}>
          ← 세션으로
        </BackButton>
        <DiveTitle>
          🤿 다이브 #{diveIdx + 1}
          <DiveSub>{formatDate(dive.startTime)} · {formatTime(dive.startTime)}</DiveSub>
        </DiveTitle>
        <Spacer />
        <TabNav>
          <Tab $active={false} onClick={() => navigate('/session')}>📊 세션 요약</Tab>
          <Tab $active={true}  onClick={() => {}}>🤿 다이브 상세</Tab>
          <Tab $active={location.pathname === '/raw'} onClick={() => navigate('/raw')}>🗃 Raw Data</Tab>
        </TabNav>
      </TopBar>

      <Content>
        {/* ── Dive navigation ── */}
        <DiveNav>
          <NavButton
            disabled={diveIdx <= 0}
            onClick={() => navigate(`/dive/${diveIdx - 1}`)}
          >
            ‹ 이전
          </NavButton>
          <DiveCounter>{diveIdx + 1} / {totalDives}</DiveCounter>
          <NavButton
            disabled={diveIdx >= totalDives - 1}
            onClick={() => navigate(`/dive/${diveIdx + 1}`)}
          >
            다음 ›
          </NavButton>
        </DiveNav>

        {/* ── Stats bar ── */}
        <StatsBar>
          <StatBadge label="최대 수심"   value={dive.maxDepthM.toFixed(1)}  unit="m"    color={C.depth} />
          <StatDivider />
          <StatBadge label="총 시간"     value={formatDuration(dive.durationSeconds)} color={tokens.text.primary} />
          <StatDivider />
          <StatBadge label="잠수 시간"   value={formatDuration(dive.bottomTimeSeconds)} color={tokens.accent.teal} />
          <StatDivider />
          <StatBadge label="평균 수심"   value={dive.avgDepthM.toFixed(1)}  unit="m" />
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
        <ChartCard title="수심 프로파일" icon="📈">
          <ChartLegend>
            <LegDot $c={C.depth} /> 수심 &nbsp;
            <LegDot $c={C.hr} /> 심박수
          </ChartLegend>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={depthData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="dg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={C.depth} stopOpacity={0.45} />
                  <stop offset="100%" stopColor={C.depth} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={tokens.chart.grid} vertical={false} />
              <XAxis dataKey="t" type="number" domain={['dataMin','dataMax']}
                tickFormatter={xTickFormatter}
                tick={{ fill: tokens.text.muted, fontSize: 11 }} tickLine={false}
                axisLine={{ stroke: tokens.border.subtle }} interval="preserveStartEnd" />
              <YAxis yAxisId="d" orientation="left" reversed domain={[0, maxDepth]}
                tickFormatter={(v) => `${v}m`}
                tick={{ fill: tokens.text.muted, fontSize: 11 }} tickLine={false} axisLine={false} width={44} />
              <YAxis yAxisId="h" orientation="right" domain={[40, 180]}
                tick={{ fill: tokens.text.muted, fontSize: 11 }} tickLine={false} axisLine={false} width={36} />
              <Tooltip content={<DepthTooltip />} />
              <ReferenceLine yAxisId="d" y={0} stroke={tokens.border.default} strokeDasharray="4 4" />
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
                  <stop offset="0%" stopColor={C.descent} stopOpacity={0.5} />
                  <stop offset="100%" stopColor={C.descent} stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="ascGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={C.ascent} stopOpacity={0.5} />
                  <stop offset="100%" stopColor={C.ascent} stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={tokens.chart.grid} vertical={false} />
              <XAxis dataKey="t" type="number" domain={['dataMin','dataMax']}
                tickFormatter={xTickFormatter}
                tick={{ fill: tokens.text.muted, fontSize: 11 }} tickLine={false}
                axisLine={{ stroke: tokens.border.subtle }} interval="preserveStartEnd" />
              <YAxis domain={[0, maxRate]}
                tickFormatter={(v) => `${v}`}
                tick={{ fill: tokens.text.muted, fontSize: 11 }} tickLine={false} axisLine={false} width={36} />
              <Tooltip content={<RateTooltip />} />
              <Area dataKey="desc" type="monotone"
                stroke={C.descent} strokeWidth={1.5} fill="url(#descGrad)"
                dot={false} isAnimationActive={false} />
              <Area dataKey="asc" type="monotone"
                stroke={C.ascent} strokeWidth={1.5} fill="url(#ascGrad)"
                dot={false} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
          <RateAxisLabel>m / s</RateAxisLabel>
        </ChartCard>

        {/* ── Heart rate chart ── */}
        {depthData.some((d) => d.hr != null) && (
          <ChartCard title="심박수" icon="❤️">
            <ResponsiveContainer width="100%" height={180}>
              <ComposedChart data={depthData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="hrGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.hr} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={C.hr} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={tokens.chart.grid} vertical={false} />
                <XAxis dataKey="t" type="number" domain={['dataMin','dataMax']}
                  tickFormatter={xTickFormatter}
                  tick={{ fill: tokens.text.muted, fontSize: 11 }} tickLine={false}
                  axisLine={{ stroke: tokens.border.subtle }} interval="preserveStartEnd" />
                <YAxis domain={[40, 180]} tickFormatter={(v) => `${v}`}
                  tick={{ fill: tokens.text.muted, fontSize: 11 }} tickLine={false} axisLine={false} width={36} />
                <Tooltip content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const hr = payload[0];
                  return (
                    <TtBox>
                      <TtTime>{Number(label).toFixed(0)}초</TtTime>
                      <TtRow $c={C.hr}><span>심박수</span><strong>{hr.value} bpm</strong></TtRow>
                    </TtBox>
                  );
                }} />
                <Area dataKey="hr" type="monotone"
                  stroke={C.hr} strokeWidth={1.5} fill="url(#hrGrad)"
                  dot={false} connectNulls isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
            <RateAxisLabel>bpm</RateAxisLabel>
          </ChartCard>
        )}

        {/* ── Water temperature chart ── */}
        {hasTemp && (
          <ChartCard title="수온" icon="🌡️">
            <ResponsiveContainer width="100%" height={180}>
              <ComposedChart data={tempData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="tempGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.temp} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={C.temp} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={tokens.chart.grid} vertical={false} />
                <XAxis dataKey="t" type="number" domain={['dataMin','dataMax']}
                  tickFormatter={xTickFormatter}
                  tick={{ fill: tokens.text.muted, fontSize: 11 }} tickLine={false}
                  axisLine={{ stroke: tokens.border.subtle }} interval="preserveStartEnd" />
                <YAxis domain={[tempMin, tempMax]} tickFormatter={(v) => `${v}°`}
                  tick={{ fill: tokens.text.muted, fontSize: 11 }} tickLine={false} axisLine={false} width={36} />
                <Tooltip content={<TempTooltip />} />
                <Area dataKey="temp" type="monotone"
                  stroke={C.temp} strokeWidth={1.5} fill="url(#tempGrad)"
                  dot={false} connectNulls isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
            <RateAxisLabel>°C</RateAxisLabel>
          </ChartCard>
        )}
      </Content>
    </Page>
  );
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/* ── Styled components ──────────────────────────────────── */
const Page = styled.div`
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: ${tokens.bg.base};
`;

const TopBar = styled.header`
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 14px 32px;
  background: ${tokens.bg.base}ee;
  backdrop-filter: blur(12px);
  border-bottom: 1px solid ${tokens.border.subtle};
`;

const BackButton = styled.button`
  font-size: 13px;
  color: ${tokens.text.secondary};
  background: ${tokens.bg.surface};
  border: 1px solid ${tokens.border.subtle};
  border-radius: ${tokens.radius.md};
  padding: 7px 14px;
  white-space: nowrap;
  transition: all 0.2s;
  &:hover { border-color: ${tokens.accent.cyan}; color: ${tokens.accent.cyan}; }
`;

const DiveTitle = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 15px;
  font-weight: 700;
  color: ${tokens.text.primary};
`;

const DiveSub = styled.span`
  font-size: 11px;
  font-weight: 400;
  color: ${tokens.text.muted};
`;

const Spacer = styled.div` flex: 1; `;

const TabNav = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  background: ${tokens.bg.elevated};
  border: 1px solid ${tokens.border.subtle};
  border-radius: ${tokens.radius.md};
  padding: 3px;
`;

const Tab = styled.button<{ $active: boolean }>`
  font-size: 12px;
  font-weight: ${({ $active }) => ($active ? '600' : '400')};
  padding: 5px 14px;
  border-radius: 7px;
  color: ${({ $active }) => ($active ? tokens.text.primary : tokens.text.muted)};
  background: ${({ $active }) => ($active ? tokens.bg.surface : 'transparent')};
  border: ${({ $active }) => ($active ? `1px solid ${tokens.border.default}` : '1px solid transparent')};
  transition: all 0.15s;
  white-space: nowrap;
  &:hover { color: ${tokens.text.primary}; }
`;

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
`;

const CardIcon = styled.span` font-size: 16px; line-height: 1; `;

const CardTitle = styled.h2`
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: ${tokens.text.secondary};
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

const RateAxisLabel = styled.div`
  text-align: right;
  font-size: 10px;
  color: ${tokens.text.muted};
  margin-top: 4px;
  padding-right: 4px;
  opacity: 0.6;
  letter-spacing: 0.04em;
`;

const TtBox = styled.div`
  background: ${tokens.bg.elevated};
  border: 1px solid ${tokens.border.default};
  border-radius: ${tokens.radius.md};
  padding: 10px 14px;
  font-size: 12px;
  box-shadow: ${tokens.shadow.card};
`;

const TtTime = styled.div`
  color: ${tokens.text.muted};
  margin-bottom: 6px;
  font-size: 11px;
`;

const TtRow = styled.div<{ $c: string }>`
  display: flex;
  justify-content: space-between;
  gap: 16px;
  color: ${({ $c }) => $c};
  line-height: 1.8;
`;
