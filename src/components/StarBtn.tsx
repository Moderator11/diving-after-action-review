import styled from 'styled-components';
import { tokens } from '../styles/GlobalStyle';
import { useDiveSession } from '../store/DiveContext';

interface Props {
  diveIdx: number;
  size?: 'sm' | 'md' | 'lg';
}

export function StarBtn({ diveIdx, size = 'md' }: Props) {
  const { favorites, toggleFavorite } = useDiveSession();
  const active = favorites.includes(diveIdx);

  return (
    <Btn
      $active={active}
      $size={size}
      title={active ? '즐겨찾기 해제' : '즐겨찾기'}
      onClick={(e) => {
        e.stopPropagation();
        toggleFavorite(diveIdx);
      }}
    >
      {active ? '★' : '☆'}
    </Btn>
  );
}

const Btn = styled.button<{ $active: boolean; $size: 'sm' | 'md' | 'lg' }>`
  background: none;
  border: none;
  padding: 0;
  line-height: 1;
  cursor: pointer;
  font-size: ${({ $size }) => $size === 'sm' ? '14px' : $size === 'lg' ? '22px' : '18px'};
  color: ${({ $active }) => $active ? '#f59e0b' : tokens.text.muted};
  transition: color 0.15s, transform 0.1s;
  flex-shrink: 0;
  &:hover { color: #f59e0b; transform: scale(1.2); }
  &:active { transform: scale(0.9); }
`;
