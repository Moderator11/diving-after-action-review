import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { tokens } from '../styles/GlobalStyle';
import type { DetectedDive } from '../types/dive';
import { formatDuration } from '../utils/parseFit';

interface Props {
  dives: DetectedDive[];
}

export function DiveTable({ dives }: Props) {
  const navigate = useNavigate();

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
              <Th>#</Th>
              <Th>시작 시각</Th>
              <Th>총 시간</Th>
              <Th>잠수 시간</Th>
              <Th>최대 수심</Th>
              <Th>평균 수심</Th>
              <Th>최대 하강</Th>
              <Th>최대 상승</Th>
              <Th>최고 HR</Th>
              <Th>수온</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {dives.map((dive) => (
              <Tr key={dive.index} onClick={() => navigate(`/dive/${dive.index}`)}>
                <Td $muted>{dive.index + 1}</Td>
                <Td>{formatTime(dive.startTime)}</Td>
                <Td>{formatDuration(dive.durationSeconds)}</Td>
                <Td $accent="teal">{formatDuration(dive.bottomTimeSeconds)}</Td>
                <Td $accent="cyan">{dive.maxDepthM.toFixed(1)} m</Td>
                <Td>{dive.avgDepthM.toFixed(1)} m</Td>
                <Td $accent="descent">
                  {dive.maxDescentRateMps > 0
                    ? `${dive.maxDescentRateMps.toFixed(2)} m/s`
                    : '-'}
                </Td>
                <Td $accent="ascent">
                  {dive.maxAscentRateMps > 0
                    ? `${dive.maxAscentRateMps.toFixed(2)} m/s`
                    : '-'}
                </Td>
                <Td>{dive.maxHR != null ? `${dive.maxHR} bpm` : '-'}</Td>
                <Td>{dive.avgTempC != null ? `${dive.avgTempC} °C` : '-'}</Td>
                <Td>
                  <Arrow>›</Arrow>
                </Td>
              </Tr>
            ))}
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
  if (a === 'cyan')    return tokens.chart.depth;       // #06b6d4
  if (a === 'teal')    return tokens.accent.teal;       // #14b8a6
  if (a === 'descent') return tokens.chart.hr;          // #f97316
  if (a === 'ascent')  return '#10b981';                // emerald
  return tokens.text.primary;
};

const Tr = styled.tr`
  border-bottom: 1px solid ${tokens.border.subtle};
  cursor: pointer;
  transition: background 0.12s;

  &:last-child { border-bottom: none; }
  &:hover { background: ${tokens.bg.elevated}; }
`;

const Td = styled.td<{ $muted?: boolean; $accent?: AccentType }>`
  padding: 11px 12px;
  color: ${({ $muted, $accent }) =>
    $muted   ? tokens.text.muted
    : $accent ? accentColor($accent)
    : tokens.text.primary};
  font-weight: ${({ $accent }) => $accent ? '600' : '400'};
`;

const Arrow = styled.span`
  font-size: 16px;
  color: ${tokens.text.muted};
  opacity: 0.5;
  line-height: 1;
`;
