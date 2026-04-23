import styled from 'styled-components';
import { tokens } from '../../styles/GlobalStyle';

export function Footer() {
  return (
    <FooterEl>
      <Inner>
        <Brand>DAAR</Brand>
        <Dot>·</Dot>
        <Desc>Diving After Action Review</Desc>
        <Separator />
        <Credit>PADI 마스터 프리다이버 과제 · Made by 박수민</Credit>
        <Year>© {new Date().getFullYear()} Soomin Park</Year>
      </Inner>
    </FooterEl>
  );
}

const FooterEl = styled.footer`
  border-top: 1px solid ${tokens.border.subtle};
  background: ${tokens.bg.base};
  padding: 18px 32px;
  flex-shrink: 0;
`;

const Inner = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const Brand = styled.span`
  font-size: 12px;
  font-weight: 700;
  color: ${tokens.accent.cyan};
  letter-spacing: 0.08em;
`;

const Dot = styled.span`
  font-size: 12px;
  color: ${tokens.border.default};
`;

const Desc = styled.span`
  font-size: 12px;
  color: ${tokens.text.muted};
`;

const Separator = styled.div`
  flex: 1;
`;

const Credit = styled.span`
  font-size: 11px;
  color: ${tokens.text.muted};
`;

const Year = styled.span`
  font-size: 11px;
  color: ${tokens.border.default};
`;
