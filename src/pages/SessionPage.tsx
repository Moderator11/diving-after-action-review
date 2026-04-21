import { useEffect } from 'react';
import styled from 'styled-components';
import { useNavigate, useLocation } from 'react-router-dom';
import { tokens } from '../styles/GlobalStyle';
import { useDiveSession } from '../store/DiveContext';
import { MetricCard } from '../components/MetricCard';
import { DiveProfileChart } from '../components/DiveProfileChart';
import { DiveTable } from '../components/DiveTable';
import { formatDuration, formatDate } from '../utils/parseFit';

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

  return (
    <Page>
      {/* ── Top bar ── */}
      <TopBar>
        <BackButton onClick={() => navigate('/')}>
          ← 새 파일 열기
        </BackButton>
        <FileInfo>
          <FileName>{filename}</FileName>
          <FileDate>{formatDate(stats.sessionDate)}</FileDate>
        </FileInfo>
        <Spacer />
        <TabNav>
          <Tab $active={location.pathname === '/session'} onClick={() => navigate('/session')}>
            📊 세션 요약
          </Tab>
          <Tab $active={location.pathname === '/raw'} onClick={() => navigate('/raw')}>
            🗃 Raw Data
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
