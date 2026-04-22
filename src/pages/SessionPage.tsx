import { useEffect } from 'react';
import styled from 'styled-components';
import { useNavigate, useLocation } from 'react-router-dom';
import { tokens } from '../styles/GlobalStyle';
import { useDiveSession } from '../store/DiveContext';
import { MetricCard } from '../components/MetricCard';
import { DiveProfileChart } from '../components/DiveProfileChart';
import { DiveTable } from '../components/DiveTable';
import { formatDuration, formatDate } from '../utils/parseFit';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export default function SessionPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { session } = useDiveSession();

  // Redirect if no data loaded
  useEffect(() => {
    if (!session) navigate('/');
  }, [session, navigate]);

  if (!session) return null;

  const { stats, records, laps: _laps, dives, filename } = session;

  // ── CSV 내보내기 ──
  const handleCsvDownload = () => {
    const rows = [
      ['다이브#','시작시각','총시간(s)','잠수시간(s)','최대수심(m)','평균수심(m)','최대하강(m/s)','최대상승(m/s)','최고HR','평균HR','평균수온(C)'],
      ...session.dives.map((d, i) => [
        i + 1,
        d.startTime.toISOString(),
        d.durationSeconds,
        d.bottomTimeSeconds,
        d.maxDepthM.toFixed(2),
        d.avgDepthM.toFixed(2),
        d.maxDescentRateMps.toFixed(2),
        d.maxAscentRateMps.toFixed(2),
        d.maxHR ?? '',
        d.avgHR ?? '',
        d.avgTempC ?? '',
      ]),
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${session.filename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── 세션 피로도 트렌드 데이터 ──
  const trendData = dives.map((d, i) => ({
    n: i + 1,
    maxDepth: d.maxDepthM,
    avgDepth: d.avgDepthM,
    bottomTime: d.bottomTimeSeconds,
    avgHR: d.avgHR,
  }));

  const hasHR = dives.some(d => d.avgHR != null);

  return (
    <Page>
      {/* ── Top bar ── */}
      <TopBar>
        <BackButton onClick={() => navigate('/')}>
          ← 새 파일 열기
        </BackButton>
        <CsvButton onClick={handleCsvDownload}>
          📥 CSV 다운로드
        </CsvButton>
        <FileInfo>
          <FileName>{filename}</FileName>
          <FileDate>{formatDate(stats.sessionDate)}</FileDate>
        </FileInfo>
        <Spacer />
        <TabNav>
          <Tab $active={location.pathname === '/session'} onClick={() => navigate('/session')}>
            📊 세션 요약
          </Tab>
          <Tab $active={location.pathname === '/compare'} onClick={() => navigate('/compare')}>
            ⚖️ 비교
          </Tab>
          <Tab $active={location.pathname === '/raw'} onClick={() => navigate('/raw')}>
            🗃 Raw Data
          </Tab>
          <Tab $active={location.pathname === '/trends'} onClick={() => navigate('/trends')}>
            📈 트렌드
          </Tab>
        </TabNav>
      </TopBar>

      <Content>
        {/* ── Session header ── */}
        <SectionHeader>
          <SectionIcon>🌊</SectionIcon>
          <div>
            <SectionTitle>세션 요약</SectionTitle>
            <SectionSub>총 {formatDuration(stats.totalDurationSeconds)} · {stats.totalDives}회 다이브</SectionSub>
          </div>
        </SectionHeader>

        {/* ── Metric cards ── */}
        <MetricGrid>
          <MetricCard
            label="최대 수심"
            value={stats.maxDepthM.toFixed(1)}
            unit="m"
            icon="🎯"
            accent="cyan"
          />
          <MetricCard
            label="총 다이브"
            value={stats.totalDives}
            unit="회"
            icon="🤿"
            accent="blue"
          />
          <MetricCard
            label="가장 긴 다이브"
            value={formatDuration(stats.longestDiveSeconds)}
            icon="⏱️"
            accent="teal"
          />
          <MetricCard
            label="최고 심박수"
            value={stats.maxHR ?? '-'}
            unit={stats.maxHR ? 'bpm' : ''}
            icon="❤️"
            accent="danger"
          />
          <MetricCard
            label="소모 칼로리"
            value={stats.totalCalories}
            unit="kcal"
            icon="🔥"
            accent="indigo"
          />
          <MetricCard
            label="수온"
            value={stats.avgWaterTempC ?? '-'}
            unit={stats.avgWaterTempC ? '°C' : ''}
            icon="🌡️"
            accent="teal"
            sub="세션 평균"
          />
        </MetricGrid>

        {/* ── Dive Profile Chart ── */}
        <DiveProfileChart records={records} />

        {/* ── 세션 피로도 트렌드 ── */}
        <Card>
          <CardTitle>📉 세션 피로도 트렌드</CardTitle>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={trendData} margin={{ top: 8, right: 40, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={tokens.chart.grid} />
              <XAxis
                dataKey="n"
                tick={{ fill: tokens.text.muted, fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: tokens.border.subtle }}
              />
              {/* 왼쪽 y축: 수심(m) */}
              <YAxis
                yAxisId="depth"
                orientation="left"
                tick={{ fill: tokens.text.muted, fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                unit="m"
              />
              {/* 오른쪽 y축: 시간(s) */}
              <YAxis
                yAxisId="time"
                orientation="right"
                tick={{ fill: tokens.text.muted, fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                unit="s"
              />
              <Tooltip
                contentStyle={{
                  background: tokens.bg.elevated,
                  border: `1px solid ${tokens.border.default}`,
                  borderRadius: tokens.radius.md,
                  fontSize: 12,
                }}
                labelFormatter={(v) => `다이브 #${v}`}
              />
              {/* 최대 수심 — 점선 */}
              <Line
                yAxisId="depth"
                type="monotone"
                dataKey="maxDepth"
                stroke="#06b6d4"
                strokeWidth={2}
                strokeDasharray="5 3"
                dot={{ fill: '#06b6d4', r: 3 }}
                name="최대수심(m)"
              />
              {/* 평균 수심 — 실선 얇게 */}
              <Line
                yAxisId="depth"
                type="monotone"
                dataKey="avgDepth"
                stroke="#06b6d480"
                strokeWidth={1.5}
                dot={false}
                name="평균수심(m)"
              />
              {/* 잠수 시간 */}
              <Line
                yAxisId="time"
                type="monotone"
                dataKey="bottomTime"
                stroke="#14b8a6"
                strokeWidth={2}
                dot={{ fill: '#14b8a6', r: 3 }}
                name="잠수시간(s)"
              />
              {/* 평균 심박 (있을 때만) */}
              {hasHR && (
                <Line
                  yAxisId="time"
                  type="monotone"
                  dataKey="avgHR"
                  stroke="#f97316"
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  dot={false}
                  name="평균HR(bpm)"
                />
              )}
            </LineChart>
          </ResponsiveContainer>
          {/* 범례 */}
          <TrendLegend>
            <LegendItem>
              <LegendDot style={{ background: '#06b6d4' }} />
              <LegendLabel>최대수심(m)</LegendLabel>
            </LegendItem>
            <LegendItem>
              <LegendDot style={{ background: '#06b6d480' }} />
              <LegendLabel>평균수심(m)</LegendLabel>
            </LegendItem>
            <LegendItem>
              <LegendDot style={{ background: '#14b8a6' }} />
              <LegendLabel>잠수시간(s)</LegendLabel>
            </LegendItem>
            {hasHR && (
              <LegendItem>
                <LegendDot style={{ background: '#f97316' }} />
                <LegendLabel>평균HR(bpm)</LegendLabel>
              </LegendItem>
            )}
          </TrendLegend>
        </Card>

        {/* ── Dive Table ── */}
        <DiveTable dives={dives} />
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

const CsvButton = styled.button`
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

const FileInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  overflow: hidden;
`;

const FileName = styled.span`
  font-size: 13px;
  font-weight: 600;
  color: ${tokens.text.primary};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const FileDate = styled.span`
  font-size: 11px;
  color: ${tokens.text.muted};
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
  gap: 28px;
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

const MetricGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 14px;
`;

const Card = styled.div`
  background: ${tokens.bg.surface};
  border: 1px solid ${tokens.border.subtle};
  border-radius: ${tokens.radius.lg};
  padding: 20px 24px 16px;
`;

const CardTitle = styled.h2`
  font-size: 13px;
  font-weight: 600;
  color: ${tokens.text.secondary};
  letter-spacing: 0.04em;
  margin-bottom: 14px;
`;

const TrendLegend = styled.div`
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
