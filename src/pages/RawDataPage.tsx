import { useState, useMemo, useCallback, useEffect } from 'react';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import { tokens } from '../styles/GlobalStyle';
import { useRequireSession } from '../hooks/useRequireSession';
import type { FitMessageGroup } from '../types/dive';

const PAGE_SIZE_OPTIONS = [50, 100, 200, 500];
type SortDir = 'asc' | 'desc' | null;

// ── Helpers ───────────────────────────────────────────────
function formatCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') {
    // Round to reasonable precision
    return Number.isInteger(v) ? String(v) : parseFloat(v.toFixed(4)).toString();
  }
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function isDepth(key: string): boolean {
  return key === 'depth' || key === 'avgDepth' || key === 'maxDepth';
}

function isPressure(key: string): boolean {
  return key === 'absolutePressure';
}

// camelCase → readable
function camelToLabel(key: string): string {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
}

// Unit hint per column
function unitHint(key: string): string {
  if (isDepth(key)) return 'm';
  if (isPressure(key)) return 'Pa';
  if (key === 'ascentRate' || key === 'avgAscentRate' || key === 'maxAscentRate') return 'm/s';
  if (key === 'avgDescentRate' || key === 'maxDescentRate') return 'm/s';
  if (key === 'heartRate' || key === 'avgHeartRate' || key === 'maxHeartRate') return 'bpm';
  if (key === 'temperature' || key === 'avgTemperature' || key === 'maxTemperature') return '°C';
  if (key.toLowerCase().includes('calories')) return 'kcal';
  if (key === 'totalElapsedTime' || key === 'totalTimerTime' || key === 'bottomTime') return 's';
  if (key === 'surfaceInterval') return 's';
  if (key === 'weight') return 'kg';
  if (key === 'height') return 'm';
  if (key === 'waterDensity') return 'kg/m³';
  if (key === 'softwareVersion') return '';
  if (key === 'enhancedAltitude') return 'm';
  if (key === 'totalDistance') return 'm';
  return '';
}

