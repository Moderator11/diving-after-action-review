import { useNavigate, useLocation } from 'react-router-dom';
import styled from 'styled-components';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  Bar,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { tokens } from '../styles/GlobalStyle';
import { useDiveSession } from '../store/DiveContext';
import { formatDate, formatDuration } from '../utils/parseFit';

export default function TrendsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { sessions } = useDiveSession();

  // 날짜 기준 정렬
  const sorted = [...sessions].sort(
    (a, b) => a.stats.sessionDate.getTime() - b.stats.sessionDate.getTime()
  );

  // 차트용 데이터
  const chartData = sorted.map((s, i) => ({
    label: formatDate(s.stats.sessionDate),
    idx: i + 1,
    maxDepth: parseFloat(s.stats.maxDepthM.toFixed(1)),
    diveCount: s.stats.totalDives,
    totalMinutes: parseFloat((s.stats.totalDurationSeconds / 60).toFixed(1)),
    maxHR: s.stats.maxHR ?? null,
  }));

  return (
    <Page>
      {/* ── Top bar ── */}
      <TopBar>
        <BackButton onClick={() => navigate('/')}>← 홈</BackButton>
        <PageTitle>📈 장기 트렌드</PageTitle>
        <Spacer />
        <TabNav>
          <Tab $active={false} onClick={() => navigate('/session')}>📊 세션 요약</Tab>
          <Tab $active={false} onClick={() => navigate('/compare')}>⚖️ 비교</Tab>
          <Tab $active={false} onClick={() => navigate('/raw')}>🗃 Raw Data</Tab>
          <Tab $active={location.pathname === '/trends'} onClick={() => navigate('/trends')}>📈 트렌드</Tab>
        </TabNav>
      </TopBar>

      <Content>
        {sessions.length < 2 ? (
          <EmptyState>
            <EmptyIcon>📂</EmptyIcon>
            <EmptyTitle>세션이 부족합니다</EmptyTitle>
            <EmptyDesc>
              트렌드를 보려면 .fit 파일을 2개 이상 업로드하세요.
              <br />현재 {sessions.length}개 업로드됨
            </EmptyDesc>
            <GoHomeButton onClick={() => navigate('/')}>홈으로 이동</GoHomeButton>
          </EmptyState>
        ) : (
          <>
            <SectionHeader>
              <SectionIcon>📈</SectionIcon>
              <div>
                <SectionTitle>세션 간 장기 트렌드</SectionTitle>
                <SectionSub>총 {sessions.length}개 세션 분석</SectionSub>
              </div>
            </SectionHeader>

            {/* ── Chart 1: 세션별 최대 수심 추이 ── */}
            <ChartCard>
              <ChartCardHeader>
                <ChartCardIcon>🎯</ChartCardIcon>
                <ChartCardTitle>세션별 최대 수심 추이</ChartCardTitle>
              </ChartCardHeader>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData} margin={{ top: 8, right: 24, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={tokens.chart.grid} vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: tokens.text.muted, fontSize: 10 }}
                    tickLine={false}
                    axisLine={{ stroke: tokens.border.subtle }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fill: tokens.text.muted, fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    unit="m"
                    width={40}
                  />
                  <Tooltip
                    contentStyle={{
                      background: tokens.bg.elevated,
                      border: `1px solid ${tokens.border.default}`,
                      borderRadius: tokens.radius.md,
                      fontSize: 12,
                    }}
                    labelFormatter={(v) => String(v)}
                    formatter={(value) => [`${value} m`, '최대 수심']}
                  />
                  <Line
                    type="monotone"
                    dataKey="maxDepth"
                    stroke={tokens.accent.cyan}
                    strokeWidth={2}
                    dot={{ fill: tokens.accent.cyan, r: 4, strokeWidth: 0 }}
                    activeDot={{ r: 6 }}
                    name="최대 수심(m)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            {/* ── Chart 2: 세션별 다이브 수 / 총 잠수 시간 ── */}
            <ChartCard>
              <ChartCardHeader>
                <ChartCardIcon>🤿</ChartCardIcon>
                <ChartCardTitle>세션별 다이브 수 / 총 잠수 시간</ChartCardTitle>
              </ChartCardHeader>
              <ResponsiveContainer width="100%" height={200}>
                <ComposedChart data={chartData} margin={{ top: 8, right: 24, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={tokens.chart.grid} vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: tokens.text.muted, fontSize: 10 }}
                    tickLine={false}
                    axisLine={{ stroke: tokens.border.subtle }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    yAxisId="count"
                    orientation="left"
                    tick={{ fill: tokens.text.muted, fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    unit="회"
                    width={40}
                  />
                  <YAxis
                    yAxisId="time"
                    orientation="right"
                    tick={{ fill: tokens.text.muted, fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    unit="분"
                    width={44}
                  />
                  <Tooltip
                    contentStyle={{
                      background: tokens.bg.elevated,
                      border: `1px solid ${tokens.border.default}`,
                      borderRadius: tokens.radius.md,
                      fontSize: 12,
                    }}
                    labelFormatter={(v) => String(v)}
                  />
                  <Bar
                    yAxisId="count"
                    dataKey="diveCount"
                    fill={tokens.accent.indigo}
                    opacity={0.8}
                    radius={[4, 4, 0, 0]}
                    name="다이브 수(회)"
                  />
                  <Line
                    yAxisId="time"
                    type="monotone"
                    dataKey="totalMinutes"
                    stroke={tokens.accent.teal}
                    strokeWidth={2}
                    dot={{ fill: tokens.accent.teal, r: 4, strokeWidth: 0 }}
                    activeDot={{ r: 6 }}
                    name="총 잠수 시간(분)"
                  />
                </ComposedChart>
              </ResponsiveContainer>
              <ChartLegend>
                <LegendItem>
                  <LegendDot style={{ background: tokens.accent.indigo }} />
                  <LegendLabel>다이브 수(회)</LegendLabel>
                </LegendItem>
                <LegendItem>
                  <LegendDot style={{ background: tokens.accent.teal }} />
                  <LegendLabel>총 잠수 시간(분)</LegendLabel>
                </LegendItem>
              </ChartLegend>
            </ChartCard>

            {/* ── Chart 3: 세션별 최고 심박 추이 ── */}
            <ChartCard>
              <ChartCardHeader>
                <ChartCardIcon>❤️</ChartCardIcon>
                <ChartCardTitle>세션별 최고 심박 추이</ChartCardTitle>
                {chartData.every((d) => d.maxHR === null) && (
                  <ChartCardNote>HR 데이터 없음</ChartCardNote>
                )}
              </ChartCardHeader>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData} margin={{ top: 8, right: 24, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={tokens.chart.grid} vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: tokens.text.muted, fontSize: 10 }}
                    tickLine={false}
                    axisLine={{ stroke: tokens.border.subtle }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fill: tokens.text.muted, fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    unit="bpm"
                    width={50}
                    domain={['auto', 'auto']}
                  />
                  <Tooltip
                    contentStyle={{
                      background: tokens.bg.elevated,
                      border: `1px solid ${tokens.border.default}`,
                      borderRadius: tokens.radius.md,
                      fontSize: 12,
                    }}
                    labelFormatter={(v) => String(v)}
                    formatter={(value) =>
                      value != null ? [`${value} bpm`, '최고 심박'] : ['-', '최고 심박']
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="maxHR"
                    stroke={tokens.chart.hr}
                    strokeWidth={2}
                    dot={{ fill: tokens.chart.hr, r: 4, strokeWidth: 0 }}
                    activeDot={{ r: 6 }}
                    name="최고 심박(bpm)"
                    connectNulls={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            {/* ── 세션 목록 테이블 ── */}
            <ChartCard>
              <ChartCardHeader>
                <ChartCardIcon>📋</ChartCardIcon>
                <ChartCardTitle>세션 목록</ChartCardTitle>
              </ChartCardHeader>
              <TableWrapper>
                <Table>
                  <thead>
                    <tr>
                      <Th>#</Th>
                      <Th>파일명</Th>
                      <Th>날짜</Th>
                      <Th>다이브 수</Th>
                      <Th>최대 수심</Th>
                      <Th>총 시간</Th>
                      <Th>최고 HR</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((s, i) => (
                      <tr key={s.filename}>
                        <Td style={{ color: tokens.text.muted }}>{i + 1}</Td>
                        <Td style={{ color: tokens.text.primary, fontWeight: 500 }}>{s.filename}</Td>
                        <Td>{formatDate(s.stats.sessionDate)}</Td>
                        <Td>{s.stats.totalDives}회</Td>
                        <Td>{s.stats.maxDepthM.toFixed(1)}m</Td>
                        <Td>{formatDuration(s.stats.totalDurationSeconds)}</Td>
                        <Td>{s.stats.maxHR != null ? `${s.stats.maxHR} bpm` : '-'}</Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </TableWrapper>
            </ChartCard>
          </>
        )}
      </Content>
    </Page>
  );
}

/* ── Styled Components ───────────────────────────────── */
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
  transition: all 0.2s;
  white-space: nowrap;

  &:hover {
    border-color: ${tokens.accent.cyan};
    color: ${tokens.accent.cyan};
  }
`;

const PageTitle = styled.h1`
  font-size: 15px;
  font-weight: 700;
  color: ${tokens.text.primary};
`;

const Spacer = styled.div`
  flex: 1;
`;

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
  max-width: 1200px;
  width: 100%;
  margin: 0 auto;
  padding: 32px 24px 60px;
  display: flex;
  flex-direction: column;
  gap: 24px;
`;

const SectionHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 14px;
`;

const SectionIcon = styled.span`
  font-size: 28px;
  line-height: 1;
`;

const SectionTitle = styled.h1`
  font-size: 20px;
  font-weight: 700;
  color: ${tokens.text.primary};
  letter-spacing: -0.01em;
`;

const SectionSub = styled.p`
  font-size: 13px;
  color: ${tokens.text.secondary};
  margin-top: 2px;
`;

const ChartCard = styled.div`
  background: ${tokens.bg.surface};
  border: 1px solid ${tokens.border.subtle};
  border-radius: ${tokens.radius.lg};
  padding: 20px 24px 16px;
`;

const ChartCardHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
`;

const ChartCardIcon = styled.span`
  font-size: 16px;
  line-height: 1;
`;

const ChartCardTitle = styled.h2`
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: ${tokens.text.secondary};
`;

const ChartCardNote = styled.span`
  font-size: 11px;
  color: ${tokens.text.muted};
  margin-left: 8px;
`;

const ChartLegend = styled.div`
  display: flex;
  align-items: center;
  gap: 20px;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid ${tokens.border.subtle};
  flex-wrap: wrap;
`;

const LegendItem = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`;

const LegendDot = styled.span`
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
`;

const LegendLabel = styled.span`
  font-size: 11px;
  color: ${tokens.text.muted};
`;

const TableWrapper = styled.div`
  overflow-x: auto;
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
`;

const Th = styled.th`
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: ${tokens.text.muted};
  text-align: left;
  padding: 8px 12px;
  border-bottom: 1px solid ${tokens.border.subtle};
`;

const Td = styled.td`
  font-size: 12px;
  color: ${tokens.text.secondary};
  padding: 10px 12px;
  border-bottom: 1px solid ${tokens.border.subtle};
`;

const EmptyState = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 80px 0;
  text-align: center;
`;

const EmptyIcon = styled.div`
  font-size: 48px;
`;

const EmptyTitle = styled.h2`
  font-size: 20px;
  font-weight: 700;
  color: ${tokens.text.primary};
`;

const EmptyDesc = styled.p`
  font-size: 14px;
  color: ${tokens.text.muted};
  line-height: 1.7;
`;

const GoHomeButton = styled.button`
  margin-top: 8px;
  padding: 10px 24px;
  border-radius: ${tokens.radius.md};
  background: rgba(6,182,212,0.1);
  border: 1px solid rgba(6,182,212,0.3);
  color: ${tokens.accent.cyan};
  font-size: 14px;
  transition: all 0.2s;

  &:hover {
    background: rgba(6,182,212,0.18);
    border-color: ${tokens.accent.cyan};
  }
`;
