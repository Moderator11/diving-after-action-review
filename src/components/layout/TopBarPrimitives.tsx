/**
 * Shared top-bar layout primitives used across SessionPage, DivePage, ComparePage.
 *
 * RawDataPage has its own compact top bar (no sticky, different padding) so it keeps
 * its own styled components.
 */
import styled from 'styled-components';
import { tokens } from '../../styles/GlobalStyle';

/** Sticky frosted-glass header bar */
export const TopBarEl = styled.header`
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

/** "← Back" ghost button */
export const BackButton = styled.button`
  font-size: 13px;
  color: ${tokens.text.secondary};
  background: ${tokens.bg.surface};
  border: 1px solid ${tokens.border.subtle};
  border-radius: ${tokens.radius.md};
  padding: 7px 14px;
  white-space: nowrap;
  transition: all 0.2s;
  &:hover { border-color: ${tokens.accent.cyan}; color: ${tokens.accent.cyan}; }
`;

/** Flex spacer to push right-side content to the right */
export const NavSpacer = styled.div`flex: 1;`;

/** Pill container that wraps Tab buttons */
export const TabNav = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  background: ${tokens.bg.elevated};
  border: 1px solid ${tokens.border.subtle};
  border-radius: ${tokens.radius.md};
  padding: 3px;
`;

/** Individual tab button inside TabNav */
export const Tab = styled.button<{ $active: boolean }>`
  font-size: 12px;
  font-weight: ${({ $active }) => ($active ? '600' : '400')};
  padding: 5px 14px;
  border-radius: 7px;
  color: ${({ $active }) => ($active ? tokens.text.primary : tokens.text.muted)};
  background: ${({ $active }) => ($active ? tokens.bg.surface : 'transparent')};
  border: ${({ $active }) =>
    $active ? `1px solid ${tokens.border.default}` : '1px solid transparent'};
  transition: all 0.15s;
  white-space: nowrap;
  &:hover { color: ${tokens.text.primary}; }
`;

/** Full-page layout wrapper */
export const PageEl = styled.div`
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: ${tokens.bg.base};
`;
