import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { tokens } from '../styles/GlobalStyle';
import type { DetectedDive } from '../types/dive';
import { formatDuration } from '../utils/parseFit';
import { calcAidaInterval } from '../utils/aidaInterval';
import { useDiveSession } from '../store/DiveContext';
import { StarBtn } from './StarBtn';

interface Props {
  dives: DetectedDive[];
}

function surfaceInterval(dives: DetectedDive[], idx: number): number | null {
  if (idx === 0) return null;
  const prev    = dives[idx - 1];
  const prevEnd = prev.records[prev.records.length - 1].timestamp;
  return (dives[idx].startTime.getTime() - prevEnd.getTime()) / 1000;
}

export function DiveTable({ dives }: Props) {
  const navigate = useNavigate();
  const { memos } = useDiveSession();

  const deepestIdx = dives.reduce((b, d, i) => d.maxDepthM       > dives[b].maxDepthM       ? i : b, 0);
  const longestIdx = dives.reduce((b, d, i) => d.durationSeconds > dives[b].durationSeconds ? i : b, 0);

  return (
    <Wrapper>
      <Header>
        <Title>다이브 로그</Title>
        <Badge>{dives.length}회 다이브</Badge>
        <Hint>행을 클릭하면 상세 차트를 볼 수 있습니다</Hint>
      </Header>

      <TableWrapper>
        <Table>
          <thead>
            <tr>
              <Th>★</Th>
              <Th>#</Th>
              <Th>시작 시각</Th>
              <Th>총 시간</Th>
              <Th>잠수 시간</Th>
              <Th>표면 시간</Th>
              <Th>최대 수심</Th>
              <Th>평균 수심</Th>
              <Th>최대 하강</Th>
              <Th>최대 상승</Th>
              <Th>최고 HR</Th>
              <Th>수온</Th>
              <Th>메모</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {dives.map((dive) => {
              const isDeepest = dive.index === deepestIdx;
              const isLongest = dive.index === longestIdx;
              const hasMemo   = !!(memos[dive.index]?.trim());
              return (
                <Tr
                  key={dive.index}
                  $highlight={isDeepest || isLongest}
                  onClick={() => navigate(`/dive/${dive.index}`)}
                >
                  {/* Star */}
                  <Td $center>
                    <StarBtn diveIdx={dive.index} size="sm" />
                  </Td>

                  {/* Index + badges */}
                  <Td $muted>
                    <IndexCell>
                      {dive.index + 1}
                      {isDeepest && <RowBadge $color={tokens.accent.cyan}>최대 수심</RowBadge>}
                      {isLongest && <RowBadge $color={tokens.accent.teal}>최장 시간</RowBadge>}
                    </IndexCell>
                  </Td>

                  <Td>{formatTime(dive.startTime)}</Td>
                  <Td>{formatDuration(dive.durationSeconds)}</Td>
                  <Td $accent="teal">{formatDuration(dive.bottomTimeSeconds)}</Td>
                  <Td>
                    {(() => {
                      const s = surfaceInterval(dives, dive.index);
                      if (s == null) return <span style={{ color: tokens.text.muted }}>-</span>;
                      const prev = dives[dive.index - 1];
                      const aida = calcAidaInterval(prev.maxDepthM, prev.durationSeconds);
                      const ok   = s >= aida.requiredSec;
                      return (
                        <IntervalCell
                          title={
                            `필요: ${formatDuration(aida.requiredSec)} ` +
                            `(${aida.bindingRule === 'depth' ? '수심 기준' : '시간 기준'})` +
                            (aida.deepException ? ' · 심해 다이브 예외 적용' : '')
                          }
                        >
                          <IntervalTime $ok={ok}>{formatDuration(s)}</IntervalTime>
                          <AidaBadge $ok={ok}>
                            {ok ? '✓ 충분' : `✗ ${formatDuration(aida.requiredSec - s)} 부족`}
                          </AidaBadge>
                          {aida.deepException && (
                            <DeepBadge title="55m 초과 심해 다이브">심해</DeepBadge>
                          )}
                        </IntervalCell>
                      );
                    })()}
                  </Td>
                  <Td $accent="cyan">{dive.maxDepthM.toFixed(1)} m</Td>
                  <Td>{dive.avgDepthM.toFixed(1)} m</Td>
                  <Td $accent="descent">
                    {dive.maxDescentRateMps > 0 ? `${dive.maxDescentRateMps.toFixed(2)} m/s` : '-'}
                  </Td>
                  <Td $accent="ascent">
                    {dive.maxAscentRateMps > 0 ? `${dive.maxAscentRateMps.toFixed(2)} m/s` : '-'}
                  </Td>
                  <Td>{dive.maxHR != null ? `${dive.maxHR} bpm` : '-'}</Td>
                  <Td>{dive.avgTempC != null ? `${dive.avgTempC} °C` : '-'}</Td>
                  <Td $center>
                    {hasMemo && <MemoIcon title={memos[dive.index]}>📝</MemoIcon>}
                  </Td>
                  <Td>
                    <Arrow>›</Arrow>
                  </Td>
                </Tr>
              );
            })}
          </tbody>
        </Table>
      </TableWrapper>
    </Wrapper>
  );
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('ko-KR', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

/* ── Styled components ───────────────────────────────── */

const Wrapper = styled.div`
  background: ${tokens.bg.surface};
  border: 1px solid ${tokens.border.subtle};
  border-radius: ${tokens.radius.lg};
  padding: 24px;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
`;

const Title = styled.h2`
  font-size: 14px;
  font-weight: 600;
  color: ${tokens.text.secondary};
  letter-spacing: 0.06em;
  text-transform: uppercase;
`;

const Badge = styled.span`
  font-size: 11px;
  color: ${tokens.text.muted};
  background: ${tokens.bg.elevated};
  padding: 2px 10px;
  border-radius: 99px;
  border: 1px solid ${tokens.border.subtle};
`;

const Hint = styled.span`
  margin-left: auto;
  font-size: 11px;
  color: ${tokens.text.muted};
  opacity: 0.7;
`;

const TableWrapper = styled.div`
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  white-space: nowrap;
`;

const Th = styled.th`
  text-align: left;
  padding: 10px 12px;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: ${tokens.text.muted};
  border-bottom: 1px solid ${tokens.border.subtle};
`;

type AccentType = 'cyan' | 'teal' | 'descent' | 'ascent' | undefined;

const accentColor = (a: AccentType) => {
  if (a === 'cyan')    return tokens.chart.depth;
  if (a === 'teal')    return tokens.accent.teal;
  if (a === 'descent') return tokens.chart.hr;
  if (a === 'ascent')  return '#10b981';
  return tokens.text.primary;
};

const Tr = styled.tr<{ $highlight?: boolean }>`
  border-bottom: 1px solid ${tokens.border.subtle};
  cursor: pointer;
  transition: background 0.12s;
  ${({ $highlight }) => $highlight && `background: ${tokens.bg.elevated}88;`}
  &:last-child { border-bottom: none; }
  &:hover { background: ${tokens.bg.elevated}; }
`;

const IndexCell = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
`;

const RowBadge = styled.span<{ $color: string }>`
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.04em;
  padding: 2px 6px;
  border-radius: 999px;
  background: ${({ $color }) => $color}1a;
  color: ${({ $color }) => $color};
  border: 1px solid ${({ $color }) => $color}44;
  white-space: nowrap;
`;

const Td = styled.td<{ $muted?: boolean; $accent?: AccentType; $center?: boolean }>`
  padding: 11px 12px;
  color: ${({ $muted, $accent }) =>
    $muted   ? tokens.text.muted
    : $accent ? accentColor($accent)
    : tokens.text.primary};
  font-weight: ${({ $accent }) => $accent ? '600' : '400'};
  text-align: ${({ $center }) => $center ? 'center' : 'left'};
`;

const MemoIcon = styled.span`
  font-size: 13px;
  cursor: default;
`;

const Arrow = styled.span`
  font-size: 16px;
  color: ${tokens.text.muted};
  opacity: 0.5;
  line-height: 1;
`;

const IntervalCell = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: nowrap;
`;

const IntervalTime = styled.span<{ $ok: boolean }>`
  font-weight: 600;
  color: ${({ $ok }) => $ok ? tokens.text.primary : tokens.accent.danger};
  font-variant-numeric: tabular-nums;
`;

const AidaBadge = styled.span<{ $ok: boolean }>`
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.03em;
  padding: 1px 7px;
  border-radius: 99px;
  white-space: nowrap;
  background: ${({ $ok }) => $ok ? tokens.accent.teal + '18' : tokens.accent.danger + '18'};
  color: ${({ $ok }) => $ok ? tokens.accent.teal : tokens.accent.danger};
  border: 1px solid ${({ $ok }) => $ok ? tokens.accent.teal + '44' : tokens.accent.danger + '44'};
`;

const DeepBadge = styled.span`
  font-size: 9px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 99px;
  background: #7c3aed18;
  color: #a78bfa;
  border: 1px solid #7c3aed44;
  white-space: nowrap;
`;
