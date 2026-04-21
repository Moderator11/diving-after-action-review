import styled from 'styled-components';
import { tokens } from '../styles/GlobalStyle';

interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  icon?: string;
  accent?: keyof typeof tokens.accent;
  sub?: string;
}

export function MetricCard({
  label,
  value,
  unit,
  icon,
  accent = 'cyan',
  sub,
}: MetricCardProps) {
  return (
    <Card $accent={accent}>
      <Top>
        {icon && <Icon>{icon}</Icon>}
        <Label>{label}</Label>
      </Top>
      <ValueRow>
        <Value>{value}</Value>
        {unit && <Unit>{unit}</Unit>}
      </ValueRow>
      {sub && <Sub>{sub}</Sub>}
      <Glow $accent={accent} />
    </Card>
  );
}

const Card = styled.div<{ $accent: string }>`
  position: relative;
  overflow: hidden;
  background: ${tokens.bg.surface};
  border: 1px solid ${tokens.border.subtle};
  border-radius: ${tokens.radius.lg};
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: border-color 0.2s, transform 0.2s;

  &:hover {
    border-color: ${({ $accent }) => tokens.accent[$accent as keyof typeof tokens.accent] ?? tokens.accent.cyan}44;
    transform: translateY(-2px);
  }
`;

const Top = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const Icon = styled.span`
  font-size: 16px;
  line-height: 1;
`;

const Label = styled.span`
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: ${tokens.text.secondary};
`;

const ValueRow = styled.div`
  display: flex;
  align-items: baseline;
  gap: 6px;
`;

const Value = styled.span`
  font-size: 28px;
  font-weight: 700;
  color: ${tokens.text.primary};
  letter-spacing: -0.02em;
  line-height: 1.1;
`;

const Unit = styled.span`
  font-size: 13px;
  color: ${tokens.text.secondary};
  font-weight: 500;
`;

const Sub = styled.span`
  font-size: 11px;
  color: ${tokens.text.muted};
`;

const Glow = styled.div<{ $accent: string }>`
  position: absolute;
  bottom: -20px;
  right: -20px;
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: ${({ $accent }) => tokens.accent[$accent as keyof typeof tokens.accent] ?? tokens.accent.cyan};
  opacity: 0.06;
  filter: blur(20px);
  pointer-events: none;
`;
