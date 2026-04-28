# 작업 로그

> **양식 규칙**: 새 작업은 **맨 위에 추가**. 한 항목은 5줄 이내로 짧게. 10개 넘으면 오래된 것부터 정리.
> 작업 종료 시 반드시 업데이트. 양 AI 모두 시작 전에 이 파일을 읽음.

---

## 양식 (복붙용)

```
## YYYY-MM-DD HH시 — Claude Code | Gemini

### 완료
- 한 줄 요약
- 한 줄 요약

### 미완 / 진행 중
- (없으면 "없음")

### 다음에 이어할 것
- 구체적 작업 (파일 경로 포함)

### 주의 / 메모
- (선택, 다음 사람이 모르면 사고날 만한 것만)
```

---

## 2026-04-28 저녁 — Claude Code

### 완료
- 중복 파일 3개 삭제 (`src/AdminPanel.tsx`, `src/ScheduleFormModal.tsx`, `src/components/franchise/types.ts`)
- `.gitignore` 강화 + Firebase 버전 `^11.6.0` → `11.6.0` 고정
- `src/components/ErrorBoundary.tsx` 추가 + main.tsx 최상위에 적용
- onSnapshot → getDoc/getDocs 4곳 전환 (`OpenChecklistView`, `FranchiseScheduleView` 2개, `ScheduleFormModal`, `StoreRegistrationModal`)
- `FranchiseScheduleView`의 `process_settings` 마이그레이션 로직: onSnapshot → getDoc (b815 assertion 원인 제거)
- `HANDOFF.md`, `WORKLOG.md` 신규 작성

### 미완 / 진행 중
- 없음

### 다음에 이어할 것
- `src/App.tsx` 분리 (1644줄 → 라우터/사이드바/홈을 별도 파일로)
- `src/components/review/` 폴더 처리 결정 (현재 미사용, 옛 `ReviewDashboard.tsx`가 활성 중)
- slate → stone 색상 통일 (AdminPanel, Auth, 일부 모달)
- 라우트별 lazy import (번들 2.1MB 분할)

### 주의 / 메모
- Firebase b815 assertion은 SDK 12.x + 듀얼 Firestore 인스턴스 환경 버그. 11.6.0 고정 유지 필수
- `src/components/ReviewDashboard.tsx` (1400줄, 옛 버전)이 App.tsx에서 사용 중. `src/components/review/` 폴더(신규)는 미연결 상태
- Task 매칭이 `title` 문자열 기반이라 fragile — 데이터 마이그레이션 없이 건드리면 깨짐
- 사용자가 오늘 오전 일정 등록 작업을 마쳤음. 데이터 영향 작업은 매우 신중히
