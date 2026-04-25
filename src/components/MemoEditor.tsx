import styled from 'styled-components';
import { tokens } from '../styles/GlobalStyle';
import { useDiveSession } from '../store/DiveContext';

interface Props {
  diveIndex: number;
}

const MAX_CHARS = 500;

export function MemoEditor({ diveIndex }: Props) {
  const { memos, setMemo } = useDiveSession();
  const value = memos[diveIndex] ?? '';

  return (
    <Card>
      <Header>
        <HeaderIcon>📝</HeaderIcon>
        <HeaderTitle>다이브 메모</HeaderTitle>
        <CharCount $warn={value.length > MAX_CHARS * 0.9}>
          {value.length} / {MAX_CHARS}
        </CharCount>
      </Header>
      <TextArea
        value={value}
        maxLength={MAX_CHARS}
        rows={4}
        placeholder={`이 다이브에 대한 메모를 입력하세요\n(컨디션, 시야, 특이사항 등)`}
        onChange={(e) => setMemo(diveIndex, e.target.value)}
      />
      {value.trim() && (
        <ClearBtn onClick={() => setMemo(diveIndex, '')}>지우기</ClearBtn>
      )}
    </Card>
  );
}

/* ── Styled components ─────────────────────────────────── */

const Card = styled.div`
  background: ${tokens.bg.surface};
  border: 1px solid ${tokens.border.subtle};
  border-radius: ${tokens.radius.lg};
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const HeaderIcon = styled.span`font-size: 16px; line-height: 1;`;

const HeaderTitle = styled.h2`
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: ${tokens.text.secondary};
  flex: 1;
`;

const CharCount = styled.span<{ $warn: boolean }>`
  font-size: 11px;
  color: ${({ $warn }) => ($warn ? tokens.accent.danger : tokens.text.muted)};
  transition: color 0.2s;
`;

const TextArea = styled.textarea`
  width: 100%;
  background: ${tokens.bg.elevated};
  border: 1px solid ${tokens.border.subtle};
  border-radius: ${tokens.radius.md};
  color: ${tokens.text.primary};
  font-size: 14px;
  line-height: 1.6;
  padding: 12px 14px;
  resize: vertical;
  min-height: 96px;
  font-family: inherit;
  transition: border-color 0.15s;
  &::placeholder { color: ${tokens.text.muted}; }
  &:focus { outline: none; border-color: ${tokens.accent.cyan}88; }
`;

const ClearBtn = styled.button`
  align-self: flex-end;
  font-size: 11px;
  color: ${tokens.text.muted};
  background: transparent;
  border: 1px solid ${tokens.border.subtle};
  border-radius: ${tokens.radius.sm};
  padding: 3px 10px;
  transition: all 0.15s;
  &:hover { color: ${tokens.accent.danger}; border-color: ${tokens.accent.danger}66; }
`;
