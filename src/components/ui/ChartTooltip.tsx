/**
 * Shared tooltip primitives for recharts charts.
 *
 * Usage:
 *   <TtBox>
 *     <TtTime>0:42</TtTime>
 *     <TtRow $c={tokens.chart.depth}><span>수심</span><strong>12.3 m</strong></TtRow>
 *   </TtBox>
 */
import styled from 'styled-components';
import { tokens } from '../../styles/GlobalStyle';

export const TtBox = styled.div`
  background: ${tokens.bg.elevated};
  border: 1px solid ${tokens.border.default};
  border-radius: ${tokens.radius.md};
  padding: 10px 14px;
  font-size: 12px;
  box-shadow: ${tokens.shadow.card};
`;

export const TtTime = styled.div`
  color: ${tokens.text.muted};
  margin-bottom: 6px;
  font-size: 11px;
`;

export const TtRow = styled.div<{ $c: string }>`
  display: flex;
  justify-content: space-between;
  gap: 16px;
  color: ${({ $c }) => $c};
  line-height: 1.8;
`;
