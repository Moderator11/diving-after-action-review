import styled from 'styled-components';
import { useNavigate, useLocation } from 'react-router-dom';
import { tokens } from '../styles/GlobalStyle';
import { useRequireSession } from '../hooks/useRequireSession';
import { MetricCard } from '../components/MetricCard';
import { DiveProfileChart } from '../components/DiveProfileChart';
import { DiveTable } from '../components/DiveTable';
import { formatDuration, formatDate } from '../utils/parseFit';
import {
  TopBarEl, BackButton, NavSpacer, TabNav, Tab, PageEl,
} from '../components/layout/TopBarPrimitives';

export default function SessionPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const session  = useRequireSession();

  if (!session) return null;

  const { stats, records, dives, filename } = session;

  return (
    <PageEl>
      {/* ── Top bar ── */}
      <TopBarEl>
        <BackButton onClick={() => navigate('/')}>
          ← 새 파일 열기
        </BackButton>
        <FileInfo>
          <FileName>{filename}</FileName>
          <FileDate>{formatDate(stats.sessionDate)}</FileDate>
        </FileInfo>
        <NavSpacer />
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
        </TabNav>
      </TopBarEl>

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
        <DiveProfileChart records={records} dives={dives} />

        {/* ── Dive Table ── */}
        <DiveTable dives={dives} />
      </Content>
    </PageEl>
  );
}

/* ── Styled Components ───────────────────────────────── */

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