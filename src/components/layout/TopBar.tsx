import { useNavigate, useLocation } from 'react-router-dom';
import styled from 'styled-components';
import { tokens } from '../../styles/GlobalStyle';
import { formatDate } from '../../utils/parseFit';
import { BackButton, NavSpacer, TabNav, Tab, TopBarEl } from './TopBarPrimitives';

interface TopBarProps {
  filename?: string;
  sessionDate?: Date;
  diveIdx?: number;
  diveStartTime?: Date;
  onExportCSV?: () => void;
  canExport?: boolean;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('ko-KR', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

export function TopBar({
  filename,
  sessionDate,
  diveIdx,
  diveStartTime,
  onExportCSV,
  canExport,
}: TopBarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const path     = location.pathname;

  const isDive    = path.startsWith('/dive/');
  const isSession = path === '/session';
  const isCompare = path === '/compare';
  const isRaw     = path === '/raw';

  const backLabel  = isSession ? '← 새 파일 열기' : '← 세션으로';
  const backTarget = isSession ? '/' : '/session';

  const diveTarget = isDive ? path : '/dive/0';

  return (
    <TopBarEl>
      <BackButton onClick={() => navigate(backTarget)}>{backLabel}</BackButton>

      {isSession && filename && (
        <FileInfo>
          <FileName>{filename}</FileName>
          {sessionDate && <FileDate>{formatDate(sessionDate)}</FileDate>}
        </FileInfo>
      )}

      {isDive && diveIdx !== undefined && (
        <DiveTitle>
          🤿 다이브 #{diveIdx + 1}
          {diveStartTime && (
            <DiveSub>{formatDate(diveStartTime)} · {formatTime(diveStartTime)}</DiveSub>
          )}
        </DiveTitle>
      )}

      {isCompare && <PageTitle>⚖️ 다이브 비교</PageTitle>}

      {isRaw && (
        <>
          <PageTitle>Raw Data Explorer</PageTitle>
          {filename && <FilePill>{filename}</FilePill>}
        </>
      )}

      <NavSpacer />

      {isRaw && canExport && onExportCSV && (
        <ExportBtn onClick={onExportCSV}>↓ CSV</ExportBtn>
      )}

      <TabNav>
        <Tab $active={isSession} onClick={() => navigate('/session')}>
          📊 세션 요약
        </Tab>
        <Tab $active={isDive} onClick={() => navigate(diveTarget)}>
          🤿 다이브 상세
        </Tab>
        <Tab $active={isCompare} onClick={() => navigate('/compare')}>
          ⚖️ 비교
        </Tab>
        <Tab $active={isRaw} onClick={() => navigate('/raw')}>
          🗃 Raw Data
        </Tab>
      </TabNav>
    </TopBarEl>
  );
}

/* ── Styled components ─────────────────────────────────── */

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

const DiveTitle = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 15px;
  font-weight: 700;
  color: ${tokens.text.primary};
`;

const DiveSub = styled.span`
  font-size: 11px;
  font-weight: 400;
  color: ${tokens.text.muted};
`;

const PageTitle = styled.span`
  font-size: 14px;
  font-weight: 700;
  color: ${tokens.text.primary};
  letter-spacing: 0.02em;
  white-space: nowrap;
`;

const FilePill = styled.span`
  font-size: 11px;
  color: ${tokens.text.muted};
  background: ${tokens.bg.elevated};
  border: 1px solid ${tokens.border.subtle};
  padding: 3px 10px;
  border-radius: 99px;
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const ExportBtn = styled.button`
  font-size: 12px;
  font-weight: 600;
  color: ${tokens.accent.cyan};
  background: ${tokens.accent.cyan}18;
  border: 1px solid ${tokens.accent.cyan}44;
  border-radius: ${tokens.radius.md};
  padding: 5px 14px;
  white-space: nowrap;
  transition: all 0.2s;
  &:hover { background: ${tokens.accent.cyan}28; }
`;
