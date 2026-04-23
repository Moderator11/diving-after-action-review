import styled from 'styled-components';
import { tokens } from '../styles/GlobalStyle';
import { fmtTick, severityColor, severityIcon, spikeIcon } from '../utils/chartUtils';
import type { DiveEvent } from '../types/dive';
import type { DiveSpike } from '../utils/spikes';

interface Props {
  spikes:       DiveSpike[];
  diveEvents:   DiveEvent[];
  t0Ms:         number;
  showHR:       boolean;
  showDescent:  boolean;
  showAscent:   boolean;
  showEvents:   boolean;
}

export function SpikeEventLog({
  spikes, diveEvents, t0Ms,
  showHR, showDescent, showAscent, showEvents,
}: Props) {
  const visibleEvents = showEvents ? diveEvents : [];
  const visibleSpikes = spikes.filter((s) =>
    (s.type === 'hr'      && showHR)      ||
    (s.type === 'descent' && showDescent) ||
    (s.type === 'ascent'  && showAscent)
  );

  if (visibleEvents.length === 0 && visibleSpikes.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardIcon>⚡</CardIcon>
        <CardTitle>스파이크 &amp; 이벤트 로그</CardTitle>
        <CountNote>
          스파이크 {visibleSpikes.length}건 · FIT 이벤트 {visibleEvents.length}건
        </CountNote>
      </CardHeader>
      <LogTable>
        <LogHead>
          <LogRow>
            <LogTh>시각</LogTh>
            <LogTh>종류</LogTh>
            <LogTh>내용</LogTh>
            <LogTh style={{ textAlign: 'right' }}>수치</LogTh>
          </LogRow>
        </LogHead>
        <tbody>
          {visibleEvents.map((e, i) => {
            const t   = (e.timestamp.getTime() - t0Ms) / 1000;
            const col = severityColor(e.severity);
            return (
              <LogRow key={`evt-${i}`}>
                <LogTd $c={col}>{fmtTick(t)}</LogTd>
                <LogTd>
                  <LogBadge $c={col}>
                    {severityIcon(e.severity)} FIT 이벤트
                  </LogBadge>
                </LogTd>
                <LogTd $c={col} style={{ fontWeight: 500 }}>{e.label}</LogTd>
                <LogTd style={{ textAlign: 'right', color: tokens.text.muted, fontFamily: 'monospace' }}>
                  {e.event}
                </LogTd>
              </LogRow>
            );
          })}
          {visibleSpikes.map((s, i) => (
            <LogRow key={`sp-${i}`}>
              <LogTd $c={s.color}>{fmtTick(s.t)}</LogTd>
              <LogTd>
                <LogBadge $c={s.color}>
                  {spikeIcon(s.type)}
                  {s.type === 'hr' ? ' 심박 급변' : s.type === 'descent' ? ' 급하강' : ' 급상승'}
                </LogBadge>
              </LogTd>
              <LogTd $c={s.color} style={{ fontWeight: 500 }}>{s.label}</LogTd>
              <LogTd style={{ textAlign: 'right' }}>
                <RankBadge $rank={s.rank}>Top {s.rank}</RankBadge>
              </LogTd>
            </LogRow>
          ))}
        </tbody>
      </LogTable>
    </Card>
  );
}

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

const CardIcon = styled.span`font-size: 16px; line-height: 1;`;

const CardTitle = styled.h2`
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: ${tokens.text.secondary};
`;

const CountNote = styled.span`
  margin-left: auto;
  font-size: 11px;
  color: ${tokens.text.muted};
`;

const LogTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
`;

const LogHead = styled.thead`
  border-bottom: 1px solid ${tokens.border.subtle};
`;

const LogRow = styled.tr`
  border-bottom: 1px solid ${tokens.border.subtle};
  &:last-child { border-bottom: none; }
  &:hover td { background: ${tokens.bg.elevated}22; }
`;

const LogTh = styled.th`
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: ${tokens.text.muted};
  padding: 6px 10px;
  text-align: left;
`;

const LogTd = styled.td<{ $c?: string }>`
  padding: 8px 10px;
  color: ${({ $c }) => $c ?? tokens.text.secondary};
  font-variant-numeric: tabular-nums;
  vertical-align: middle;
`;

const LogBadge = styled.span<{ $c: string }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
  padding: 2px 8px;
  border-radius: 999px;
  background: ${({ $c }) => $c}18;
  color: ${({ $c }) => $c};
  border: 1px solid ${({ $c }) => $c}33;
  white-space: nowrap;
`;

const RankBadge = styled.span<{ $rank: number }>`
  font-size: 10px;
  font-weight: 700;
  padding: 1px 7px;
  border-radius: 6px;
  background: ${({ $rank }) =>
    $rank === 1 ? '#f43f5e22' : $rank === 2 ? '#f9731622' : '#f59e0b22'};
  color: ${({ $rank }) =>
    $rank === 1 ? '#f43f5e' : $rank === 2 ? '#f97316' : '#f59e0b'};
`;
