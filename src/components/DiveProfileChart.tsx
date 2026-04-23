import styled from 'styled-components';
import {
  ResponsiveContainer, Area, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ComposedChart, ReferenceLine,
} from 'recharts';
import { tokens } from '../styles/GlobalStyle';
import type { DetectedDive, DiveRecord } from '../types/dive';
import { useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { TtBox, TtTime, TtRow } from './ui/ChartTooltip';

interface Props {
  records: DiveRecord[];
  dives?:  DetectedDive[];
}

interface ChartPoint {
  t: number;         // elapsed minutes from session start
  depth: number;     // m (positive)
  hr: number | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Find which dive (if any) contains the given elapsed-minutes value. */
function findActiveDive(
  tMin: number,
  dives: DetectedDive[],
): DetectedDive | undefined {
  return dives.find((dive) => {
    const startMin = dive.records[0].elapsedSeconds / 60;
    const endMin   = dive.records[dive.records.length - 1].elapsedSeconds / 60;
    return tMin >= startMin && tMin <= endMin;
  });
}

// ── Custom tooltip ─────────────────────────────────────────────────────────────
const CustomTooltip = ({
  active, payload, label, dives,
}: {
  active?: boolean;
  payload?: any[];
  label?: any;
  dives?: DetectedDive[];
}) => {
  if (!active || !payload?.length) return null;

  const depth = payload.find((p: any) => p.dataKey === 'depth');
  const hr    = payload.find((p: any) => p.dataKey === 'hr');
  const tMin  = Number(label);

  const activeDive = dives ? findActiveDive(tMin, dives) : undefined;

  const total = tMin * 60;           // total seconds
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = Math.round(total % 60);
  const timeLabel = h > 0 ? `${h}시간 ${m}분 ${s}초` : `${m}분 ${s}초`;

  return (
    <TtBox>
      <TtTime>{timeLabel}</TtTime>
      {activeDive && (
        <DiveBadge>
          🤿 다이브 #{activeDive.index + 1}
          <ClickHint>좌클릭 → 상세</ClickHint>
        </DiveBadge>
      )}
      {depth && (
        <TtRow $c={tokens.chart.depth}>
          <span>수심</span>
          <strong>{depth.value.toFixed(1)} m</strong>
        </TtRow>
      )}
      {hr && hr.value != null && (
        <TtRow $c={tokens.chart.hr}>
          <span>심박수</span>
          <strong>{hr.value} bpm</strong>
        </TtRow>
      )}
    </TtBox>
  );
};

// ── Component ──────────────────────────────────────────────────────────────────
export function DiveProfileChart({ records, dives }: Props) {
  const navigate  = useNavigate();
  const activeTRef = useRef<number | null>(null); // current hovered x value (minutes)

  // Downsample to every 5 seconds for performance
  const data = useMemo<ChartPoint[]>(() => {
    return records
      .filter((_, i) => i % 5 === 0)
      .map((r) => ({
        t:     parseFloat((r.elapsedSeconds / 60).toFixed(2)),
        depth: parseFloat(r.depthM.toFixed(2)),
        hr:    r.heartRate,
      }));
  }, [records]);

  const maxDepth = useMemo(
    () => Math.ceil(Math.max(...records.map((r) => r.depthM)) + 2),
    [records],
  );

  // Dive boundary reference lines (start of each dive, for visual context)
  const diveBoundaries = useMemo(() => {
    if (!dives) return [];
    return dives.flatMap((dive) => [
      {
        key: `start-${dive.index}`,
        t:   dive.records[0].elapsedSeconds / 60,
      },
    ]);
  }, [dives]);

  // ── Left-click: navigate to dive detail ──────────────────────────────────
  const handleOnClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (activeTRef.current == null || !dives) return;
    const dive = findActiveDive(activeTRef.current, dives);
    if (dive) navigate(`/dive/${dive.index}`);
  };

  // Tooltip renderer as a closure so it captures `dives` without extra prop drilling
  const tooltipContent = useMemo(
    () => (props: any) => <CustomTooltip {...props} dives={dives} />,
    [dives],
  );

  return (
    <Wrapper>
      <Header>
        <Title>다이브 프로파일</Title>
        <Legend2>
          <Dot $color={tokens.chart.depth} />
          <span>수심</span>
          <Dot $color={tokens.chart.hr} />
          <span>심박수</span>
          {dives && dives.length > 0 && (
            <ContextHint>다이브 구간 좌클릭 → 상세</ContextHint>
          )}
        </Legend2>
      </Header>

      <ChartArea onClick={handleOnClick}>
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart
            data={data}
            margin={{ top: 8, right: 16, bottom: 0, left: 0 }}
            onMouseMove={(state) => {
              // Track the currently hovered x (activeLabel is the t value)
              if (state?.activeLabel != null) {
                activeTRef.current = Number(state.activeLabel);
              }
            }}
            onMouseLeave={() => { activeTRef.current = null; }}
          >
            <defs>
              <linearGradient id="depthGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={tokens.chart.depth} stopOpacity={0.4} />
                <stop offset="100%" stopColor={tokens.chart.depth} stopOpacity={0.02} />
              </linearGradient>
            </defs>

            <CartesianGrid
              strokeDasharray="3 3"
              stroke={tokens.chart.grid}
              vertical={false}
            />

            <XAxis
              dataKey="t"
              type="number"
              domain={['dataMin', 'dataMax']}
              tickFormatter={(v) => {
                const total = Math.round(v * 60);
                const h = Math.floor(total / 3600);
                const m = Math.floor((total % 3600) / 60);
                return h > 0 ? `${h}시간 ${m}분` : `${m}분`;
              }}
              tick={{ fill: tokens.text.muted, fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: tokens.border.subtle }}
              interval="preserveStartEnd"
            />

            {/* Depth axis — inverted (0 at top, deeper at bottom) */}
            <YAxis
              yAxisId="depth"
              orientation="left"
              reversed
              domain={[0, maxDepth]}
              tickFormatter={(v) => `${v}m`}
              tick={{ fill: tokens.text.muted, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={44}
            />

            {/* HR axis */}
            <YAxis
              yAxisId="hr"
              orientation="right"
              domain={[40, 160]}
              tickFormatter={(v) => `${v}`}
              tick={{ fill: tokens.text.muted, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={36}
            />

            <Tooltip content={tooltipContent} />

            {/* Water surface reference */}
            <ReferenceLine
              yAxisId="depth"
              y={0}
              stroke={tokens.border.default}
              strokeDasharray="4 4"
            />

            {/* Dive start markers */}
            {diveBoundaries.map(({ key, t }) => (
              <ReferenceLine
                key={key}
                yAxisId="depth"
                x={t}
                stroke={tokens.chart.depth}
                strokeDasharray="3 4"
                strokeOpacity={0.35}
              />
            ))}

            <Area
              yAxisId="depth"
              dataKey="depth"
              type="monotone"
              stroke={tokens.chart.depth}
              strokeWidth={1.5}
              fill="url(#depthGrad)"
              dot={false}
              activeDot={{ r: 4, fill: tokens.chart.depth }}
              isAnimationActive={false}
            />

            <Line
              yAxisId="hr"
              dataKey="hr"
              type="monotone"
              stroke={tokens.chart.hr}
              strokeWidth={1}
              dot={false}
              activeDot={{ r: 3, fill: tokens.chart.hr }}
              connectNulls
              isAnimationActive={false}
              opacity={0.7}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartArea>

      <AxisLabels>
        <AxisLabel $color={tokens.chart.depth}>← 수심 (m)</AxisLabel>
        <AxisLabel $color={tokens.chart.hr}>심박수 (bpm) →</AxisLabel>
      </AxisLabels>
    </Wrapper>
  );
}

// ── Styled components ──────────────────────────────────────────────────────────

const Wrapper = styled.div`
  background: ${tokens.bg.surface};
  border: 1px solid ${tokens.border.subtle};
  border-radius: ${tokens.radius.lg};
  padding: 24px;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
`;

const Title = styled.h2`
  font-size: 14px;
  font-weight: 600;
  color: ${tokens.text.secondary};
  letter-spacing: 0.06em;
  text-transform: uppercase;
`;

const Legend2 = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: ${tokens.text.secondary};
`;

const Dot = styled.span<{ $color: string }>`
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${({ $color }) => $color};
`;

const ContextHint = styled.span`
  font-size: 10px;
  color: ${tokens.text.muted};
  opacity: 0.7;
  margin-left: 4px;
`;

const ChartArea = styled.div`
  cursor: default;
`;

const AxisLabels = styled.div`
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
  padding: 0 44px 0 0;
`;

const AxisLabel = styled.span<{ $color: string }>`
  font-size: 10px;
  color: ${({ $color }) => $color};
  opacity: 0.7;
  letter-spacing: 0.04em;
`;

// ── Tooltip extras ─────────────────────────────────────────────────────────────

const DiveBadge = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-size: 11px;
  font-weight: 600;
  color: ${tokens.accent.cyan};
  background: ${tokens.accent.cyan}14;
  border: 1px solid ${tokens.accent.cyan}33;
  border-radius: 6px;
  padding: 3px 8px;
  margin-bottom: 6px;
`;

const ClickHint = styled.span`
  font-size: 9px;
  font-weight: 400;
  color: ${tokens.text.muted};
  letter-spacing: 0.03em;
`;