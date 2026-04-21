import { useCallback, useState, useRef, useEffect } from 'react';
import styled, { keyframes, css } from 'styled-components';
import { useNavigate } from 'react-router-dom';
import { tokens } from '../styles/GlobalStyle';
import { parseFitFile } from '../utils/parseFit';
import { useDiveSession } from '../store/DiveContext';
import favicon from '/favicon.svg'

type DropState = 'idle' | 'hover' | 'loading' | 'error';

export default function HomePage() {
  const navigate = useNavigate();
  const { setSession } = useDiveSession();
  const [dropState, setDropState] = useState<DropState>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [progress, setProgress] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(
    async (file: File) => {
      if (!file.name.toLowerCase().endsWith('.fit')) {
        setDropState('error');
        setErrorMsg('.fit 파일만 지원됩니다.');
        return;
      }

      setDropState('loading');
      setProgress('파일 읽는 중…');

      try {
        const buffer = await file.arrayBuffer();
        setProgress('데이터 파싱 중…');
        const session = await parseFitFile(buffer, file.name);
        setSession(session);
        navigate('/session');
      } catch (err) {
        console.error(err);
        setDropState('error');
        setErrorMsg(
          err instanceof Error ? err.message : '파싱 중 오류가 발생했습니다.'
        );
      }
    },
    [navigate, setSession]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDropState('idle');
      const file = e.dataTransfer.files?.[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDropState('hover');
  };

  const onDragLeave = () => setDropState('idle');

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const retry = () => {
    setDropState('idle');
    setErrorMsg('');
    if (inputRef.current) inputRef.current.value = '';
  };

    // ── Logo expand animation ────────────────────────────────────────────────
  const [logoExpanded, setLogoExpanded] = useState(false);
  const isHovering = useRef(false);
  const collapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
  const INTERVAL_MS = 3000;
  const HOLD_MS = 3000;

  let timer: ReturnType<typeof setTimeout>;

  const loop = () => {
    if (isHovering.current) return;

    setLogoExpanded(true);

    timer = setTimeout(() => {
      if (!isHovering.current) {
        setLogoExpanded(false);

        // 다음 사이클 예약
        timer = setTimeout(loop, INTERVAL_MS);
      }
    }, HOLD_MS);
  };

  // 최초 시작
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
  { init: "D", rest: "iving\u00A0" },  // trailing nbsp = word space
  { init: "A", rest: "fter\u00A0" },
  { init: "A", rest: "ction\u00A0" },        // AI itself is the abbreviation; space only
  { init: "R", rest: "eview" },
] as const;

  return (
    <Page>
      <Background />
      <Container>
        <Logo>
          <LogoImageWrap>
            <LogoImg src={favicon} alt="DAAR 로고" />
            <LogoImgShadow />
          </LogoImageWrap>
          <LogoContainer
            onMouseEnter={handleLogoEnter}
            onMouseLeave={handleLogoLeave}
          >
            <TitleText>
              {LOGO_PARTS.map(({ init, rest }, i) => (
                <LogoWord key={i}>
                  <LogoInit $expanded={logoExpanded}>{init}</LogoInit>
                  {rest && (
                    <LogoSuffix
                      $expanded={logoExpanded}
                      style={{ transitionDelay: logoExpanded ? `${i * 38}ms` : "0ms" }}
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

        <DropZone
          $state={dropState}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onClick={() => dropState === 'idle' && inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".fit"
            style={{ display: 'none' }}
            onChange={onFileChange}
          />

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
              <StateDesc>
                Garmin · Suunto · Mares 등 다이빙 컴퓨터 .fit 파일 지원
              </StateDesc>
              <BrowseHint>또는 클릭하여 파일 선택</BrowseHint>
            </StateContent>
          )}
        </DropZone>

        <Footer>
          <FooterText>
            파일은 브라우저 내에서만 처리되며 서버에 업로드되지 않습니다.
          </FooterText>
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

const spin = keyframes`
  to { transform: rotate(360deg); }
`;

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
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
`;

/* ── Styled Components ───────────────────────────────── */
const Page = styled.div`
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  position: relative;
`;

const Background = styled.div`
  position: fixed;
  inset: 0;
  background:
    radial-gradient(ellipse 80% 60% at 50% 0%, #0a1628 0%, transparent 70%),
    radial-gradient(ellipse 60% 40% at 80% 80%, #06182e 0%, transparent 60%),
    ${tokens.bg.base};
  z-index: -1;
`;

const Container = styled.div`
  width: 100%;
  max-width: 520px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 32px;
`;

const Logo = styled.div`
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
`;

/** Wrapper that stacks the floating image + its cast shadow */
const LogoImageWrap = styled.div`
  width: 42%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;
`;

const LogoImg = styled.img`
  width: 100%;
  animation: ${premiumFloat} 5.2s cubic-bezier(0.37, 0, 0.63, 1) infinite;
  will-change: transform, filter;
`;

/** Elliptical glow/shadow that shrinks as the logo rises */
const LogoImgShadow = styled.div`
  width: 50%;
  height: 10px;
  background: radial-gradient(
    ellipse at center,
    rgba(6, 182, 212, 0.38) 0%,
    transparent 70%
  );
  border-radius: 50%;
  animation: ${floatShadow} 5.2s cubic-bezier(0.37, 0, 0.63, 1) infinite;
  will-change: transform, opacity;
  margin-top: 2px;
`;

const LogoSub = styled.p`
  font-size: 12px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: ${tokens.text.muted};
`;


const DropZone = styled.div<{ $state: DropState }>`
  width: 100%;
  min-height: 260px;
  border: 2px dashed
    ${({ $state }) =>
      $state === 'hover' ? tokens.accent.cyan
      : $state === 'error' ? tokens.accent.danger
      : $state === 'loading' ? tokens.accent.indigo
      : tokens.border.default};
  border-radius: ${tokens.radius.xl};
  background: ${({ $state }) =>
    $state === 'hover' ? 'rgba(6,182,212,0.06)'
    : $state === 'error' ? 'rgba(239,68,68,0.04)'
    : tokens.bg.surface};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: ${({ $state }) => $state === 'idle' ? 'pointer' : 'default'};
  transition: all 0.2s ease;
  box-shadow: ${({ $state }) =>
    $state === 'hover' ? `0 0 32px rgba(6,182,212,0.12)` : 'none'};
  transform: ${({ $state }) => $state === 'hover' ? 'scale(1.01)' : 'scale(1)'};

  &:active {
    transform: scale(0.99);
  }
`;

const StateContent = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 40px 32px;
  text-align: center;
`;

const StateIcon = styled.span`
  font-size: 40px;
  line-height: 1;
`;

const DropIcon = styled.span<{ $hover: boolean }>`
  font-size: 40px;
  line-height: 1;
  display: block;
  animation: ${({ $hover }) => $hover ? css`${pulse} 0.8s ease-in-out infinite` : 'none'};
`;

const StateTitle = styled.h2`
  font-size: 18px;
  font-weight: 600;
  color: ${tokens.text.primary};
`;

const StateDesc = styled.p`
  font-size: 13px;
  color: ${tokens.text.secondary};
  max-width: 320px;
  line-height: 1.6;
`;

const BrowseHint = styled.span`
  font-size: 12px;
  color: ${tokens.text.muted};
  margin-top: 4px;
  border: 1px solid ${tokens.border.subtle};
  padding: 6px 14px;
  border-radius: 99px;
  transition: border-color 0.2s, color 0.2s;

  &:hover {
    border-color: ${tokens.accent.cyan};
    color: ${tokens.accent.cyan};
  }
`;

const Spinner = styled.div`
  width: 36px;
  height: 36px;
  border: 3px solid ${tokens.border.default};
  border-top-color: ${tokens.accent.cyan};
  border-radius: 50%;
  animation: ${spin} 0.8s linear infinite;
`;

const RetryButton = styled.button`
  margin-top: 8px;
  padding: 8px 20px;
  border-radius: ${tokens.radius.md};
  background: ${tokens.bg.elevated};
  border: 1px solid ${tokens.border.default};
  color: ${tokens.text.secondary};
  font-size: 13px;
  transition: all 0.2s;

  &:hover {
    border-color: ${tokens.accent.cyan};
    color: ${tokens.accent.cyan};
  }
`;

const Footer = styled.div`
  text-align: center;
`;

const FooterText = styled.p`
  font-size: 11px;
  color: ${tokens.text.muted};
  line-height: 1.6;
`;


//===============

const LogoContainer = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  transition: opacity 0.2s;
  &:hover { opacity: 0.85; }
`;

const TitleText = styled.div`
  display: inline-flex;
  align-items: baseline;
  font-size: 20px;
  font-weight: 800;
  letter-spacing: -0.04em;
  overflow: hidden; /* clips suffixes during animation */
`;

/** One word group, e.g. <LogoInit>S</LogoInit><LogoSuffix>ilicon</LogoSuffix> */
const LogoWord = styled.span`
  display: inline-flex;
  align-items: baseline;
`;

/** Always-visible initial letter(s) */
const LogoInit = styled.span<{ $expanded: boolean }>`
  font-size: 36px;
  font-weight: 800;
  /* Wide spacing for DAAR acronym; narrows to zero when suffix slides in */
  letter-spacing: ${({ $expanded }) => ($expanded ? '0.01em' : '0.13em')};
  transition: letter-spacing 0.45s cubic-bezier(0.16, 1, 0.3, 1);
  background: linear-gradient(135deg, #60a5fa 0%, #06b6d4 50%, #14b8a6 100%);
  background-size: 200% 200%;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  animation: ${gradientMove} 4s ease infinite;
  flex-shrink: 0;
`;

/** Suffix that slides in to the right on expand */
const LogoSuffix = styled.span<{ $expanded: boolean }>`
  display: inline-block;
  white-space: nowrap;
  overflow: hidden;
  /* max-width drives the layout expansion; clip keeps it tidy at width:0 */
  max-width: ${({ $expanded }) => ($expanded ? "200px" : "0px")};
  opacity: ${({ $expanded }) => ($expanded ? 1 : 0)};
  transition:
    max-width 0.52s cubic-bezier(0.16, 1, 0.3, 1),
    opacity   0.32s ease;
  vertical-align: baseline;
`;