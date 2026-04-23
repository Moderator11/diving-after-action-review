import styled from 'styled-components';
import { tokens } from '../styles/GlobalStyle';
import { formatDuration } from '../utils/parseFit';
import { hrStatus } from '../utils/chartUtils';
import type { DetectedDive, DiveSession } from '../types/dive';

// Chart colours needed here
const C_HR   = '#f97316'; // orange
const C_TEMP = '#a78bfa'; // violet

interface Props {
  dive:    DetectedDive;
  diveIdx: number;
  session: DiveSession;
}

export function DiveSummaryCard({ dive, diveIdx, session }: Props) {
  const diveEndTime = dive.records[dive.records.length - 1].timestamp;
  const nextDive    = session.dives[diveIdx + 1];
  const prevDive    = diveIdx > 0 ? session.dives[diveIdx - 1] : undefined;

  const surfaceAfter: number | null = nextDive
    ? (nextDive.startTime.getTime() - diveEndTime.getTime()) / 1000
    : null;
  const surfaceBefore: number | null = prevDive
    ? (dive.startTime.getTime() -
       prevDive.records[prevDive.records.length - 1].timestamp.getTime()) / 1000
    : null;

  // Pre-dive HR: last 3 min before dive start
  const diveStartMs = dive.startTime.getTime();
  const preDiveHRs  = session.records
    .filter((r) => {
      const t = r.timestamp.getTime();
      return t >= diveStartMs - 3 * 60_000 && t < diveStartMs && r.heartRate != null;
    })
    .map((r) => r.heartRate as number);
  const preDiveAvgHR = preDiveHRs.length > 0
    ? Math.round(preDiveHRs.reduce((a, b) => a + b, 0) / preDiveHRs.length)
    : null;

  // Post-dive HR: first 3 min after dive end
  const diveEndMs   = diveEndTime.getTime();
  const postDiveHRs = session.records
    .filter((r) => {
      const t = r.timestamp.getTime();
      return t > diveEndMs && t <= diveEndMs + 3 * 60_000 && r.heartRate != null;
    })
    .map((r) => r.heartRate as number);
  const postDiveAvgHR = postDiveHRs.length > 0
    ? Math.round(postDiveHRs.reduce((a, b) => a + b, 0) / postDiveHRs.length)
    : null;

  const parts: string[] = [
    `최대 ${dive.maxDepthM.toFixed(1)}m`,
    `잠수 시간 ${formatDuration(dive.bottomTimeSeconds)}`,
  ];
  if (dive.avgHR != null)   parts.push(`심박 평균 ${dive.avgHR}bpm`);
  if (surfaceAfter != null) parts.push(`다음 다이브까지 ${formatDuration(surfaceAfter)}`);

  return (
    <Card>
      <Header>
        <HeaderIcon>📋</HeaderIcon>
        <HeaderTitle>이 다이브 요약</HeaderTitle>
      </Header>
      <Narrative>{parts.join(' · ')}</Narrative>
      <Metrics>
        {surfaceBefore != null && (
          <Metric>
            <MetricLabel>전 표면 인터벌</MetricLabel>
            <MetricValue>{formatDuration(surfaceBefore)}</MetricValue>
          </Metric>
        )}
        {preDiveAvgHR != null && (() => {
          const s = hrStatus(preDiveAvgHR);
          return (
            <Metric>
              <MetricLabel>입수 전 심박</MetricLabel>
              <MetricValue $c={C_HR}>
                {preDiveAvgHR} <Badge $c={s.color}>{s.label}</Badge>
              </MetricValue>
            </Metric>
          );
        })()}
        {dive.avgHR != null && (() => {
          const s = hrStatus(dive.avgHR);
          return (
            <Metric>
              <MetricLabel>다이브 평균 심박</MetricLabel>
              <MetricValue $c={C_HR}>
                {dive.avgHR} <Badge $c={s.color}>{s.label}</Badge>
              </MetricValue>
            </Metric>
          );
        })()}
        {postDiveAvgHR != null && (() => {
          const s = hrStatus(postDiveAvgHR);
          return (
            <Metric>
              <MetricLabel>출수 후 심박</MetricLabel>
              <MetricValue $c={C_HR}>
                {postDiveAvgHR} <Badge $c={s.color}>{s.label}</Badge>
              </MetricValue>
            </Metric>
          );
        })()}
        {dive.avgTempC != null && (
          <Metric>
            <MetricLabel>평균 수온</MetricLabel>
            <MetricValue $c={C_TEMP}>{dive.avgTempC}°C</MetricValue>
          </Metric>
        )}
        {surfaceAfter != null && (
          <Metric>
            <MetricLabel>후 표면 인터벌</MetricLabel>
            <MetricValue>{formatDuration(surfaceAfter)}</MetricValue>
          </Metric>
        )}
      </Metrics>
    </Card>
  );
}

const Card = styled.div`
  background: ${tokens.bg.surface};
  border: 1px solid ${tokens.border.subtle};
  border-radius: ${tokens.radius.lg};
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 14px;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const HeaderIcon = styled.span`font-size: 16px; line-height: 1;`;

const HeaderTitle = styled.h2`
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: ${tokens.text.secondary};
`;

const Narrative = styled.p`
  font-size: 15px;
  font-weight: 500;
  color: ${tokens.text.primary};
  line-height: 1.5;
  padding: 10px 14px;
  background: ${tokens.bg.elevated};
  border-radius: ${tokens.radius.md};
  border-left: 3px solid ${tokens.accent.cyan};
`;

const Metrics = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0;
  border: 1px solid ${tokens.border.subtle};
  border-radius: ${tokens.radius.md};
  overflow: hidden;
`;

const Metric = styled.div`
  flex: 1;
  min-width: 120px;
  padding: 12px 18px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  border-right: 1px solid ${tokens.border.subtle};
  &:last-child { border-right: none; }
`;

const MetricLabel = styled.span`
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: ${tokens.text.muted};
`;

const MetricValue = styled.span<{ $c?: string }>`
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: ${({ $c }) => $c ?? tokens.text.primary};
  display: flex;
  align-items: center;
  gap: 6px;
`;

const Badge = styled.span<{ $c: string }>`
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
  padding: 2px 7px;
  border-radius: 999px;
  background: ${({ $c }) => $c}22;
  color: ${({ $c }) => $c};
  border: 1px solid ${({ $c }) => $c}44;
`;
