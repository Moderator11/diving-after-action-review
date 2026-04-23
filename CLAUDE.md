## Approach
- Think before acting. Read existing files before writing code.
- Be concise in output but thorough in reasoning.
- Prefer editing over rewriting whole files.
- Do not re-read files you have already read unless the file may have changed.
- Skip files over 100KB unless explicitly required.
- Suggest running /cost when a session is running long to monitor cache ratio.
- Recommend starting a new session when switching to an unrelated task.
- Test your code before declaring done.
- No sycophantic openers or closing fluff.
- Keep solutions simple and direct.
- User instructions always override this file.

---

## Project: DAAR (Diving After Action Review)

프리다이버 PADI 마스터 과제용 웹앱. Garmin 등 다이빙 컴퓨터의 `.fit` 파일을 브라우저에서 파싱하여 다이브 데이터를 시각화한다. 서버 없음, 모든 처리는 클라이언트에서.

### Stack
- **React 19 + TypeScript + Vite** (빌드)
- **styled-components v6** — 모든 스타일링. CSS-in-JS, `tokens` 객체로 디자인 토큰 관리
- **react-router-dom v7** — SPA 라우팅
- **recharts** — 다이브 프로파일 차트
- **@garmin/fitsdk** — `.fit` 파일 파싱 (CJS, `@ts-ignore` 필요)
- **Docker + nginx** — 프로덕션 배포

### Design Tokens (`src/styles/GlobalStyle.ts`)
`tokens` 객체를 항상 사용. 하드코딩된 색상/radius 금지.
- `tokens.bg.{base|surface|elevated|overlay}`
- `tokens.text.{primary|secondary|muted|accent}`
- `tokens.accent.{blue|cyan|teal|indigo|danger}`
- `tokens.border.{subtle|default|accent}`
- `tokens.radius.{sm|md|lg|xl}`
- `tokens.chart.{depth|hr|grid}`

### Routes
| Path | Component | 역할 |
|------|-----------|------|
| `/` | `HomePage` | `.fit` 파일 드롭/선택 |
| `/session` | `SessionPage` | 세션 요약, 메트릭, 전체 프로파일 차트, 다이브 테이블 |
| `/dive/:id` | `DivePage` | 개별 다이브 상세 (0-based index) |
| `/compare` | `ComparePage` | 다이브 간 비교 |
| `/raw` | `RawDataPage` | 원본 FIT 메시지 테이블 |

### Global State
`DiveContext` (`src/store/DiveContext.tsx`) — `session: DiveSession | null` 단일 상태.  
`useDiveSession()` hook으로 접근. `session` 없으면 `/`로 redirect.

### Core Types (`src/types/dive.ts`)
```
DiveSession         { filename, stats, records, laps, dives, events, allMessages }
DetectedDive        { index, records, startTime, durationSeconds, maxDepthM, avgDepthM,
                      bottomTimeSeconds, maxDescentRateMps, avgDescentRateMps,
                      maxAscentRateMps, avgAscentRateMps, maxHR, avgHR, avgTempC }
DiveRecord          { elapsedSeconds, depthM, heartRate, temperatureC, timestamp }
DiveLap             { index, startTime, durationSeconds, maxDepthM, avgDepthM, calories,
                      maxHR, avgHR, isDive }
SessionStats        { maxDepthM, totalDives, longestDiveSeconds, maxHR, totalCalories,
                      avgWaterTempC, sessionDate, totalDurationSeconds }
DiveEvent           { timestamp, elapsedSeconds, event, eventType, data, label, severity,
                      isDiveAlert }
FitMessageGroup     { key, label, count, columns, rows }
```

### Key Logic
**`src/utils/parseFit.ts`**
- `parseFitFile(buffer, filename)` — 메인 파서. 2-pass decode: pass1(named fields), pass2(unknown messages 포함).
- FIT epoch offset: `631065600`초 (FIT epoch = 1989-12-31 UTC). `toDate(v)` 함수로 변환.
- Dive detection: `DIVE_ONSET_M = 2.0m` 이상이면 다이브 시작, `SURFACE_M = 0.5m` 이하면 종료.
- `formatDuration(seconds)` → `"M:SS"`, `formatDate(date)` → 한국어 날짜

**`src/utils/spikes.ts`**
- `computeSpikes(dive, topN=5)` — HR 변화, 급하강/급상승 스파이크 감지. 차트 오버레이용.

### Components
| 파일 | 역할 |
|------|------|
| `MetricCard` | 아이콘+값+단위 카드. `accent` prop: `cyan|blue|teal|indigo|danger` |
| `DiveProfileChart` | recharts 기반 전체 세션 수심/심박 라인차트 |
| `DiveTable` | 다이브 목록 테이블, 행 클릭 → `/dive/:id` |
| `VideoOverlay` | 비디오 위 오버레이 (DivePage에서 사용 추정) |

### 작업 시 주의사항
- styled-components prop은 `$` prefix 사용 (`$active`, `$state`, `$expanded` 등). Transient props.
- FIT SDK: `@garmin/fitsdk`는 CJS 모듈, `@ts-ignore`로 import. `vite-plugin-node-polyfills` 필요.
- 한국어 UI: 모든 사용자 노출 텍스트는 한국어.
- `node_modules` 읽지 말 것.
- `dist/` 빌드 산출물, 수동 편집 금지.

### 빌드 / 실행
```bash
npm run dev      # 개발 서버
npm run build    # TypeScript 검사 + Vite 빌드
npm run lint     # ESLint
docker-compose up --build  # 프로덕션
```