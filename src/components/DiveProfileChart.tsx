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
import type { DiveRecord } from '../types/dive';
import { useMemo } from 'react';

interface Props {
  records: DiveRecord[];
}

interface ChartPoint {
  t: number;         // elapsed minutes
  depth: number;     // m (positive)
  hr: number | null;
}

// Custom tooltip
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const depth = payload.find((p: any) => p.dataKey === 'depth');
  const hr = payload.find((p: any) => p.dataKey === 'hr');
  return (
    <TooltipBox>
      <TtTime>{(() => {
        const total = Number(label);
        const h = Math.floor(total / 60);
        const m = Math.floor(total % 60);
        const s = Math.round((total % 1) * 60);
        return h > 0
          ? `${h}시간 ${m}분 ${s}초`
          : `${m}분 ${s}초`;
      })()}</TtTime>
      {depth && (
        <TtRow $color={tokens.chart.depth}>
          <span>수심</span>
          <strong>{depth.value.toFixed(1)} m</strong>
        </TtRow>
      )}
      {hr && hr.value != null && (
        <TtRow $color={tokens.chart.hr}>
          <span>심박수</span>
          <strong>{hr.value} bpm</strong>
        </TtRow>
      )}
    </TooltipBox>
  );
};

export function DiveProfileChart({ records }: Props) {
  // Downsample to every 5 seconds for performance
  const data = useMemo<ChartPoint[]>(() => {
    return records
      .filter((_, i) => i % 5 === 0)
      .map((r) => ({
        t: parseFloat((r.elapsedSeconds / 60).toFixed(2)),
        depth: parseFloat(r.depthM.toFixed(2)),
        hr: r.heartRate,
      }));
  }, [records]);

  const maxDepth = useMemo(
    () => Math.ceil(Math.max(...records.map((r) => r.depthM)) + 2),
    [records]
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
        </Legend2>
      </Header>
      <ChartArea>
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart
            data={data}
            margin={{ top: 8, right: 16, bottom: 0, left: 0 }}
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
                const total = Math.round(v);
                const h = Math.floor(total / 60);
                const m = total % 60;
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

            <Tooltip content={<CustomTooltip />} />

            {/* Water surface reference */}
            <ReferenceLine
              yAxisId="depth"
              y={0}
              stroke={tokens.border.default}
              strokeDasharray="4 4"
            />

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

const ChartArea = styled.div`
  /* recharts needs explicit height container */
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

const TooltipBox = styled.div`
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

const TtRow = styled.div<{ $color: string }>`
  display: flex;
  justify-content: space-between;
  gap: 16px;
  color: ${({ $color }) => $color};
  line-height: 1.8;
`;