export default function RawDataPage() {
  const navigate = useNavigate();
  const session  = useRequireSession();

  const [selectedKey, setSelectedKey] = useState<string>('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(100);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(new Set());

  if (!session) return null;

  const { allMessages, filename } = session;

  // Default to recordMesgs on first load
  useEffect(() => {
    if (allMessages.length > 0 && !selectedKey) {
      const rec = allMessages.find((m) => m.key === 'recordMesgs');
      setSelectedKey(rec ? rec.key : allMessages[0].key);
    }
  }, [allMessages, selectedKey]);

  const group: FitMessageGroup | undefined = allMessages.find((m) => m.key === selectedKey);

  // Reset on group change
  const selectGroup = useCallback((key: string) => {
    setSelectedKey(key);
    setPage(0);
    setSearch('');
    setSortKey(null);
    setSortDir(null);
    setHiddenCols(new Set());
  }, []);

  const activeCols = useMemo(
    () => (group?.columns ?? []).filter((c) => !hiddenCols.has(c)),
    [group, hiddenCols]
  );

  // Filter
  const filtered = useMemo(() => {
    if (!group) return [];
    const q = search.trim().toLowerCase();
    if (!q) return group.rows;
    return group.rows.filter((row) =>
      activeCols.some((col) => {
        const v = row[col];
        return v != null && String(v).toLowerCase().includes(q);
      })
    );
  }, [group, search, activeCols]);

  // Sort
  const sorted = useMemo(() => {
    if (!sortKey || !sortDir) return filtered;
    return [...filtered].sort((a, b) => {
      const va = a[sortKey] ?? '';
      const vb = b[sortKey] ?? '';
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const pageRows = useMemo(
    () => sorted.slice(page * pageSize, (page + 1) * pageSize),
    [sorted, page, pageSize]
  );

  const handleSort = useCallback((col: string) => {
    setSortKey((prev) => {
      if (prev !== col) { setSortDir('asc'); return col; }
      setSortDir((d) => {
        if (d === 'asc') return 'desc';
        setSortKey(null); return null;
      });
      return col;
    });
    setPage(0);
  }, []);

  const toggleCol = useCallback((col: string) => {
    setHiddenCols((prev) => {
      const next = new Set(prev);
      if (next.has(col)) next.delete(col);
      else if (activeCols.length > 1) next.add(col);
      return next;
    });
  }, [activeCols]);

  const exportCSV = useCallback(() => {
    if (!group) return;
    const header = activeCols.join(',');
    const rows = sorted.map((row) =>
      activeCols.map((c) => {
        const v = formatCell(row[c]);
        return v.includes(',') || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v;
      }).join(',')
    ).join('\n');
    const blob = new Blob([header + '\n' + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename.replace(/\.fit$/i, '')}_${group.label.replace(/\s+/g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [group, sorted, activeCols, filename]);

  const totalRows = allMessages.reduce((s, m) => s + m.count, 0);

  return (
    <Page>
      <TopBar>
        <BackBtn onClick={() => navigate('/session')}>← 세션 요약</BackBtn>
        <Title>Raw Data Explorer</Title>
        <FilePill>{filename}</FilePill>
        <Spacer />
        {group && (
          <ExportBtn onClick={exportCSV}>↓ CSV</ExportBtn>
        )}
      </TopBar>

      <Body>
        {/* ── Sidebar ── */}
        <Sidebar>
          <SidebarHeader>
            <SideTitle>메시지 타입</SideTitle>
            <TotalBadge>{totalRows.toLocaleString()} rows</TotalBadge>
          </SidebarHeader>
          <MsgList>
            {allMessages.map((m) => (
              <MsgItem
                key={m.key}
                $active={m.key === selectedKey}
                onClick={() => selectGroup(m.key)}
              >
                <MsgLabel $active={m.key === selectedKey}>{m.label}</MsgLabel>
                <MsgCount $active={m.key === selectedKey}>{m.count.toLocaleString()}</MsgCount>
              </MsgItem>
            ))}
          </MsgList>
        </Sidebar>

        {/* ── Main panel ── */}
        <Main>
          {!group ? (
            <EmptyState>메시지 타입을 선택하세요</EmptyState>
          ) : (
            <>
              {/* Controls */}
              <Controls>
                <ControlLeft>
                  <SearchBox
                    placeholder="값 검색…"
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                  />
                  <ColToggleRow>
                    <ToggleLabel>컬럼:</ToggleLabel>
                    {group.columns.map((col) => (
                      <ColChip
                        key={col}
                        $active={!hiddenCols.has(col)}
                        onClick={() => toggleCol(col)}
                        title={unitHint(col) ? `단위: ${unitHint(col)}` : camelToLabel(col)}
                      >
                        {col}
                      </ColChip>
                    ))}
                  </ColToggleRow>
                </ControlLeft>
                <ControlRight>
                  <PageSizeSelect
                    value={pageSize}
                    onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }}
                  >
                    {PAGE_SIZE_OPTIONS.map((n) => (
                      <option key={n} value={n}>{n}행</option>
                    ))}
                  </PageSizeSelect>
                </ControlRight>
              </Controls>

              {/* Info bar */}
              <InfoBar>
                <InfoText>
                  <strong>{group.label}</strong>
                  &nbsp;·&nbsp;전체 <strong>{group.count.toLocaleString()}</strong>행
                  {filtered.length !== group.count && (
                    <> → 필터 <strong>{filtered.length.toLocaleString()}</strong>행</>
                  )}
                  &nbsp;·&nbsp;
                  {page * pageSize + 1}–{Math.min((page + 1) * pageSize, sorted.length)} 표시
                  &nbsp;·&nbsp;
                  {activeCols.length}개 컬럼
                </InfoText>
                <Pagination
                  page={page}
                  totalPages={totalPages}
                  onPage={setPage}
                />
              </InfoBar>

              {/* Table */}
              <TableScroll>
                <Table>
                  <thead>
                    <HeaderRow>
                      <RowNumTh>#</RowNumTh>
                      {activeCols.map((col) => (
                        <Th
                          key={col}
                          $sorted={sortKey === col}
                          onClick={() => handleSort(col)}
                        >
                          <ThInner>
                            <ThName>{col}</ThName>
                            {unitHint(col) && <ThUnit>{unitHint(col)}</ThUnit>}
                            <SortArrow $dir={sortKey === col ? sortDir : null} />
                          </ThInner>
                        </Th>
                      ))}
                    </HeaderRow>
                  </thead>
                  <tbody>
                    {pageRows.map((row, i) => {
                      const absIdx = page * pageSize + i;
                      return (
                        <DataRow key={absIdx} $even={i % 2 === 0}>
                          <RowNum>{absIdx + 1}</RowNum>
                          {activeCols.map((col) => (
                            <DataCell
                              key={col}
                              value={row[col]}
                              colKey={col}
                            />
                          ))}
                        </DataRow>
                      );
                    })}
                  </tbody>
                </Table>
              </TableScroll>

              <BottomPagination>
                <Pagination page={page} totalPages={totalPages} onPage={setPage} />
              </BottomPagination>
            </>
          )}
        </Main>
      </Body>
    </Page>
  );
}

// ── DataCell ─────────────────────────────────────────────
function DataCell({ value, colKey }: { value: unknown; colKey: string }) {
  const isNull = value === null || value === undefined;
  const depth = isDepth(colKey) && !isNull;
  const pressure = isPressure(colKey) && !isNull;

  if (isNull) {
    return <Td $align="right"><NullVal>—</NullVal></Td>;
  }

  if (depth) {
    const m = parseFloat(Number(value).toFixed(3));
    return (
      <Td $align="right">
        <CellPair>
          <CellMain>{m}</CellMain>
          <CellSub>m</CellSub>
        </CellPair>
      </Td>
    );
  }

  if (pressure) {
    const pa = Number(value);
    return (
      <Td $align="right">
        <CellPair>
          <CellMain>{pa}</CellMain>
          <CellSub>{(pa / 100).toFixed(1)} hPa</CellSub>
        </CellPair>
      </Td>
    );
  }

  if (typeof value === 'number') {
    const isInt = Number.isInteger(value);
    return (
      <Td $align="right">
        {isInt ? value : parseFloat(value.toFixed(4))}
      </Td>
    );
  }

  if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}T/)) {
    return (
      <Td $align="left">
        <TimestampVal>{value.replace('T', ' ').replace('.000Z', '')}</TimestampVal>
      </Td>
    );
  }

  if (typeof value === 'object') {
    return <Td $align="left"><ObjVal>{JSON.stringify(value)}</ObjVal></Td>;
  }

  return <Td $align="left">{String(value)}</Td>;
}

// ── Pagination widget ─────────────────────────────────────
function Pagination({ page, totalPages, onPage }: {
  page: number; totalPages: number; onPage: (p: number) => void;
}) {
  return (
    <PagRow>
      <PageBtn disabled={page === 0} onClick={() => onPage(0)}>«</PageBtn>
      <PageBtn disabled={page === 0} onClick={() => onPage(page - 1)}>‹</PageBtn>
      <PageInfo>{page + 1} / {totalPages}</PageInfo>
      <PageBtn disabled={page >= totalPages - 1} onClick={() => onPage(page + 1)}>›</PageBtn>
      <PageBtn disabled={page >= totalPages - 1} onClick={() => onPage(totalPages - 1)}>»</PageBtn>
    </PagRow>
  );
}

// ── SortArrow ─────────────────────────────────────────────
function SortArrow({ $dir }: { $dir: SortDir }) {
  return (
    <SortIcon $active={$dir != null}>
      {$dir === 'asc' ? '↑' : $dir === 'desc' ? '↓' : '↕'}
    </SortIcon>
  );
}

/* ── Styled Components ───────────────────────────────────── */
const Page = styled.div`
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: ${tokens.bg.base};
  overflow: hidden;
`;

const TopBar = styled.header`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 11px 20px;
  background: ${tokens.bg.base}ee;
  backdrop-filter: blur(12px);
  border-bottom: 1px solid ${tokens.border.subtle};
  flex-shrink: 0;
`;

const BackBtn = styled.button`
  font-size: 12px;
  color: ${tokens.text.secondary};
  background: ${tokens.bg.surface};
  border: 1px solid ${tokens.border.subtle};
  border-radius: ${tokens.radius.md};
  padding: 5px 12px;
  white-space: nowrap;
  transition: all 0.2s;
  &:hover { border-color: ${tokens.accent.cyan}; color: ${tokens.accent.cyan}; }
`;

const Title = styled.span`
  font-size: 14px;
  font-weight: 700;
  color: ${tokens.text.primary};
  letter-spacing: 0.03em;
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

const Spacer = styled.div`flex: 1;`;

const ExportBtn = styled.button`
  font-size: 12px; font-weight: 600;
  color: ${tokens.accent.cyan};
  background: ${tokens.accent.cyan}18;
  border: 1px solid ${tokens.accent.cyan}44;
  border-radius: ${tokens.radius.md};
  padding: 5px 14px;
  white-space: nowrap;
  transition: all 0.2s;
  &:hover { background: ${tokens.accent.cyan}28; }
`;

const Body = styled.div`
  display: flex;
  flex: 1;
  overflow: hidden;
`;

const Sidebar = styled.aside`
  width: 200px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  border-right: 1px solid ${tokens.border.subtle};
  background: ${tokens.bg.surface};
  overflow: hidden;
`;

const SidebarHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 14px 10px;
  border-bottom: 1px solid ${tokens.border.subtle};
  flex-shrink: 0;
`;

const SideTitle = styled.span`
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: ${tokens.text.muted};
`;

const TotalBadge = styled.span`
  font-size: 10px;
  color: ${tokens.text.muted};
`;

const MsgList = styled.div`
  overflow-y: auto;
  flex: 1;
  padding: 6px 0;
`;

const MsgItem = styled.div<{ $active: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 14px;
  cursor: pointer;
  background: ${({ $active }) => $active ? tokens.bg.overlay : 'transparent'};
  border-left: 2px solid ${({ $active }) => $active ? tokens.accent.cyan : 'transparent'};
  transition: all 0.15s;
  &:hover { background: ${tokens.bg.elevated}; }
`;

const MsgLabel = styled.span<{ $active: boolean }>`
  font-size: 12px;
  color: ${({ $active }) => $active ? tokens.text.primary : tokens.text.secondary};
  font-weight: ${({ $active }) => $active ? '600' : '400'};
`;

const MsgCount = styled.span<{ $active: boolean }>`
  font-size: 10px;
  font-family: 'SF Mono', monospace;
  color: ${({ $active }) => $active ? tokens.accent.cyan : tokens.text.muted};
  background: ${({ $active }) => $active ? tokens.accent.cyan + '18' : tokens.bg.elevated};
  padding: 1px 6px;
  border-radius: 4px;
`;

const Main = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
`;

const EmptyState = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${tokens.text.muted};
  font-size: 14px;
`;

const Controls = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 10px 16px;
  border-bottom: 1px solid ${tokens.border.subtle};
  background: ${tokens.bg.surface};
  flex-shrink: 0;
`;

const ControlLeft = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
`;

const ControlRight = styled.div`
  flex-shrink: 0;
`;

const SearchBox = styled.input`
  background: ${tokens.bg.elevated};
  border: 1px solid ${tokens.border.default};
  border-radius: ${tokens.radius.md};
  color: ${tokens.text.primary};
  font-size: 13px;
  padding: 6px 12px;
  width: 220px;
  outline: none;
  font-family: inherit;
  transition: border-color 0.2s;
  &::placeholder { color: ${tokens.text.muted}; }
  &:focus { border-color: ${tokens.accent.cyan}; }
`;

const ColToggleRow = styled.div`
  display: flex;
  align-items: center;
  gap: 5px;
  flex-wrap: wrap;
`;

const ToggleLabel = styled.span`
  font-size: 10px;
  color: ${tokens.text.muted};
  white-space: nowrap;
`;

const ColChip = styled.button<{ $active: boolean }>`
  font-size: 10px;
  font-family: 'SF Mono', 'Fira Code', monospace;
  padding: 2px 7px;
  border-radius: 4px;
  border: 1px solid ${({ $active }) => $active ? tokens.accent.cyan + '55' : tokens.border.subtle};
  color: ${({ $active }) => $active ? tokens.accent.cyan : tokens.text.muted};
  background: ${({ $active }) => $active ? tokens.accent.cyan + '10' : 'transparent'};
  transition: all 0.12s;
  white-space: nowrap;
  &:hover { border-color: ${tokens.accent.cyan}; color: ${tokens.accent.cyan}; }
`;

const PageSizeSelect = styled.select`
  background: ${tokens.bg.elevated};
  border: 1px solid ${tokens.border.default};
  border-radius: ${tokens.radius.md};
  color: ${tokens.text.secondary};
  font-size: 12px;
  padding: 6px 10px;
  outline: none;
  cursor: pointer;
`;

const InfoBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 16px;
  font-size: 11px;
  color: ${tokens.text.muted};
  border-bottom: 1px solid ${tokens.border.subtle};
  flex-shrink: 0;
  flex-wrap: wrap;
  gap: 6px;
`;

const InfoText = styled.span`
  strong { color: ${tokens.text.secondary}; }
`;

const TableScroll = styled.div`
  flex: 1;
  overflow: auto;
  -webkit-overflow-scrolling: touch;
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
  font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
`;

const HeaderRow = styled.tr`
  position: sticky;
  top: 0;
  z-index: 5;
  background: ${tokens.bg.elevated};
`;

const RowNumTh = styled.th`
  padding: 8px 10px;
  text-align: right;
  font-size: 9px;
  font-weight: 600;
  color: ${tokens.text.muted};
  border-bottom: 2px solid ${tokens.border.default};
  white-space: nowrap;
  min-width: 44px;
  border-right: 1px solid ${tokens.border.subtle};
`;

const Th = styled.th<{ $sorted: boolean }>`
  padding: 8px 12px;
  text-align: left;
  border-bottom: 2px solid ${({ $sorted }) => $sorted ? tokens.accent.cyan : tokens.border.default};
  cursor: pointer;
  white-space: nowrap;
  user-select: none;
  background: ${({ $sorted }) => $sorted ? tokens.accent.cyan + '08' : 'transparent'};
  transition: background 0.15s;
  &:hover { background: ${tokens.bg.overlay}; }
`;

const ThInner = styled.div`
  display: flex;
  align-items: baseline;
  gap: 4px;
`;

const ThName = styled.span`
  font-size: 10px;
  font-weight: 700;
  color: ${tokens.text.secondary};
  letter-spacing: 0.04em;
`;

const ThUnit = styled.span`
  font-size: 9px;
  color: ${tokens.text.muted};
`;

const SortIcon = styled.span<{ $active: boolean }>`
  font-size: 9px;
  color: ${({ $active }) => $active ? tokens.accent.cyan : tokens.text.muted};
  margin-left: 2px;
`;

const DataRow = styled.tr<{ $even: boolean }>`
  background: ${({ $even }) => $even ? tokens.bg.base : tokens.bg.surface + '60'};
  border-bottom: 1px solid ${tokens.border.subtle}44;
  &:hover { background: ${tokens.bg.elevated}; }
`;

const RowNum = styled.td`
  padding: 6px 10px;
  text-align: right;
  font-size: 10px;
  color: ${tokens.text.muted};
  border-right: 1px solid ${tokens.border.subtle};
  user-select: none;
`;

const Td = styled.td<{ $align: 'left' | 'right' }>`
  padding: 6px 12px;
  text-align: ${({ $align }) => $align};
  color: ${tokens.text.primary};
  white-space: nowrap;
  max-width: 360px;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const NullVal = styled.span`
  color: ${tokens.text.muted};
  opacity: 0.4;
  font-style: italic;
`;

const CellPair = styled.div`
  display: flex;
  align-items: baseline;
  gap: 6px;
  justify-content: flex-end;
`;

const CellMain = styled.span`
  color: ${tokens.chart.depth};
  font-weight: 600;
`;

const CellSub = styled.span`
  font-size: 10px;
  color: ${tokens.text.muted};
`;

const TimestampVal = styled.span`
  color: ${tokens.text.secondary};
  letter-spacing: 0.02em;
`;

const ObjVal = styled.span`
  font-size: 11px;
  color: ${tokens.text.muted};
`;

const PagRow = styled.div`
  display: flex;
  align-items: center;
  gap: 3px;
`;

const PageBtn = styled.button<{ disabled?: boolean }>`
  width: 26px; height: 26px;
  border-radius: 5px; font-size: 12px;
  border: 1px solid ${({ disabled }) => disabled ? tokens.border.subtle : tokens.border.default};
  background: ${tokens.bg.elevated};
  color: ${({ disabled }) => disabled ? tokens.text.muted : tokens.text.secondary};
  cursor: ${({ disabled }) => disabled ? 'not-allowed' : 'pointer'};
  opacity: ${({ disabled }) => disabled ? 0.4 : 1};
  transition: all 0.15s;
  &:hover:not(:disabled) { border-color: ${tokens.accent.cyan}; color: ${tokens.accent.cyan}; }
`;

const PageInfo = styled.span`
  font-size: 11px;
  color: ${tokens.text.muted};
  padding: 0 6px;
  min-width: 50px;
  text-align: center;
`;

const BottomPagination = styled.div`
  padding: 8px 16px;
  display: flex;
  justify-content: flex-end;
  border-top: 1px solid ${tokens.border.subtle};
  flex-shrink: 0;
`;