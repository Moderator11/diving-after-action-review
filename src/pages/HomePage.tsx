import { useCallback, useState, useRef, useEffect } from 'react';
import styled, { keyframes, css } from 'styled-components';
import { useNavigate } from 'react-router-dom';
import { tokens } from '../styles/GlobalStyle';
import { parseFitFile } from '../utils/parseFit';
import {
  saveSession, getAllSessions, getMetadata, deleteSession,
  exportAllData, importAllData, type StoredSession,
} from '../utils/db';
import { useDiveSession } from '../store/DiveContext';
import favicon from '/favicon.svg';

type DropState = 'idle' | 'hover' | 'loading' | 'error';

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href    = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export default function HomePage() {
  const navigate           = useNavigate();
  const { loadSession }    = useDiveSession();
  const [dropState,  setDropState]  = useState<DropState>('idle');
  const [errorMsg,   setErrorMsg]   = useState('');
  const [progress,   setProgress]   = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Session library ──────────────────────────────────────
  const [storedSessions, setStoredSessions] = useState<StoredSession[]>([]);
  const [exporting,  setExporting]  = useState(false);
  const [importing,  setImporting]  = useState(false);
  const [importMsg,  setImportMsg]  = useState('');
  const importInputRef = useRef<HTMLInputElement>(null);

  const refreshSessions = useCallback(async () => {
    try {
      const list = await getAllSessions();
      setStoredSessions(list);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { refreshSessions(); }, [refreshSessions]);

  // ── Load from stored session ─────────────────────────────
  const loadStoredSession = useCallback(async (stored: StoredSession) => {
    setDropState('loading');
    setProgress('파싱 중…');
    try {
      const [session, meta] = await Promise.all([
        parseFitFile(stored.buffer, stored.filename),
        getMetadata(stored.id!),
      ]);
      loadSession(session, stored.id!, meta);
      navigate('/session');
    } catch (err) {
      console.error(err);
      setDropState('error');
      setErrorMsg('세션을 불러올 수 없습니다.');
    }
  }, [loadSession, navigate]);

  // ── Load new .fit file ───────────────────────────────────
  const processFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.fit')) {
      setDropState('error');
      setErrorMsg('.fit 파일만 지원됩니다.');
      return;
    }
    setDropState('loading');
    setProgress('파일 읽는 중…');
    try {
      const buffer  = await file.arrayBuffer();
      setProgress('데이터 파싱 중…');
      const session = await parseFitFile(buffer, file.name);
      const id      = await saveSession({
        filename:  file.name,
        savedAt:   Date.now(),
        diveCount: session.dives.length,
        buffer,
      });
      loadSession(session, id, { sessionId: id, memos: {}, favorites: [] });
      navigate('/session');
    } catch (err) {
      console.error(err);
      setDropState('error');
      setErrorMsg(err instanceof Error ? err.message : '파싱 중 오류가 발생했습니다.');
    }
  }, [navigate, loadSession]);

  // ── Delete stored session ────────────────────────────────
  const handleDelete = useCallback(async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (!confirm('이 세션을 삭제하시겠습니까?')) return;
    try {
      await deleteSession(id);
      setStoredSessions((prev) => prev.filter((s) => s.id !== id));
    } catch { /* ignore */ }
  }, []);

  // ── Download .fit from DB ────────────────────────────────
  const handleDownloadFit = useCallback((e: React.MouseEvent, s: StoredSession) => {
    e.stopPropagation();
    downloadBlob(new Blob([s.buffer]), s.filename);
  }, []);

  // ── Export all data ──────────────────────────────────────
  const handleExportAll = useCallback(async () => {
    setExporting(true);
    try {
      const json = await exportAllData();
      downloadBlob(new Blob([json], { type: 'application/json' }), `daar_export_${Date.now()}.json`);
    } catch { /* ignore */ } finally {
      setExporting(false);
    }
  }, []);

  // ── Import all data ───────────────────────────────────────
  const handleImportFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';                     // allow re-selecting same file
    setImporting(true);
    setImportMsg('');
    try {
      const text  = await file.text();
      const count = await importAllData(text);
      setImportMsg(`✓ ${count}개 세션을 가져왔습니다.`);
      await refreshSessions();
    } catch (err) {
      setImportMsg(`⚠️ ${err instanceof Error ? err.message : '가져오기 실패'}`);
    } finally {
      setImporting(false);
      setTimeout(() => setImportMsg(''), 4000);
    }
  }, [refreshSessions]);

  const onDrop      = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDropState('idle');
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }, [processFile]);
  const onDragOver  = (e: React.DragEvent) => { e.preventDefault(); setDropState('hover'); };
  const onDragLeave = () => setDropState('idle');
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };
  const retry = () => {
    setDropState('idle'); setErrorMsg('');
    if (inputRef.current) inputRef.current.value = '';
  };

  // ── Logo expand animation ────────────────────────────────
  const [logoExpanded, setLogoExpanded] = useState(false);
  const isHovering    = useRef(false);
  const collapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const INTERVAL_MS = 3000;
    const HOLD_MS     = 3000;
    let timer: ReturnType<typeof setTimeout>;
    const loop = () => {
      if (isHovering.current) return;
      setLogoExpanded(true);
      timer = setTimeout(() => {
        if (!isHovering.current) {
          setLogoExpanded(false);
          timer = setTimeout(loop, INTERVAL_MS);
        }
      }, HOLD_MS);
    };
    timer = setTimeout(loop, INTERVAL_MS);
    return () => clearTimeout(timer);
  }, []);

  const handleLogoEnter = () => {
    isHovering.current = true;
    if (collapseTimer.current) clearTimeout(collapseTimer.current);
    setLogoExpanded(true);
  };
  const handleLogoLeave = () => {
    isHovering.current = false;
    setLogoExpanded(false);
  };

  const LOGO_PARTS = [
    { init: 'D', rest: 'iving\u00A0' },
    { init: 'A', rest: 'fter\u00A0'  },
    { init: 'A', rest: 'ction\u00A0' },
    { init: 'R', rest: 'eview'       },
  ] as const;

  return (
    <Page>
      <Background />
      <Container>
        {/* ── Logo ── */}
        <Logo>
          <LogoImageWrap>
            <LogoImg src={favicon} alt="DAAR 로고" />
            <LogoImgShadow />
          </LogoImageWrap>
          <LogoContainer onMouseEnter={handleLogoEnter} onMouseLeave={handleLogoLeave}>
            <TitleText>
              {LOGO_PARTS.map(({ init, rest }, i) => (
                <LogoWord key={i}>
                  <LogoInit $expanded={logoExpanded}>{init}</LogoInit>
                  {rest && (
                    <LogoSuffix
                      $expanded={logoExpanded}
                      style={{ transitionDelay: logoExpanded ? `${i * 38}ms` : '0ms' }}
                    >
                      {rest}
                    </LogoSuffix>
                  )}
                </LogoWord>
              ))}
            </TitleText>
          </LogoContainer>
          <LogoSub>After Dive debriefing tool</LogoSub>
        </Logo>

        {/* ── Drop zone ── */}
        <DropArea>
          <DropZone
            $state={dropState}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onClick={() => dropState === 'idle' && inputRef.current?.click()}
          >
            <input ref={inputRef} type="file" accept=".fit"
              style={{ display: 'none' }} onChange={onFileChange} />

            {dropState === 'loading' && (
              <StateContent>
                <Spinner />
                <StateTitle>분석 중</StateTitle>
                <StateDesc>{progress}</StateDesc>
              </StateContent>
            )}
            {dropState === 'error' && (
              <StateContent>
                <StateIcon>⚠️</StateIcon>
                <StateTitle>오류 발생</StateTitle>
                <StateDesc>{errorMsg}</StateDesc>
                <RetryButton onClick={(e) => { e.stopPropagation(); retry(); }}>
                  다시 시도
                </RetryButton>
              </StateContent>
            )}
            {(dropState === 'idle' || dropState === 'hover') && (
              <StateContent>
                <DropIcon $hover={dropState === 'hover'}>📂</DropIcon>
                <StateTitle>
                  {dropState === 'hover' ? '놓으세요!' : '.fit 파일을 드롭하세요'}
                </StateTitle>
                <StateDesc>Garmin · Suunto · Mares 등 다이빙 컴퓨터 .fit 파일 지원</StateDesc>
                <BrowseHint>또는 클릭하여 파일 선택</BrowseHint>
              </StateContent>
            )}
          </DropZone>
        </DropArea>

        {/* ── Stored sessions ── */}
        <SessionSection>
          <SessionHeader>
            <SessionTitle>저장된 세션</SessionTitle>
            <SessionCount>{storedSessions.length}개</SessionCount>
            <HeaderActions>
              {importMsg && <ImportMsg $ok={importMsg.startsWith('✓')}>{importMsg}</ImportMsg>}
              <input
                ref={importInputRef} type="file" accept=".json"
                style={{ display: 'none' }} onChange={handleImportFile}
              />
              <ImportAllBtn
                onClick={() => importInputRef.current?.click()}
                disabled={importing}
              >
                {importing ? '가져오는 중…' : '📥 전체 가져오기'}
              </ImportAllBtn>
              {storedSessions.length > 0 && (
                <ExportAllBtn onClick={handleExportAll} disabled={exporting}>
                  {exporting ? '내보내는 중…' : '📤 전체 내보내기'}
                </ExportAllBtn>
              )}
            </HeaderActions>
          </SessionHeader>

          {storedSessions.length === 0 ? (
            <EmptyLibrary>
              <EmptyIcon>🤿</EmptyIcon>
              <EmptyText>저장된 세션이 없습니다.<br />위에서 .fit 파일을 불러오세요.</EmptyText>
            </EmptyLibrary>
          ) : (
            <SessionList>
              {storedSessions.map((s) => (
                <SessionRow key={s.id} onClick={() => loadStoredSession(s)}>
                  <SessionRowLeft>
                    <SessionRowDate>
                      {new Date(s.savedAt).toLocaleDateString('ko-KR', {
                        year: 'numeric', month: 'short', day: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </SessionRowDate>
                    <SessionRowName>{s.filename}</SessionRowName>
                    <SessionRowMeta>{s.diveCount}회 다이브</SessionRowMeta>
                  </SessionRowLeft>
                  <SessionRowActions>
                    <ActionBtn $variant="download"
                      title=".fit 다운로드"
                      onClick={(e) => handleDownloadFit(e, s)}>
                      💾
                    </ActionBtn>
                    <ActionBtn $variant="delete"
                      title="삭제"
                      onClick={(e) => handleDelete(e, s.id!)}>
                      🗑️
                    </ActionBtn>
                    <LoadBtn>불러오기 ›</LoadBtn>
                  </SessionRowActions>
                </SessionRow>
              ))}
            </SessionList>
          )}
        </SessionSection>

        <Footer>
          <FooterText>파일은 브라우저 내에서만 처리되며 서버에 업로드되지 않습니다.</FooterText>
        </Footer>
      </Container>
    </Page>
  );
}

/* ── Animations ──────────────────────────────────────── */
const pulse = keyframes`
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.8; transform: scale(1.05); }
`;
const spin = keyframes`to { transform: rotate(360deg); }`;
const premiumFloat = keyframes`
  0%   { transform: translateY(0px)   rotate(0deg)    scale(1);
         filter: drop-shadow(0 6px 18px rgba(6,182,212,0.18)); }
  15%  { transform: translateY(-5px)  rotate(-0.7deg) scale(1.010); }
  50%  { transform: translateY(-16px) rotate(0deg)    scale(1.024);
         filter: drop-shadow(0 28px 40px rgba(6,182,212,0.34)); }
  85%  { transform: translateY(-5px)  rotate(0.7deg)  scale(1.010); }
  100% { transform: translateY(0px)   rotate(0deg)    scale(1);
         filter: drop-shadow(0 6px 18px rgba(6,182,212,0.18)); }
`;
const floatShadow = keyframes`
  0%, 100% { transform: scaleX(1);    opacity: 0.28; }
  50%       { transform: scaleX(0.5); opacity: 0.07; }
`;
const gradientMove = keyframes`
  0%   { background-position: 0% 50%; }
  50%  { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
`;

/* ── Layout ──────────────────────────────────────────── */
const Page = styled.div`
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 48px 24px 80px;
  position: relative;
`;

const Background = styled.div`
  position: fixed; inset: 0;
  background:
    radial-gradient(ellipse 80% 60% at 50% 0%, #0a1628 0%, transparent 70%),
    radial-gradient(ellipse 60% 40% at 80% 80%, #06182e 0%, transparent 60%),
    ${tokens.bg.base};
  z-index: -1;
`;

const Container = styled.div`
  width: 100%;
  max-width: 680px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 32px;
`;

/* ── Logo ────────────────────────────────────────────── */
const Logo = styled.div`
  text-align: center; display: flex; flex-direction: column;
  align-items: center; gap: 6px;
`;
const LogoImageWrap = styled.div`
  width: 36%; display: flex; flex-direction: column; align-items: center; gap: 0;
`;
const LogoImg = styled.img`
  width: 100%;
  animation: ${premiumFloat} 5.2s cubic-bezier(0.37, 0, 0.63, 1) infinite;
  will-change: transform, filter;
`;
const LogoImgShadow = styled.div`
  width: 50%; height: 10px;
  background: radial-gradient(ellipse at center, rgba(6,182,212,0.38) 0%, transparent 70%);
  border-radius: 50%;
  animation: ${floatShadow} 5.2s cubic-bezier(0.37, 0, 0.63, 1) infinite;
  will-change: transform, opacity; margin-top: 2px;
`;
const LogoSub = styled.p`
  font-size: 12px; letter-spacing: 0.18em; text-transform: uppercase; color: ${tokens.text.muted};
`;
const LogoContainer = styled.div`
  display: inline-flex; align-items: center; gap: 10px;
  cursor: pointer; transition: opacity 0.2s;
  &:hover { opacity: 0.85; }
`;
const TitleText = styled.div`
  display: inline-flex; align-items: baseline;
  font-size: 20px; font-weight: 800; letter-spacing: -0.04em; overflow: hidden;
`;
const LogoWord = styled.span`display: inline-flex; align-items: baseline;`;
const LogoInit = styled.span<{ $expanded: boolean }>`
  font-size: 36px; font-weight: 800;
  letter-spacing: ${({ $expanded }) => ($expanded ? '0.01em' : '0.13em')};
  transition: letter-spacing 0.45s cubic-bezier(0.16, 1, 0.3, 1);
  background: linear-gradient(135deg, #60a5fa 0%, #06b6d4 50%, #14b8a6 100%);
  background-size: 200% 200%;
  -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
  animation: ${gradientMove} 4s ease infinite; flex-shrink: 0;
`;
const LogoSuffix = styled.span<{ $expanded: boolean }>`
  display: inline-block; white-space: nowrap; overflow: hidden;
  max-width: ${({ $expanded }) => ($expanded ? '200px' : '0px')};
  opacity: ${({ $expanded }) => ($expanded ? 1 : 0)};
  transition: max-width 0.52s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.32s ease;
  vertical-align: baseline;
`;

/* ── Drop zone ───────────────────────────────────────── */
const DropArea = styled.div`width: 100%; max-width: 520px;`;

const DropZone = styled.div<{ $state: DropState }>`
  width: 100%;
  min-height: 220px;
  border: 2px dashed ${({ $state }) =>
    $state === 'hover'   ? tokens.accent.cyan
    : $state === 'error' ? tokens.accent.danger
    : $state === 'loading' ? tokens.accent.indigo
    : tokens.border.default};
  border-radius: ${tokens.radius.xl};
  background: ${({ $state }) =>
    $state === 'hover'   ? 'rgba(6,182,212,0.06)'
    : $state === 'error' ? 'rgba(239,68,68,0.04)'
    : tokens.bg.surface};
  display: flex; align-items: center; justify-content: center;
  cursor: ${({ $state }) => $state === 'idle' ? 'pointer' : 'default'};
  transition: all 0.2s ease;
  box-shadow: ${({ $state }) => $state === 'hover' ? '0 0 32px rgba(6,182,212,0.12)' : 'none'};
  transform: ${({ $state }) => $state === 'hover' ? 'scale(1.01)' : 'scale(1)'};
  &:active { transform: scale(0.99); }
`;

const StateContent = styled.div`
  display: flex; flex-direction: column; align-items: center;
  gap: 12px; padding: 32px; text-align: center;
`;
const StateIcon  = styled.span`font-size: 40px; line-height: 1;`;
const DropIcon   = styled.span<{ $hover: boolean }>`
  font-size: 40px; line-height: 1; display: block;
  animation: ${({ $hover }) => $hover ? css`${pulse} 0.8s ease-in-out infinite` : 'none'};
`;
const StateTitle = styled.h2`font-size: 18px; font-weight: 600; color: ${tokens.text.primary};`;
const StateDesc  = styled.p`font-size: 13px; color: ${tokens.text.secondary}; max-width: 300px; line-height: 1.6;`;
const BrowseHint = styled.span`
  font-size: 12px; color: ${tokens.text.muted}; margin-top: 4px;
  border: 1px solid ${tokens.border.subtle}; padding: 6px 14px; border-radius: 99px;
  transition: border-color 0.2s, color 0.2s;
  &:hover { border-color: ${tokens.accent.cyan}; color: ${tokens.accent.cyan}; }
`;
const Spinner = styled.div`
  width: 36px; height: 36px;
  border: 3px solid ${tokens.border.default}; border-top-color: ${tokens.accent.cyan};
  border-radius: 50%; animation: ${spin} 0.8s linear infinite;
`;
const RetryButton = styled.button`
  margin-top: 8px; padding: 8px 20px; border-radius: ${tokens.radius.md};
  background: ${tokens.bg.elevated}; border: 1px solid ${tokens.border.default};
  color: ${tokens.text.secondary}; font-size: 13px; transition: all 0.2s;
  &:hover { border-color: ${tokens.accent.cyan}; color: ${tokens.accent.cyan}; }
`;

/* ── Session library ─────────────────────────────────── */
const SessionSection = styled.div`
  width: 100%;
  background: ${tokens.bg.surface};
  border: 1px solid ${tokens.border.subtle};
  border-radius: ${tokens.radius.lg};
  overflow: hidden;
`;

const SessionHeader = styled.div`
  display: flex; align-items: center; gap: 10px;
  padding: 14px 20px;
  border-bottom: 1px solid ${tokens.border.subtle};
`;

const SessionTitle = styled.h2`
  font-size: 11px; font-weight: 600; letter-spacing: 0.08em;
  text-transform: uppercase; color: ${tokens.text.muted};
`;

const SessionCount = styled.span`
  font-size: 11px; color: ${tokens.text.muted};
  background: ${tokens.bg.elevated}; border: 1px solid ${tokens.border.subtle};
  padding: 1px 8px; border-radius: 99px;
`;

const HeaderActions = styled.div`
  margin-left: auto; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
`;

const ImportMsg = styled.span<{ $ok: boolean }>`
  font-size: 11px; font-weight: 600;
  color: ${({ $ok }) => $ok ? tokens.accent.teal : tokens.accent.danger};
`;

const ImportAllBtn = styled.button`
  font-size: 11px; font-weight: 600;
  padding: 5px 14px; border-radius: ${tokens.radius.md};
  background: ${tokens.bg.elevated}; border: 1px solid ${tokens.border.subtle};
  color: ${tokens.text.secondary}; transition: all 0.15s;
  &:hover:not(:disabled) { border-color: ${tokens.accent.teal}; color: ${tokens.accent.teal}; }
  &:disabled { opacity: 0.5; cursor: default; }
`;

const ExportAllBtn = styled.button`
  font-size: 11px; font-weight: 600;
  padding: 5px 14px; border-radius: ${tokens.radius.md};
  background: ${tokens.bg.elevated}; border: 1px solid ${tokens.border.subtle};
  color: ${tokens.text.secondary}; transition: all 0.15s;
  &:hover:not(:disabled) { border-color: ${tokens.accent.cyan}; color: ${tokens.accent.cyan}; }
  &:disabled { opacity: 0.5; cursor: default; }
`;

const EmptyLibrary = styled.div`
  display: flex; flex-direction: column; align-items: center; gap: 10px;
  padding: 40px 20px; text-align: center;
`;
const EmptyIcon = styled.span`font-size: 32px; opacity: 0.4;`;
const EmptyText = styled.p`font-size: 13px; color: ${tokens.text.muted}; line-height: 1.6;`;

const SessionList = styled.div`display: flex; flex-direction: column;`;

const SessionRow = styled.div`
  display: flex; align-items: center; gap: 12px;
  padding: 12px 20px;
  border-bottom: 1px solid ${tokens.border.subtle};
  cursor: pointer; transition: background 0.12s;
  &:last-child { border-bottom: none; }
  &:hover { background: ${tokens.bg.elevated}; }
`;

const SessionRowLeft = styled.div`flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px;`;

const SessionRowDate = styled.span`
  font-size: 10px; font-weight: 600; letter-spacing: 0.04em;
  text-transform: uppercase; color: ${tokens.text.muted};
`;

const SessionRowName = styled.span`
  font-size: 13px; font-weight: 600; color: ${tokens.text.primary};
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
`;

const SessionRowMeta = styled.span`font-size: 11px; color: ${tokens.text.muted};`;

const SessionRowActions = styled.div`display: flex; align-items: center; gap: 6px; flex-shrink: 0;`;

const ActionBtn = styled.button<{ $variant: 'download' | 'delete' }>`
  font-size: 14px; line-height: 1;
  background: none; border: 1px solid ${tokens.border.subtle};
  border-radius: ${tokens.radius.sm}; padding: 4px 8px;
  cursor: pointer; transition: all 0.15s;
  &:hover {
    background: ${({ $variant }) => $variant === 'delete' ? `${tokens.accent.danger}15` : `${tokens.accent.cyan}15`};
    border-color: ${({ $variant }) => $variant === 'delete' ? tokens.accent.danger : tokens.accent.cyan};
  }
`;

const LoadBtn = styled.button`
  font-size: 12px; font-weight: 600;
  padding: 5px 14px; border-radius: ${tokens.radius.md};
  background: ${tokens.accent.cyan}1a; border: 1px solid ${tokens.accent.cyan}44;
  color: ${tokens.accent.cyan}; white-space: nowrap; transition: all 0.15s;
  &:hover { background: ${tokens.accent.cyan}2a; }
`;

/* ── Footer ──────────────────────────────────────────── */
const Footer   = styled.div`text-align: center;`;
const FooterText = styled.p`font-size: 11px; color: ${tokens.text.muted}; line-height: 1.6;`;
