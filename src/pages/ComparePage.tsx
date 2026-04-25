import { useMemo, useState } from 'react';
import styled from 'styled-components';
import {
  ResponsiveContainer, ComposedChart, Area, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
} from 'recharts';

import { tokens } from '../styles/GlobalStyle';
import { useRequireSession } from '../hooks/useRequireSession';
import { fmtTick, buildDepthSeries, buildRateSeries } from '../utils/chartUtils';
import { formatDuration, formatDate } from '../utils/parseFit';
import { TtBox, TtTime, TtRow } from '../components/ui/ChartTooltip';
import { PageEl } from '../components/layout/TopBarPrimitives';
import { TopBar } from '../components/layout/TopBar';
import { Footer } from '../components/layout/Footer';
import { StarBtn } from '../components/StarBtn';
import type { DetectedDive } from '../types/dive';

// ── Dive colour palette ───────────────────────────────────
const PALETTE = [
  '#06b6d4', '#f97316', '#8b5cf6', '#10b981',
  '#f43f5e', '#f59e0b', '#3b82f6', '#ec4899',
] as const;

function diveColor(idx: number): string {
  return PALETTE[idx % PALETTE.length];
}

// ── Main page ─────────────────────────────────────────────
export default function ComparePage() {
  const session   = useRequireSession();

  if (!session) return null;

  const { dives } = session;

  const [selected, setSelected] = useState<Set<number>>(
    new Set(dives.length >= 2 ? [0, 1] : dives.length === 1 ? [0] : []),
  );

  const toggle = (idx: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  const selectedArr = [...selected].sort((a, b) => a - b);

  // ── Merged depth/HR series ────────────────────────────
  const depthChartData = useMemo(() => {
    if (selectedArr.length === 0) return [];
    const map = new Map<number, Record<string, number | null>>();
    selectedArr.forEach((diveIdx) => {
      buildDepthSeries(dives[diveIdx]).forEach(({ t, depth, hr }) => {
        if (!map.has(t)) map.set(t, { t });
        const row = map.get(t)!;
        row[`depth_${diveIdx}`] = depth;
        if (hr != null) row[`hr_${diveIdx}`] = hr;
      });
    });
    return [...map.entries()].sort(([a], [b]) => a - b).map(([, v]) => v);
  }, [selectedArr, dives]);

  // ── Merged rate series ────────────────────────────────
  const rateChartData = useMemo(() => {
    if (selectedArr.length === 0) return [];
    const map = new Map<number, Record<string, number | null>>();
    selectedArr.forEach((diveIdx) => {
      buildRateSeries(dives[diveIdx]).forEach(({ t, desc, asc }) => {
        if (!map.has(t)) map.set(t, { t });
        const row = map.get(t)!;
        row[`desc_${diveIdx}`] = desc;
        row[`asc_${diveIdx}`]  = asc;
      });
    });
    return [...map.entries()].sort(([a], [b]) => a - b).map(([, v]) => v);
  }, [selectedArr, dives]);

  const maxRate = useMemo(() => {
    if (selectedArr.length === 0) return 1;
    const m = Math.max(
      ...selectedArr.map((i) => Math.max(dives[i].maxDescentRateMps, dives[i].maxAscentRateMps)),
      0.2,
    );
    return parseFloat((Math.ceil(m * 10) / 10 + 0.1).toFixed(1));
  }, [selectedArr, dives]);

  const maxDepth = useMemo(() => {
    const m = Math.max(...selectedArr.map((i) => dives[i].maxDepthM), 5);
    return Math.ceil(m + 1);
  }, [selectedArr, dives]);

  const hasHR = selectedArr.some((i) =>
    dives[i].records.some((r) => r.heartRate != null),
  );

  // ── Shared chart axes ─────────────────────────────────
  const sharedXAxis = (
    <XAxis
      dataKey="t" type="number" domain={['dataMin', 'dataMax']}
      tickFormatter={fmtTick}
      tick={{ fill: tokens.text.muted, fontSize: 11 }} tickLine={false}
      axisLine={{ stroke: tokens.border.subtle }} interval="preserveStartEnd"
    />
  );

  return (
    <PageEl>
      <TopBar />

      <Layout>
        {/* ── Sidebar ── */}
        <Sidebar>
          <SidebarTitle>다이브 선택</SidebarTitle>
          <SidebarNote>최대 {PALETTE.length}개 동시 비교</SidebarNote>
          <DiveList>
            {dives.map((dive, idx) => {
              const isSelected = selected.has(idx);
              const color      = diveColor(selectedArr.indexOf(idx));
              return (
                <DiveItem
                  key={idx}
                  $selected={isSelected}
                  $color={isSelected ? color : tokens.border.subtle}
                  onClick={() => toggle(idx)}
                >
                  <DiveItemColor $c={isSelected ? color : tokens.border.default} />
                  <DiveItemInfo>
                    <DiveItemTitle>다이브 #{idx + 1}</DiveItemTitle>
                    <DiveItemMeta>
                      {formatDate(dive.startTime)}<br />
                      최대 {dive.maxDepthM.toFixed(1)}m · {formatDuration(dive.durationSeconds)}
                      {dive.avgHR != null && ` · ${dive.avgHR}bpm`}
                    </DiveItemMeta>
                  </DiveItemInfo>
                  <StarBtn diveIdx={idx} size="sm" />
                  <DiveCheck $selected={isSelected} $c={isSelected ? color : 'transparent'}>
                    {isSelected && '✓'}
                  </DiveCheck>
                </DiveItem>
              );
            })}
          </DiveList>

          {/* ── Stats table ── */}
          {selectedArr.length >= 2 && (
            <StatsTable>
              <SidebarTitle style={{ marginTop: 24 }}>수치 비교</SidebarTitle>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8 }}>
                <thead>
                  <tr>
                    <Th>항목</Th>
                    {selectedArr.map((i) => (
                      <Th key={i} style={{ color: diveColor(selectedArr.indexOf(i)) }}>
                        #{i + 1}
                      </Th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(
                    [
                      { label: '최대 수심', fmt: (d: DetectedDive) => `${d.maxDepthM.toFixed(1)}m` },
                      { label: '총 시간',   fmt: (d: DetectedDive) => formatDuration(d.durationSeconds) },
                      { label: '잠수 시간', fmt: (d: DetectedDive) => formatDuration(d.bottomTimeSeconds) },
                      { label: '평균 심박', fmt: (d: DetectedDive) => d.avgHR != null ? `${d.avgHR}bpm` : '-' },
                      { label: '최고 심박', fmt: (d: DetectedDive) => d.maxHR != null ? `${d.maxHR}bpm` : '-' },
                      { label: '최대 하강', fmt: (d: DetectedDive) => `${d.maxDescentRateMps.toFixed(2)}m/s` },
                      { label: '최대 상승', fmt: (d: DetectedDive) => `${d.maxAscentRateMps.toFixed(2)}m/s` },
                      { label: '수온',      fmt: (d: DetectedDive) => d.avgTempC != null ? `${d.avgTempC}°C` : '-' },
                    ] as const
                  ).map(({ label, fmt }) => (
                    <tr key={label}>
                      <Td>{label}</Td>
                      {selectedArr.map((i) => <Td key={i}>{fmt(dives[i])}</Td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </StatsTable>
          )}
        </Sidebar>

        {/* ── Main charts ── */}
        <Charts>
          {selectedArr.length === 0 && (
            <EmptyState>
              <EmptyIcon>🤿</EmptyIcon>
              <EmptyText>왼쪽에서 비교할 다이브를 선택하세요</EmptyText>
            </EmptyState>
          )}

          {selectedArr.length > 0 && (
            <>
              {/* Legend */}
              <LegendRow>
                {selectedArr.map((i) => (
                  <LegendItem key={i}>
                    <LegendDot $c={diveColor(selectedArr.indexOf(i))} />
                    <span>다이브 #{i + 1}</span>
                    <LegendSub>{formatDate(dives[i].startTime)}</LegendSub>
                  </LegendItem>
                ))}
              </LegendRow>

              {/* ── Depth chart ── */}
              <ChartCard>
                <ChartCardHeader>
                  <ChartCardIcon>📈</ChartCardIcon>
                  <ChartCardTitle>수심 프로파일 비교</ChartCardTitle>
                  <ChartCardNote>t=0 → 각 다이브 입수 시점</ChartCardNote>
                </ChartCardHeader>
                <ResponsiveContainer width="100%" height={320}>
                  <ComposedChart data={depthChartData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                    <defs>
                      {selectedArr.map((diveIdx, ci) => (
                        <linearGradient key={diveIdx} id={`dg_${diveIdx}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%"   stopColor={diveColor(ci)} stopOpacity={0.3} />
                          <stop offset="100%" stopColor={diveColor(ci)} stopOpacity={0.02} />
                        </linearGradient>
                      ))}
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={tokens.chart.grid} vertical={false} />
                    {sharedXAxis}
                    <YAxis reversed domain={[0, maxDepth]} tickFormatter={(v) => `${v}m`}
                      tick={{ fill: tokens.text.muted, fontSize: 11 }} tickLine={false} axisLine={false} width={44} />
                    <Tooltip content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      return (
                        <TtBox>
                          <TtTime>{fmtTick(Number(label))}</TtTime>
                          {selectedArr.map((i, ci) => {
                            const p = payload.find((x: any) => x.dataKey === `depth_${i}`);
                            if (!p || p.value == null) return null;
                            return (
                              <TtRow key={i} $c={diveColor(ci)}>
                                <span>다이브 #{i + 1}</span>
                                <strong>{Number(p.value).toFixed(1)} m</strong>
                              </TtRow>
                            );
                          })}
                        </TtBox>
                      );
                    }} />
                    <ReferenceLine x={0} stroke={tokens.border.subtle} strokeDasharray="4 3" />
                    {selectedArr.map((diveIdx, ci) => (
                      <Area key={diveIdx} dataKey={`depth_${diveIdx}`}
                        name={`다이브 #${diveIdx + 1}`} type="monotone"
                        stroke={diveColor(ci)} strokeWidth={2} fill={`url(#dg_${diveIdx})`}
                        dot={false} connectNulls isAnimationActive={false}
                        activeDot={{ r: 4, fill: diveColor(ci) }} />
                    ))}
                  </ComposedChart>
                </ResponsiveContainer>
              </ChartCard>

              {/* ── Rate chart ── */}
              <ChartCard>
                <ChartCardHeader>
                  <ChartCardIcon>🚀</ChartCardIcon>
                  <ChartCardTitle>하강 · 상승 속도 비교</ChartCardTitle>
                  <ChartCardNote>실선 = 하강 &nbsp;·&nbsp; 점선 = 상승</ChartCardNote>
                </ChartCardHeader>
                <ResponsiveContainer width="100%" height={220}>
                  <ComposedChart data={rateChartData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                    <defs>
                      {selectedArr.map((diveIdx, ci) => (
                        <linearGradient key={diveIdx} id={`rg_${diveIdx}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%"   stopColor={diveColor(ci)} stopOpacity={0.2} />
                          <stop offset="100%" stopColor={diveColor(ci)} stopOpacity={0.01} />
                        </linearGradient>
                      ))}
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={tokens.chart.grid} vertical={false} />
                    {sharedXAxis}
                    <YAxis domain={[0, maxRate]}
                      tick={{ fill: tokens.text.muted, fontSize: 11 }} tickLine={false} axisLine={false} width={36} />
                    <Tooltip content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      return (
                        <TtBox>
                          <TtTime>{fmtTick(Number(label))}</TtTime>
                          {selectedArr.map((i, ci) => {
                            const d  = payload.find((x: any) => x.dataKey === `desc_${i}`);
                            const a  = payload.find((x: any) => x.dataKey === `asc_${i}`);
                            const dv = d?.value as number | undefined;
                            const av = a?.value as number | undefined;
                            if ((!dv || dv === 0) && (!av || av === 0)) return null;
                            return (
                              <TtRow key={i} $c={diveColor(ci)}>
                                <span>#{i + 1}</span>
                                <strong>
                                  {dv && dv > 0 ? `↓${dv.toFixed(2)}` : ''}
                                  {av && av > 0 ? `↑${av.toFixed(2)}` : ''}
                                  {' '}m/s
                                </strong>
                              </TtRow>
                            );
                          })}
                        </TtBox>
                      );
                    }} />
                    <ReferenceLine x={0} stroke={tokens.border.subtle} strokeDasharray="4 3" />
                    {selectedArr.map((diveIdx, ci) => (
                      <Area key={`desc-${diveIdx}`} dataKey={`desc_${diveIdx}`}
                        name={`다이브 #${diveIdx + 1} 하강`} type="monotone"
                        stroke={diveColor(ci)} strokeWidth={1.8} fill={`url(#rg_${diveIdx})`}
                        dot={false} connectNulls isAnimationActive={false}
                        activeDot={{ r: 3, fill: diveColor(ci) }} />
                    ))}
                    {selectedArr.map((diveIdx, ci) => (
                      <Line key={`asc-${diveIdx}`} dataKey={`asc_${diveIdx}`}
                        name={`다이브 #${diveIdx + 1} 상승`} type="monotone"
                        stroke={diveColor(ci)} strokeWidth={1.5} strokeDasharray="5 3"
                        dot={false} connectNulls isAnimationActive={false}
                        activeDot={{ r: 3, fill: diveColor(ci) }} />
                    ))}
                  </ComposedChart>
                </ResponsiveContainer>
                <AxisLabel>m / s</AxisLabel>
              </ChartCard>

              {/* ── HR chart ── */}
              {hasHR && (
                <ChartCard>
                  <ChartCardHeader>
                    <ChartCardIcon>❤️</ChartCardIcon>
                    <ChartCardTitle>심박수 비교</ChartCardTitle>
                    <ChartCardNote>t=0 → 각 다이브 입수 시점</ChartCardNote>
                  </ChartCardHeader>
                  <ResponsiveContainer width="100%" height={240}>
                    <ComposedChart data={depthChartData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                      <defs>
                        {selectedArr.map((diveIdx, ci) => (
                          <linearGradient key={diveIdx} id={`hrg_${diveIdx}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%"   stopColor={diveColor(ci)} stopOpacity={0.25} />
                            <stop offset="100%" stopColor={diveColor(ci)} stopOpacity={0.01} />
                          </linearGradient>
                        ))}
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={tokens.chart.grid} vertical={false} />
                      {sharedXAxis}
                      <YAxis domain={[40, 200]}
                        tick={{ fill: tokens.text.muted, fontSize: 11 }} tickLine={false} axisLine={false} width={36} />
                      <Tooltip content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null;
                        return (
                          <TtBox>
                            <TtTime>{fmtTick(Number(label))}</TtTime>
                            {selectedArr.map((i, ci) => {
                              const p = payload.find((x: any) => x.dataKey === `hr_${i}`);
                              if (!p || p.value == null) return null;
                              return (
                                <TtRow key={i} $c={diveColor(ci)}>
                                  <span>다이브 #{i + 1}</span>
                                  <strong>{p.value} bpm</strong>
                                </TtRow>
                              );
                            })}
                          </TtBox>
                        );
                      }} />
                      <ReferenceLine x={0} stroke={tokens.border.subtle} strokeDasharray="4 3" />
                      {selectedArr.map((diveIdx, ci) => (
                        <Line key={diveIdx} dataKey={`hr_${diveIdx}`}
                          name={`다이브 #${diveIdx + 1} bpm`} type="monotone"
                          stroke={diveColor(ci)} strokeWidth={1.5}
                          dot={false} connectNulls isAnimationActive={false}
                          activeDot={{ r: 3, fill: diveColor(ci) }} />
                      ))}
                    </ComposedChart>
                  </ResponsiveContainer>
                  <AxisLabel>bpm</AxisLabel>
                </ChartCard>
              )}

              {/* ── Metric bars ── */}
              <ChartCard>
                <ChartCardHeader>
                  <ChartCardIcon>📊</ChartCardIcon>
                  <ChartCardTitle>주요 지표 비교</ChartCardTitle>
                </ChartCardHeader>
                <MetricBars>
                  {(
                    [
                      { label: '최대 수심 (m)',  key: 'maxDepthM',         fmt: (v: number) => `${v.toFixed(1)}m`,  max: Math.max(...selectedArr.map((i) => dives[i].maxDepthM)) },
                      { label: '잠수 시간 (분)',  key: 'bottomTimeSeconds', fmt: (v: number) => formatDuration(v),   max: Math.max(...selectedArr.map((i) => dives[i].bottomTimeSeconds)) },
                      { label: '평균 심박 (bpm)', key: 'avgHR',            fmt: (v: number | null) => v != null ? `${v}bpm` : '-', max: Math.max(...selectedArr.map((i) => dives[i].avgHR ?? 0)) },
                    ] as const
                  ).map(({ label, key, fmt, max }) => (
                    <MetricBarRow key={key}>
                      <MetricBarLabel>{label}</MetricBarLabel>
                      <MetricBarBars>
                        {selectedArr.map((i, ci) => {
                          const raw = (dives[i] as any)[key] as number | null;
                          const pct = raw != null && max > 0 ? (raw / max) * 100 : 0;
                          return (
                            <MetricBarItem key={i}>
                              <MetricBarTrack>
                                <MetricBarFill $pct={pct} $c={diveColor(ci)} />
                              </MetricBarTrack>
                              <MetricBarValue $c={diveColor(ci)}>
                                {raw != null ? fmt(raw as number) : '-'}
                              </MetricBarValue>
                              <MetricBarName>#{i + 1}</MetricBarName>
                            </MetricBarItem>
                          );
                        })}
                      </MetricBarBars>
                    </MetricBarRow>
                  ))}
                </MetricBars>
              </ChartCard>
            </>
          )}
        </Charts>
      </Layout>
      <Footer />
    </PageEl>
  );
}

/* ── Styled components ──────────────────────────────────── */

const Layout = styled.div`
  display: flex; flex: 1; gap: 24px;
  max-width: 1400px; width: 100%; margin: 0 auto;
  padding: 28px 24px 60px;
  @media (max-width: 900px) { flex-direction: column; }
`;

const Sidebar = styled.aside`
  width: 280px; flex-shrink: 0;
  display: flex; flex-direction: column; gap: 4px;
`;

const SidebarTitle = styled.h2`
  font-size: 11px; font-weight: 600; letter-spacing: 0.08em;
  text-transform: uppercase; color: ${tokens.text.muted};
  margin-bottom: 6px;
`;

const SidebarNote = styled.p`
  font-size: 11px; color: ${tokens.text.muted}; margin-bottom: 8px;
`;

const DiveList = styled.div`
  display: flex; flex-direction: column; gap: 6px;
`;

const DiveItem = styled.div<{ $selected: boolean; $color: string }>`
  display: flex; align-items: center; gap: 10px;
  padding: 10px 12px; border-radius: ${tokens.radius.md};
  border: 1px solid ${({ $selected, $color }) => $selected ? $color + '60' : tokens.border.subtle};
  background: ${({ $selected, $color }) => $selected ? $color + '0d' : tokens.bg.surface};
  cursor: pointer; transition: all 0.15s;
  &:hover { border-color: ${({ $color }) => $color}; }
`;

const DiveItemColor = styled.div<{ $c: string }>`
  width: 4px; height: 36px; border-radius: 2px;
  background: ${({ $c }) => $c}; flex-shrink: 0;
`;

const DiveItemInfo = styled.div` flex: 1; overflow: hidden; `;

const DiveItemTitle = styled.div`
  font-size: 13px; font-weight: 600; color: ${tokens.text.primary};
`;

const DiveItemMeta = styled.div`
  font-size: 11px; color: ${tokens.text.muted}; line-height: 1.5; margin-top: 2px;
`;

const DiveCheck = styled.div<{ $selected: boolean; $c: string }>`
  width: 18px; height: 18px; border-radius: 50%;
  border: 1.5px solid ${({ $c, $selected }) => $selected ? $c : tokens.border.subtle};
  background: ${({ $c, $selected }) => $selected ? $c : 'transparent'};
  display: flex; align-items: center; justify-content: center;
  font-size: 10px; font-weight: 700; color: ${tokens.bg.base};
  flex-shrink: 0; transition: all 0.15s;
`;

const StatsTable = styled.div` margin-top: 4px; `;

const Th = styled.th`
  font-size: 10px; font-weight: 600; letter-spacing: 0.06em;
  text-transform: uppercase; color: ${tokens.text.muted};
  text-align: left; padding: 6px 8px;
  border-bottom: 1px solid ${tokens.border.subtle};
`;

const Td = styled.td`
  font-size: 12px; color: ${tokens.text.secondary};
  padding: 6px 8px; border-bottom: 1px solid ${tokens.border.subtle};
  &:first-child { color: ${tokens.text.muted}; font-size: 11px; }
`;

const Charts = styled.main`
  flex: 1; display: flex; flex-direction: column; gap: 20px; min-width: 0;
`;

const EmptyState = styled.div`
  flex: 1; display: flex; flex-direction: column; align-items: center;
  justify-content: center; gap: 16px;
  padding: 80px 0; text-align: center;
`;

const EmptyIcon = styled.div` font-size: 48px; `;

const EmptyText = styled.p`
  font-size: 15px; color: ${tokens.text.muted};
`;

const LegendRow = styled.div`
  display: flex; flex-wrap: wrap; gap: 16px;
`;

const LegendItem = styled.div`
  display: flex; align-items: center; gap: 6px;
  font-size: 13px; color: ${tokens.text.secondary};
`;

const LegendDot = styled.span<{ $c: string }>`
  display: inline-block; width: 10px; height: 10px;
  border-radius: 50%; background: ${({ $c }) => $c};
`;

const LegendSub = styled.span`
  font-size: 11px; color: ${tokens.text.muted};
`;

const ChartCard = styled.div`
  background: ${tokens.bg.surface}; border: 1px solid ${tokens.border.subtle};
  border-radius: ${tokens.radius.lg}; padding: 20px 24px 16px;
`;

const ChartCardHeader = styled.div`
  display: flex; align-items: center; gap: 8px; margin-bottom: 16px;
`;

const ChartCardIcon = styled.span` font-size: 16px; line-height: 1; `;

const ChartCardTitle = styled.h2`
  font-size: 13px; font-weight: 600; letter-spacing: 0.06em;
  text-transform: uppercase; color: ${tokens.text.secondary};
`;

const ChartCardNote = styled.span`
  font-size: 11px; color: ${tokens.text.muted}; margin-left: 8px;
`;

const AxisLabel = styled.div`
  text-align: right; font-size: 10px; color: ${tokens.text.muted};
  margin-top: 4px; padding-right: 4px; opacity: 0.6; letter-spacing: 0.04em;
`;

const MetricBars = styled.div`
  display: flex; flex-direction: column; gap: 20px;
`;

const MetricBarRow = styled.div``;

const MetricBarLabel = styled.div`
  font-size: 11px; font-weight: 600; letter-spacing: 0.06em;
  text-transform: uppercase; color: ${tokens.text.muted}; margin-bottom: 8px;
`;

const MetricBarBars = styled.div`
  display: flex; flex-direction: column; gap: 6px;
`;

const MetricBarItem = styled.div`
  display: flex; align-items: center; gap: 10px;
`;

const MetricBarTrack = styled.div`
  flex: 1; height: 6px; border-radius: 3px;
  background: ${tokens.bg.elevated}; overflow: hidden;
`;

const MetricBarFill = styled.div<{ $pct: number; $c: string }>`
  height: 100%;
  width: ${({ $pct }) => $pct}%;
  background: ${({ $c }) => $c};
  border-radius: 3px;
  transition: width 0.4s ease;
`;

const MetricBarValue = styled.span<{ $c: string }>`
  font-size: 12px; font-weight: 600; color: ${({ $c }) => $c};
  min-width: 60px; text-align: right;
`;

const MetricBarName = styled.span`
  font-size: 11px; color: ${tokens.text.muted}; min-width: 24px;
`;
