import styled from 'styled-components';
import { tokens } from '../styles/GlobalStyle';
import type { DetectedDive } from '../types/dive';
import { formatDuration } from '../utils/parseFit';
import { computeSessionCompliance } from '../utils/aidaInterval';

interface Props {
  dives: DetectedDive[];
}

export function AidaIntervalCard({ dives }: Props) {
  if (dives.length < 2) return null;

  const compliance   = computeSessionCompliance(dives);
  const passCount    = compliance.filter(c => c.passed).length;
  const failCount    = compliance.length - passCount;
  const passRate     = passCount / compliance.length;
  const hasDeepDives = compliance.some(c => c.aida.deepException);

  return (
    <Card>
      <CardHeader>
        <Icon>🛡️</Icon>
        <div>
          <Title>AIDA 권장 수면 휴식 분석</Title>
          <Sub>
            수심 기준 (최대수심 ÷ 5 분) 또는 시간 기준 (잠수 시간 × 2) 중 더 긴 쪽 적용
            {hasDeepDives && ' · 55m 초과 심해 다이브 포함'}
          </Sub>
        </div>
        <ScoreBox>
          <Score $pass={failCount === 0}>
            {passCount} / {compliance.length}
          </Score>
          <ScoreLabel>구간 준수</ScoreLabel>
        </ScoreBox>
      </CardHeader>

      <Bar>
        <BarFill $pct={passRate * 100} $allPass={failCount === 0} />
      </Bar>

      <Rows>
        {compliance.map((c) => {
          const deficit = c.aida.requiredSec - c.actualSec;
          const depthLabel = dives[c.prevDiveIdx]?.maxDepthM.toFixed(1) ?? '?';
          const ruleLabel  = c.aida.bindingRule === 'depth'
            ? `${depthLabel}m ÷ 5`
            : '잠수 × 2';

          return (
            <Row key={`${c.prevDiveIdx}-${c.nextDiveIdx}`} $pass={c.passed}>
              <RowLabel>
                <RowMark $pass={c.passed}>{c.passed ? '✓' : '✗'}</RowMark>
                <span>다이브 {c.prevDiveIdx + 1} → {c.nextDiveIdx + 1}</span>
                {c.aida.deepException && (
                  <DeepBadge title="55m 초과 심해 다이브 — 24시간에 1회 제한">심해</DeepBadge>
                )}
              </RowLabel>

              <RowMeta>
                <MetaItem>
                  <MetaKey>실제 휴식</MetaKey>
                  <MetaVal $pass={c.passed}>{formatDuration(c.actualSec)}</MetaVal>
                </MetaItem>
                <MetaDivider />
                <MetaItem>
                  <MetaKey>권장 ({ruleLabel})</MetaKey>
                  <MetaVal>{formatDuration(c.aida.requiredSec)}</MetaVal>
                </MetaItem>
                {!c.passed && (
                  <>
                    <MetaDivider />
                    <MetaItem>
                      <MetaKey>부족</MetaKey>
                      <MetaVal $warn>{formatDuration(deficit)}</MetaVal>
                    </MetaItem>
                  </>
                )}
              </RowMeta>
            </Row>
          );
        })}
      </Rows>

      {failCount === 0 ? (
        <Footer $pass>✅ 모든 구간에서 AIDA 권장 휴식 시간을 준수했습니다.</Footer>
      ) : (
        <Footer $pass={false}>
          ⚠️ {failCount}개 구간에서 권장 휴식 시간이 부족했습니다.
          충분한 휴식은 삼바(LMC) 및 블랙아웃 예방에 필수적입니다.
        </Footer>
      )}
    </Card>
  );
}

/* ── Styled components ───────────────────────────────────── */

const Card = styled.div`
  background: ${tokens.bg.surface};
  border: 1px solid ${tokens.border.subtle};
  border-left: 3px solid ${tokens.accent.indigo}66;
  border-radius: ${tokens.radius.lg};
  padding: 22px 24px 18px;
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const CardHeader = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 14px;
`;

const Icon = styled.span`
  font-size: 22px;
  line-height: 1;
  flex-shrink: 0;
  margin-top: 2px;
`;

const Title = styled.h2`
  font-size: 14px;
  font-weight: 700;
  color: ${tokens.text.primary};
  letter-spacing: -0.01em;
`;

const Sub = styled.p`
  font-size: 11px;
  color: ${tokens.text.muted};
  margin-top: 3px;
  line-height: 1.5;
`;

const ScoreBox = styled.div`
  margin-left: auto;
  text-align: right;
  flex-shrink: 0;
`;

const Score = styled.span<{ $pass: boolean }>`
  display: block;
  font-size: 22px;
  font-weight: 800;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
  color: ${({ $pass }) => $pass ? tokens.accent.teal : tokens.accent.danger};
`;

const ScoreLabel = styled.span`
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: ${tokens.text.muted};
`;

const Bar = styled.div`
  height: 4px;
  background: ${tokens.bg.overlay};
  border-radius: 2px;
  overflow: hidden;
`;

const BarFill = styled.div<{ $pct: number; $allPass: boolean }>`
  height: 100%;
  width: ${({ $pct }) => $pct}%;
  border-radius: 2px;
  background: ${({ $allPass }) => $allPass ? tokens.accent.teal : tokens.accent.cyan};
  transition: width 0.4s ease;
`;

const Rows = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const Row = styled.div<{ $pass: boolean }>`
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 10px 14px;
  border-radius: ${tokens.radius.md};
  background: ${({ $pass }) => $pass ? tokens.accent.teal + '08' : tokens.accent.danger + '08'};
  border: 1px solid ${({ $pass }) => $pass ? tokens.accent.teal + '20' : tokens.accent.danger + '22'};
`;

const RowLabel = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: ${tokens.text.secondary};
  white-space: nowrap;
  min-width: 130px;
`;

const RowMark = styled.span<{ $pass: boolean }>`
  font-size: 13px;
  font-weight: 800;
  flex-shrink: 0;
  color: ${({ $pass }) => $pass ? tokens.accent.teal : tokens.accent.danger};
`;

const DeepBadge = styled.span`
  font-size: 9px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 99px;
  background: #7c3aed18;
  color: #a78bfa;
  border: 1px solid #7c3aed44;
  cursor: help;
`;

const RowMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
  margin-left: auto;
`;

const MetaItem = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  min-width: 72px;
`;

const MetaKey = styled.span`
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: ${tokens.text.muted};
`;

const MetaVal = styled.span<{ $pass?: boolean; $warn?: boolean }>`
  font-size: 13px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: ${({ $pass, $warn }) =>
    $warn        ? tokens.accent.danger
    : $pass === true  ? tokens.accent.teal
    : $pass === false ? tokens.accent.danger
    : tokens.text.primary};
`;

const MetaDivider = styled.div`
  width: 1px;
  height: 28px;
  background: ${tokens.border.subtle};
  margin: 0 8px;
`;

const Footer = styled.p<{ $pass: boolean }>`
  font-size: 12px;
  font-weight: 600;
  line-height: 1.5;
  border-radius: ${tokens.radius.md};
  padding: 10px 16px;
  color:       ${({ $pass }) => $pass ? tokens.accent.teal   : tokens.accent.danger};
  background:  ${({ $pass }) => $pass ? tokens.accent.teal   : tokens.accent.danger}0d;
  border: 1px solid ${({ $pass }) => $pass ? tokens.accent.teal : tokens.accent.danger}33;
`;
