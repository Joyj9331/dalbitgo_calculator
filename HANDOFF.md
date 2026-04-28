# 핸드오프 가이드 (Claude Code ↔ Gemini)

> 새 AI에게 작업을 넘길 때 **이 파일과 WORKLOG.md를 먼저 읽도록** 지시할 것.
> 사용자에게: "HANDOFF.md 읽고 시작해" 한 줄이면 충분.

---

## 1. 시작 전 필수 학습 순서

1. **`HANDOFF.md`** (이 파일) — 작업 규칙 전반
2. **`WORKLOG.md`** — 가장 최근 작업 내역과 미완 작업
3. **`CLAUDE.md`** — 프로젝트 규칙, 배포 절차, 절대 금지 파일
4. **`src/firebase.ts`** — 듀얼 DB 구조 (db / reviewDb / salesDb)
5. **`src/types.ts`** — 핵심 타입 (FranchiseSchedule, WorkItem, DepartmentTask 등)
6. **`package.json`** — Firebase는 11.6.0 고정 (12.x 금지)

---

## 2. 코드베이스 구조 한눈에

| 영역 | 파일 |
|------|------|
| 라우팅·사이드바·홈 | `src/App.tsx` (1644줄, 분리 예정) |
| 가맹점 관제 | `src/components/franchise/` |
| 리뷰 관제 (활성) | `src/components/ReviewDashboard.tsx` |
| 리뷰 관제 (신규, 미사용) | `src/components/review/` |
| 관리자 도구 | `src/components/AdminPanel.tsx`, `src/components/admin/` |
| 원가/메뉴 로직 | `src/utils.ts` |
| 알림 | `src/components/Toast.tsx`, `src/components/ConfirmModal.tsx` |
| 에러 캐치 | `src/components/ErrorBoundary.tsx` |

---

## 3. 디자인 시스템 (꼭 따를 것)

- **폰트**: 조선일보명조체 (`*` 셀렉터에 `font-weight: 700 !important` 강제)
- **컬러**: stone 계열 메인, `#FDFBF7` 크림 배경
- **시그니처 테두리**: `border-b-[3px] border-double border-stone-800`
- **다크모드 필수**: 모든 클래스에 `dark:` 짝 (예: `bg-white dark:bg-stone-900`)
- **알림**: `alert()`/`confirm()` 절대 금지 → `useToast()`, `useConfirm()` 사용
- **버튼 둥글기**: 기본 `rounded-sm` 또는 없음 (큰 `rounded-xl`은 알림 박스 정도만)

---

## 4. Firestore 작업 시 절대 규칙

- **onSnapshot 남발 금지**. 변경 빈도 낮은 데이터(departments, system_settings, process_settings)는 `getDoc`/`getDocs`
- **onSnapshot 콜백 안에서 updateDoc/setDoc 절대 금지** — b815 assertion 유발
- **setDoc은 덮어쓰기**. 부분 업데이트는 항상 `updateDoc`
- **마이그레이션 로직 작성 시** 사용자 승인 먼저 받기 (자동 실행되면 600개 매장 한 번에 망가짐)
- **deleteDoc, deleteField, batch 일괄 작업** 전에는 반드시 사용자에게 백업 확인

---

## 5. 작업 시 행동 규칙

### 해야 할 것
- 코드 변경 전 관련 파일 먼저 읽고 영향 범위 보고
- 변경 후 `npm run build` 통과 확인 (오류 시 즉시 수정)
- 작업 종료 시 **반드시 WORKLOG.md 업데이트** (양식은 WORKLOG.md 상단 참고)

### 절대 하지 말 것
- `git add .` / `git add -A` (CLAUDE.md 명시 금지 파일이 딸려 올라감)
- `git push` 자동 실행 (사용자가 직접 push)
- 중복 파일 재생성 (`src/AdminPanel.tsx`, `src/ScheduleFormModal.tsx` 등)
- Firebase 12.x 업그레이드
- 데이터 마이그레이션 자동 실행

---

## 6. 작업별 추가 참고 파일

| 작업 영역 | 추가 읽기 |
|----------|----------|
| 캘린더·체크리스트 | `franchise/FranchiseScheduleView.tsx`, `ScheduleCalendar.tsx`, `OpenChecklistView.tsx`, `ProcessMasterModal.tsx` |
| D-Day 계산 로직 | `OpenChecklistView.tsx`의 `computeWorkItemDates` |
| 원가 계산 | `src/utils.ts`의 `calculateTotalCost` (재귀, 순환참조 방지 포함) |
| 리뷰 관제 | `components/ReviewDashboard.tsx` (활성) |
| 관리자 도구 | `components/admin/*.tsx` |

---

## 7. 작업 종료 체크리스트

- [ ] `npm run build` 통과 확인
- [ ] `WORKLOG.md` 업데이트 (완료/미완/주의사항)
- [ ] 중요한 변경이면 사용자에게 git commit 메시지 초안 제안
- [ ] 데이터 영향 가능성 있는 작업은 사용자에게 백업 권유
