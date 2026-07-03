// R&D 관리대장 — 소스·반찬 제조실 연구개발 통합 관리
// 구조: 관리대장(품목 클릭 → 상세: 공정 체크시트 상시 노출 + 일일기록 타임라인)
//       주간보고 = 일일기록에서 자동 생성(보완 코멘트만 입력), 월별계획 = 주차별 실제 기록 수 연동
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { salesDb } from '../firebase';
import {
  collection, getDocs, doc, setDoc, updateDoc, deleteDoc,
  query, orderBy,
} from 'firebase/firestore';
import {
  RndItem, RndDailyLog, RndWeeklyReport, RndMonthlyPlan,
  RndCategory, RndPriority, RndStatus, RndProductType, User,
} from '../types';
import { useToast } from './Toast';
import { useConfirm } from './ConfirmModal';
import { shareKakao } from '../utils/kakao';
import {
  Plus, X, Edit2, Trash2, ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
  Printer, MessageCircle, FlaskConical, ClipboardList,
  CalendarDays, CalendarRange, NotebookPen, Factory, CheckSquare, ArrowLeft,
} from 'lucide-react';

// ── 기준정보: 실제 R&D 8단계 공정 (2026-07 제조실 공정 기준) ──
const RND_STAGES = [
  { stage: 1, short: '표준레시피', label: '표준레시피 작성', pct: 10,
    subs: ['표준레시피 작성 (유/무)'] },
  { stage: 2, short: '시범 생산', label: '시범 생산 및 상품 가치 파악', pct: 25,
    subs: ['맛 확인', '관능평가', '출시가능성 확인', '식재료 공급 가능성 유무 (물류)'] },
  { stage: 3, short: '원가 검토', label: '원가 검토', pct: 40,
    subs: ['제조원가 산출', '공급가 산출'] },
  { stage: 4, short: '대량생산 검증', label: '제조 공정 및 대량 생산 검증', pct: 55,
    subs: ['맛 편차 확인', '대량 생산성 검증', '유통기한 확인'] },
  { stage: 5, short: '포장 개발', label: '포장 개발', pct: 70,
    subs: ['용기 선정 (실링·진공포장지)', '라벨 제작', '포장성 검토', '보관 방법'] },
  { stage: 6, short: '매장 테스트', label: '매장 공급 테스트', pct: 85,
    subs: ['매장 피드백 (선정)', '보관 장소 파악 (물류)'] },
  { stage: 7, short: '문제점·개선', label: '문제점 및 개선사항', pct: 92,
    subs: ['테스트 결과 정리', '개선 계획 수립'] },
  { stage: 8, short: '출시 준비', label: '차주 계획 일정 (출시 준비)', pct: 100,
    subs: ['식품제조보고', '매장 전달 (FC다움)', '출시 준비 일정 수립'] },
];
const CATEGORIES: RndCategory[] = ['소스', '반찬', '양념/베이스', '기타'];
const PRIORITIES: RndPriority[] = ['상', '중', '하'];
const STATUSES: RndStatus[] = ['진행중', '보류', '완료', '중단'];
const PRODUCT_TYPES: RndProductType[] = ['제조품', '일반상품'];
// 구버전 데이터(productType 미지정)는 제조품 취급
const productTypeOf = (item: RndItem): RndProductType => item.productType ?? '제조품';

const stagePct = (stage: number) => RND_STAGES.find(s => s.stage === stage)?.pct ?? 0;
const stageLabel = (stage: number) => {
  const s = RND_STAGES.find(x => x.stage === stage);
  return s ? `${s.stage}. ${s.short}` : '-';
};

// ── 공정 체크시트 (품목별 항목 편집 가능) ───────────────────
type ChecklistEntry = { stage: number; text: string; done: boolean };
// checklist 없으면 공통 템플릿 + 구버전 stageChecks에서 마이그레이션
const buildChecklist = (item: RndItem): ChecklistEntry[] =>
  (item.checklist && item.checklist.length > 0)
    ? item.checklist
    : RND_STAGES.flatMap(s => s.subs.map((text, i) => ({
        stage: s.stage, text, done: !!item.stageChecks?.[`${s.stage}-${i}`],
      })));

// 현재 단계의 체크 진행 (완료 수 / 전체 수)
const stageCheckProgress = (item: RndItem): { done: number; total: number } => {
  const entries = buildChecklist(item).filter(e => e.stage === item.stage);
  return { done: entries.filter(e => e.done).length, total: entries.length };
};

const STATUS_BADGE: Record<RndStatus, string> = {
  '진행중': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  '보류':   'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  '완료':   'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  '중단':   'bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400',
};
const PRIORITY_BADGE: Record<RndPriority, string> = {
  '상': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  '중': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  '하': 'bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400',
};
const PRODUCT_TYPE_BADGE: Record<RndProductType, string> = {
  '제조품':   'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  '일반상품': 'bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400',
};

// ── 유틸 ──────────────────────────────────────────────────
const toYMD = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const todayYMD = () => toYMD(new Date());
const ts = () => new Date().toISOString();
const genId = (p: string) => `${p}_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
// Firestore는 undefined 값을 거부 — 저장 전 제거
const scrub = (o: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

const fmtDateShort = (ymd: string) => {
  const d = new Date(ymd + 'T00:00:00');
  return `${d.getMonth() + 1}/${d.getDate()}`;
};

const dday = (target?: string): number | null => {
  if (!target) return null;
  return Math.round(
    (new Date(target + 'T00:00:00').getTime() - new Date(todayYMD() + 'T00:00:00').getTime()) / 86400000
  );
};
const fmtDday = (n: number) => (n === 0 ? 'D-Day' : n > 0 ? `D-${n}` : `D+${-n}`);

// 해당 날짜가 속한 주의 월요일
const mondayOf = (d: Date) => {
  const x = new Date(d);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
};
const addDays = (ymd: string, n: number) => {
  const d = new Date(ymd + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return toYMD(d);
};
// 월 내 주차 (1~5): 일자 기준 7일 단위
const weekOfMonth = (ymd: string) => Math.min(5, Math.ceil(Number(ymd.slice(8, 10)) / 7));

const inputCls = 'w-full px-3 py-2 text-sm border border-stone-200 dark:border-stone-600 rounded-sm bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-stone-400';
const labelCls = 'block text-[11px] font-bold text-stone-500 mb-1';

// ── 공용 모달 셸 ───────────────────────────────────────────
function ModalShell({ title, onClose, children, footer, wide }: {
  title: string; onClose: () => void; children: React.ReactNode; footer: React.ReactNode; wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 print:hidden">
      <div className={`bg-white dark:bg-stone-900 rounded-sm shadow-2xl w-full ${wide ? 'max-w-lg' : 'max-w-sm'} border border-stone-200 dark:border-stone-700 flex flex-col max-h-[90vh]`}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b-[3px] border-double border-stone-800 dark:border-stone-400 shrink-0">
          <h2 className="text-sm font-black text-stone-900 dark:text-white">{title}</h2>
          <button onClick={onClose} className="p-1 text-stone-400 hover:text-stone-700 rounded-sm"><X size={16} /></button>
        </div>
        <div className="p-5 space-y-3.5 overflow-y-auto flex-1">{children}</div>
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-stone-200 dark:border-stone-700 shrink-0">{footer}</div>
      </div>
    </div>
  );
}

function FooterButtons({ onClose, onSave, disabled, saveLabel }: {
  onClose: () => void; onSave: () => void; disabled: boolean; saveLabel: string;
}) {
  return (
    <>
      <button onClick={onClose} className="px-4 py-2 text-xs text-stone-600 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-sm">취소</button>
      <button onClick={onSave} disabled={disabled}
        className="px-4 py-2 text-xs font-bold bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 rounded-sm hover:bg-stone-700 disabled:opacity-40 transition-colors">
        {saveLabel}
      </button>
    </>
  );
}

// ── 품목 등록/수정 모달 ────────────────────────────────────
type RndItemDraft = Omit<RndItem, 'id' | 'order' | 'createdAt' | 'updatedAt'>;
function ItemFormModal({ item, onSave, onClose }: {
  item?: RndItem; onSave: (data: RndItemDraft) => void; onClose: () => void;
}) {
  const [name, setName] = useState(item?.name ?? '');
  const [productType, setProductType] = useState<RndProductType>(item ? productTypeOf(item) : '제조품');
  const [category, setCategory] = useState<RndCategory>(item?.category ?? '소스');
  const [assignee, setAssignee] = useState(item?.assignee ?? '');
  const [priority, setPriority] = useState<RndPriority>(item?.priority ?? '중');
  const [startDate, setStartDate] = useState(item?.startDate ?? todayYMD());
  const [targetDate, setTargetDate] = useState(item?.targetDate ?? '');
  const [stage, setStage] = useState(item?.stage ?? 1);
  const [status, setStatus] = useState<RndStatus>(item?.status ?? '진행중');
  const [thisWeekNote, setThisWeekNote] = useState(item?.thisWeekNote ?? '');
  const [nextAction, setNextAction] = useState(item?.nextAction ?? '');
  const [note, setNote] = useState(item?.note ?? '');

  const save = () => name.trim() && onSave({
    name: name.trim(), productType, category, assignee: assignee.trim() || undefined, priority,
    startDate: startDate || undefined, targetDate: targetDate || undefined,
    stage, status,
    thisWeekNote: thisWeekNote.trim() || undefined,
    nextAction: nextAction.trim() || undefined,
    note: note.trim() || undefined,
  });

  return (
    <ModalShell title={item ? '품목 수정' : 'R&D 품목 등록'} onClose={onClose} wide
      footer={<FooterButtons onClose={onClose} onSave={save} disabled={!name.trim()} saveLabel={item ? '저장' : '등록'} />}>
      <div>
        <label className={labelCls}>품목명 *</label>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="예: 고등어 데리야끼 소스" autoFocus className={inputCls} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>구분 <span className="text-stone-400 font-normal">— 제조품은 완료 시 제조실 이관</span></label>
          <select value={productType} onChange={e => setProductType(e.target.value as RndProductType)} className={inputCls}>
            {PRODUCT_TYPES.map(t => <option key={t} value={t}>{t === '제조품' ? '제조품 (제조실 직접 제조)' : '일반상품 (업체 직거래 납품)'}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>카테고리</label>
          <select value={category} onChange={e => setCategory(e.target.value as RndCategory)} className={inputCls}>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>담당자</label>
          <input value={assignee} onChange={e => setAssignee(e.target.value)} placeholder="이름" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>우선순위</label>
          <select value={priority} onChange={e => setPriority(e.target.value as RndPriority)} className={inputCls}>
            {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>시작일</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>목표 완료일 <span className="text-stone-400 font-normal">— D-Day 자동</span></label>
          <input type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)} className={inputCls} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>현재 단계 <span className="text-stone-400 font-normal">— 진행률 자동</span></label>
          <select value={stage} onChange={e => setStage(Number(e.target.value))} className={inputCls}>
            {RND_STAGES.map(s => <option key={s.stage} value={s.stage}>{s.stage}. {s.short} ({s.pct}%)</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>상태</label>
          <select value={status} onChange={e => setStatus(e.target.value as RndStatus)} className={inputCls}>
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className={labelCls}>금주 진행 내용</label>
        <textarea value={thisWeekNote} onChange={e => setThisWeekNote(e.target.value)} rows={2} className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>다음 액션</label>
        <input value={nextAction} onChange={e => setNextAction(e.target.value)} className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>비고</label>
        <input value={note} onChange={e => setNote(e.target.value)} className={inputCls} />
      </div>
    </ModalShell>
  );
}

// ── 일일 기록 모달 (수정 및 일일 탭 신규 작성용) ─────────────
type RndDailyDraft = Omit<RndDailyLog, 'id' | 'author' | 'createdAt' | 'updatedAt'>;
function DailyLogModal({ log, items, onSave, onClose }: {
  log?: RndDailyLog; items: RndItem[]; onSave: (data: RndDailyDraft) => void; onClose: () => void;
}) {
  const [date, setDate] = useState(log?.date ?? todayYMD());
  const [itemId, setItemId] = useState(log?.itemId ?? (items[0]?.id ?? ''));
  const [workContent, setWorkContent] = useState(log?.workContent ?? '');
  const [resultIssue, setResultIssue] = useState(log?.resultIssue ?? '');
  const [nextPlan, setNextPlan] = useState(log?.nextPlan ?? '');

  const valid = !!itemId && !!workContent.trim();
  const save = () => valid && onSave({
    date, itemId, workContent: workContent.trim(),
    resultIssue: resultIssue.trim() || undefined,
    nextPlan: nextPlan.trim() || undefined,
  });

  return (
    <ModalShell title={log ? '일일 기록 수정' : '일일 기록 추가'} onClose={onClose} wide
      footer={<FooterButtons onClose={onClose} onSave={save} disabled={!valid} saveLabel="저장" />}>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>날짜</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>품목 *</label>
          <select value={itemId} onChange={e => setItemId(e.target.value)} className={inputCls}>
            {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className={labelCls}>금일 작업 내용 *</label>
        <textarea value={workContent} onChange={e => setWorkContent(e.target.value)} rows={3} autoFocus className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>결과 / 이슈</label>
        <textarea value={resultIssue} onChange={e => setResultIssue(e.target.value)} rows={2} className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>익일 계획</label>
        <input value={nextPlan} onChange={e => setNextPlan(e.target.value)} className={inputCls} />
      </div>
    </ModalShell>
  );
}

// ── 월별 계획 모달 ─────────────────────────────────────────
type RndMonthlyDraft = Omit<RndMonthlyPlan, 'id' | 'order' | 'createdAt' | 'updatedAt'>;
function MonthlyModal({ plan, month, items, onSave, onClose }: {
  plan?: RndMonthlyPlan; month: string; items: RndItem[]; onSave: (data: RndMonthlyDraft) => void; onClose: () => void;
}) {
  const [title, setTitle] = useState(plan?.title ?? '');
  const [assignee, setAssignee] = useState(plan?.assignee ?? '');
  const [monthGoal, setMonthGoal] = useState(plan?.monthGoal ?? '');
  const [weekPlans, setWeekPlans] = useState<string[]>(() => {
    const w = plan?.weekPlans ?? [];
    return [0, 1, 2, 3, 4].map(i => w[i] ?? '');
  });
  const [targetDate, setTargetDate] = useState(plan?.targetDate ?? '');
  const [note, setNote] = useState(plan?.note ?? '');

  const save = () => title.trim() && onSave({
    month: plan?.month ?? month,
    title: title.trim(),
    assignee: assignee.trim() || undefined,
    monthGoal: monthGoal.trim() || undefined,
    weekPlans: weekPlans.map(w => w.trim()),
    targetDate: targetDate || undefined,
    note: note.trim() || undefined,
  });

  return (
    <ModalShell title={plan ? '월별 계획 수정' : `${month} 월별 계획 추가`} onClose={onClose} wide
      footer={<FooterButtons onClose={onClose} onSave={save} disabled={!title.trim()} saveLabel="저장" />}>
      <div>
        <label className={labelCls}>품목 / 과제 * <span className="text-stone-400 font-normal">— 관리대장 품목명과 같으면 주차별 실적 자동 연동</span></label>
        <input value={title} onChange={e => setTitle(e.target.value)} list="rnd-item-names" autoFocus className={inputCls} />
        <datalist id="rnd-item-names">
          {items.map(i => <option key={i.id} value={i.name} />)}
        </datalist>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>담당자</label>
          <input value={assignee} onChange={e => setAssignee(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>목표 완료일</label>
          <input type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)} className={inputCls} />
        </div>
      </div>
      <div>
        <label className={labelCls}>월 목표</label>
        <textarea value={monthGoal} onChange={e => setMonthGoal(e.target.value)} rows={2} className={inputCls} />
      </div>
      {weekPlans.map((w, i) => (
        <div key={i}>
          <label className={labelCls}>W{i + 1} 계획</label>
          <input value={w} onChange={e => setWeekPlans(p => p.map((v, idx) => idx === i ? e.target.value : v))} className={inputCls} />
        </div>
      ))}
      <div>
        <label className={labelCls}>비고</label>
        <input value={note} onChange={e => setNote(e.target.value)} className={inputCls} />
      </div>
    </ModalShell>
  );
}

// ── 제조실 이관 모달 (제조품 + 완료 품목 전용) ──────────────
function SendToFactoryModal({ item, onSave, onClose }: {
  item: RndItem;
  onSave: (data: { unit: string; safetyDays: number; estimatedMonthlyUsage?: number }) => void;
  onClose: () => void;
}) {
  const [unit, setUnit] = useState('kg');
  const [safetyDays, setSafetyDays] = useState(10);
  const [estimatedMonthlyUsage, setEstimatedMonthlyUsage] = useState('');

  return (
    <ModalShell title="제조실 품목으로 등록" onClose={onClose}
      footer={<FooterButtons onClose={onClose}
        onSave={() => onSave({ unit, safetyDays, estimatedMonthlyUsage: estimatedMonthlyUsage ? Number(estimatedMonthlyUsage) : undefined })}
        disabled={false} saveLabel="제조실 등록" />}>
      <p className="text-xs text-stone-500 dark:text-stone-400">
        <span className="font-bold text-stone-900 dark:text-white">"{item.name}"</span> 을(를) 제조실 재고·생산 관리 품목으로 등록합니다.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>단위 *</label>
          <select value={unit} onChange={e => setUnit(e.target.value)} className={inputCls}>
            {['kg', 'L', '개', '봉', '통'].map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>안전재고 일수</label>
          <input type="number" min="1" max="30" value={safetyDays} onChange={e => setSafetyDays(Number(e.target.value))} className={inputCls} />
        </div>
      </div>
      <div>
        <label className={labelCls}>월 예상 소비량 ({unit}) <span className="text-stone-400 font-normal">— 실적 없을 때 기준값</span></label>
        <input type="number" min="0" value={estimatedMonthlyUsage}
          onChange={e => setEstimatedMonthlyUsage(e.target.value)} placeholder="예: 300" className={inputCls} />
      </div>
    </ModalShell>
  );
}

// ── 체크시트 항목 추가 입력 (편집 모드) ─────────────────────
function StageAddInput({ onAdd }: { onAdd: (text: string) => void }) {
  const [v, setV] = useState('');
  const submit = () => { if (v.trim()) { onAdd(v.trim()); setV(''); } };
  return (
    <div className="flex items-center gap-1 mt-1">
      <input value={v} onChange={e => setV(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') submit(); }}
        placeholder="항목 추가 후 Enter"
        className="flex-1 px-2 py-1 text-[11px] border border-dashed border-stone-300 dark:border-stone-600 rounded-sm bg-transparent text-stone-700 dark:text-stone-300 focus:outline-none focus:border-stone-500" />
      <button onClick={submit} className="p-1 text-stone-400 hover:text-stone-700"><Plus size={11} /></button>
    </div>
  );
}

// ── 상세 화면 일일기록 빠른 입력 ────────────────────────────
function QuickLogForm({ onAdd }: {
  onAdd: (d: { date: string; workContent: string; resultIssue?: string; nextPlan?: string }) => void;
}) {
  const [date, setDate] = useState(todayYMD());
  const [workContent, setWorkContent] = useState('');
  const [resultIssue, setResultIssue] = useState('');
  const [nextPlan, setNextPlan] = useState('');
  const [expanded, setExpanded] = useState(false);

  const submit = () => {
    if (!workContent.trim()) return;
    onAdd({
      date, workContent: workContent.trim(),
      resultIssue: resultIssue.trim() || undefined,
      nextPlan: nextPlan.trim() || undefined,
    });
    setWorkContent(''); setResultIssue(''); setNextPlan(''); setExpanded(false);
  };

  const smallInput = 'w-full px-2 py-1.5 text-xs border border-stone-200 dark:border-stone-600 rounded-sm bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-stone-400';

  return (
    <div className="p-3 border border-stone-200 dark:border-stone-700 rounded-sm bg-stone-50 dark:bg-stone-800/40 space-y-1.5">
      <div className="flex items-center gap-2">
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          className="text-[11px] border border-stone-200 dark:border-stone-600 rounded-sm px-1.5 py-1 bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200 focus:outline-none" />
        <span className="text-[10px] text-stone-400">오늘 작업을 바로 기록하세요</span>
      </div>
      <textarea value={workContent} onChange={e => setWorkContent(e.target.value)}
        onFocus={() => setExpanded(true)}
        onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submit(); }}
        placeholder="금일 작업 내용 (Ctrl+Enter 저장)" rows={expanded ? 2 : 1} className={smallInput} />
      {expanded && (
        <>
          <input value={resultIssue} onChange={e => setResultIssue(e.target.value)} placeholder="결과 / 이슈 (선택)" className={smallInput} />
          <div className="flex items-center gap-1.5">
            <input value={nextPlan} onChange={e => setNextPlan(e.target.value)} placeholder="익일 계획 (선택)" className={smallInput} />
            <button onClick={submit} disabled={!workContent.trim()}
              className="shrink-0 px-3 py-1.5 text-xs font-bold bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 rounded-sm hover:bg-stone-700 disabled:opacity-40">
              기록
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ── 주간 보완 코멘트 인라인 입력 (blur 시 자동 저장) ─────────
function WeeklyExtraInput({ label, value, onSave }: {
  label: string; value: string; onSave: (v: string) => void;
}) {
  const [v, setV] = useState(value);
  useEffect(() => { setV(value); }, [value]);
  return (
    <div className="flex-1 min-w-[140px]">
      <label className="block text-[10px] font-bold text-stone-400 mb-0.5">{label}</label>
      <textarea value={v} onChange={e => setV(e.target.value)}
        onBlur={() => { if (v.trim() !== value.trim()) onSave(v); }}
        rows={1} placeholder="입력하면 자동 저장"
        className="w-full px-2 py-1 text-[11px] border border-stone-200 dark:border-stone-600 rounded-sm bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 focus:outline-none focus:ring-1 focus:ring-stone-400 resize-y" />
    </div>
  );
}

// ── 메인 RndView ───────────────────────────────────────────
type RndTab = 'board' | 'daily' | 'weekly' | 'monthly';

export function RndView({ currentUser }: { currentUser: User }) {
  const toast = useToast();
  const { confirm } = useConfirm();

  const [items, setItems] = useState<RndItem[]>([]);
  const [dailyLogs, setDailyLogs] = useState<RndDailyLog[]>([]);
  const [weeklyReports, setWeeklyReports] = useState<RndWeeklyReport[]>([]);
  const [monthlyPlans, setMonthlyPlans] = useState<RndMonthlyPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<RndTab>('board');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  const [showItemForm, setShowItemForm] = useState(false);
  const [editingItem, setEditingItem] = useState<RndItem | null>(null);
  const [showDailyForm, setShowDailyForm] = useState(false);
  const [editingDaily, setEditingDaily] = useState<RndDailyLog | null>(null);
  const [showMonthlyForm, setShowMonthlyForm] = useState(false);
  const [editingMonthly, setEditingMonthly] = useState<RndMonthlyPlan | null>(null);
  const [sendingItem, setSendingItem] = useState<RndItem | null>(null);
  const [checklistEditMode, setChecklistEditMode] = useState(false);

  const [statusFilter, setStatusFilter] = useState<RndStatus | 'all'>('진행중');
  const [dailyFilterItemId, setDailyFilterItemId] = useState('');
  const [month, setMonth] = useState(todayYMD().slice(0, 7));
  const [weekStart, setWeekStart] = useState(toYMD(mondayOf(new Date())));
  const weekEnd = addDays(weekStart, 6);

  // ── 로드 ───────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [itemSnap, dailySnap, weeklySnap, monthlySnap] = await Promise.all([
        getDocs(query(collection(salesDb, 'rnd_items'), orderBy('order'))),
        getDocs(query(collection(salesDb, 'rnd_daily'), orderBy('date', 'desc'))),
        getDocs(query(collection(salesDb, 'rnd_weekly'), orderBy('periodStart', 'desc'))),
        getDocs(query(collection(salesDb, 'rnd_monthly'), orderBy('order'))),
      ]);
      setItems(itemSnap.docs.map(d => ({ id: d.id, ...d.data() } as RndItem)));
      setDailyLogs(dailySnap.docs.map(d => ({ id: d.id, ...d.data() } as RndDailyLog)));
      setWeeklyReports(weeklySnap.docs.map(d => ({ id: d.id, ...d.data() } as RndWeeklyReport)));
      setMonthlyPlans(monthlySnap.docs.map(d => ({ id: d.id, ...d.data() } as RndMonthlyPlan)));
    } catch (e) { console.error('RndView loadAll error:', e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const itemName = useCallback(
    (id: string) => items.find(i => i.id === id)?.name ?? '(삭제된 품목)',
    [items]);

  const selectedItem = selectedItemId ? (items.find(i => i.id === selectedItemId) ?? null) : null;

  // ── 품목 CRUD ──────────────────────────────────────────
  const handleSaveItem = async (data: RndItemDraft) => {
    try {
      if (editingItem) {
        await updateDoc(doc(salesDb, 'rnd_items', editingItem.id),
          scrub({ ...data, updatedAt: ts() } as Record<string, unknown>));
        toast.success('수정됨');
      } else {
        const maxOrder = items.reduce((m, i) => Math.max(m, i.order), -1);
        const id = genId('ri');
        await setDoc(doc(salesDb, 'rnd_items', id),
          scrub({ ...data, id, order: maxOrder + 1, createdAt: ts(), updatedAt: ts() } as Record<string, unknown>));
        toast.success('품목 등록됨');
      }
      setShowItemForm(false); setEditingItem(null);
      await loadAll();
    } catch (e: unknown) {
      toast.error(`저장 실패: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const handleDeleteItem = async (item: RndItem) => {
    const ok = await confirm({ title: '품목 삭제', message: `"${item.name}" 품목을 삭제합니다. 일일/주간 기록은 남지만 품목명이 표시되지 않습니다. 계속할까요?`, confirmLabel: '삭제', variant: 'danger' });
    if (!ok) return;
    try {
      await deleteDoc(doc(salesDb, 'rnd_items', item.id));
      if (selectedItemId === item.id) setSelectedItemId(null);
      toast.success('삭제됨');
      await loadAll();
    } catch { toast.error('삭제 실패'); }
  };

  // 필터 뷰 안에서 이웃 품목과 order 값을 맞바꿔 이동 (숨겨진 품목은 건너뜀)
  const handleMoveItem = async (item: RndItem, dir: 'up' | 'down', visibleList: RndItem[]) => {
    const vIdx = visibleList.findIndex(i => i.id === item.id);
    const target = visibleList[vIdx + (dir === 'up' ? -1 : 1)];
    if (!target) return;
    setItems(prev => prev
      .map(i => i.id === item.id ? { ...i, order: target.order } : i.id === target.id ? { ...i, order: item.order } : i)
      .sort((a, b) => a.order - b.order));
    try {
      await Promise.all([
        updateDoc(doc(salesDb, 'rnd_items', item.id), { order: target.order, updatedAt: ts() }),
        updateDoc(doc(salesDb, 'rnd_items', target.id), { order: item.order, updatedAt: ts() }),
      ]);
    } catch { toast.error('순서 변경 실패'); await loadAll(); }
  };

  // 표/상세에서 단계·상태 바로 변경
  const handleInlineUpdate = async (item: RndItem, patch: Partial<Pick<RndItem, 'stage' | 'status'>>) => {
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, ...patch } : i));
    try {
      await updateDoc(doc(salesDb, 'rnd_items', item.id), { ...patch, updatedAt: ts() });
    } catch { toast.error('저장 실패'); await loadAll(); }
  };

  // ── 공정 체크시트 (즉시 저장) ──────────────────────────
  const saveChecklist = async (item: RndItem, checklist: ChecklistEntry[]) => {
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, checklist } : i));
    try {
      await updateDoc(doc(salesDb, 'rnd_items', item.id), { checklist, updatedAt: ts() });
    } catch { toast.error('체크시트 저장 실패'); await loadAll(); }
  };

  const toggleCheck = (item: RndItem, index: number) =>
    saveChecklist(item, buildChecklist(item).map((e, i) => i === index ? { ...e, done: !e.done } : e));

  const addCheckSub = (item: RndItem, stage: number, text: string) => {
    const cl = [...buildChecklist(item)];
    let insertAt = cl.length;
    cl.forEach((e, i) => { if (e.stage === stage) insertAt = i + 1; });
    cl.splice(insertAt, 0, { stage, text, done: false });
    saveChecklist(item, cl);
  };

  const deleteCheckSub = (item: RndItem, index: number) =>
    saveChecklist(item, buildChecklist(item).filter((_, i) => i !== index));

  // ── 일일 기록 ──────────────────────────────────────────
  const handleSaveDaily = async (data: RndDailyDraft) => {
    try {
      if (editingDaily) {
        await updateDoc(doc(salesDb, 'rnd_daily', editingDaily.id),
          scrub({ ...data, updatedAt: ts() } as Record<string, unknown>));
      } else {
        const id = genId('rd');
        await setDoc(doc(salesDb, 'rnd_daily', id),
          scrub({ ...data, id, author: currentUser.name, createdAt: ts(), updatedAt: ts() } as Record<string, unknown>));
      }
      toast.success('저장됨');
      setShowDailyForm(false); setEditingDaily(null);
      await loadAll();
    } catch (e: unknown) {
      toast.error(`저장 실패: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  // 상세 화면 빠른 기록 (품목 고정)
  const handleAddLogInline = async (itemId: string, d: { date: string; workContent: string; resultIssue?: string; nextPlan?: string }) => {
    try {
      const id = genId('rd');
      await setDoc(doc(salesDb, 'rnd_daily', id),
        scrub({ ...d, id, itemId, author: currentUser.name, createdAt: ts(), updatedAt: ts() } as Record<string, unknown>));
      toast.success('기록 저장됨');
      await loadAll();
    } catch (e: unknown) {
      toast.error(`저장 실패: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const handleDeleteDaily = async (log: RndDailyLog) => {
    const ok = await confirm({ title: '기록 삭제', message: `${log.date} 일일 기록을 삭제할까요?`, confirmLabel: '삭제', variant: 'danger' });
    if (!ok) return;
    try { await deleteDoc(doc(salesDb, 'rnd_daily', log.id)); toast.success('삭제됨'); await loadAll(); }
    catch { toast.error('삭제 실패'); }
  };

  // ── 주간 보완 코멘트 (자동 주간보고에 덧붙이는 필드) ────
  const handleSaveWeeklyExtra = async (item: RndItem, field: 'issueRisk' | 'nextWeekPlan' | 'supportRequest', value: string) => {
    const id = `${item.id}_${weekStart}`;
    const existing = weeklyReports.find(r => r.id === id);
    try {
      await setDoc(doc(salesDb, 'rnd_weekly', id), scrub({
        id, itemId: item.id, periodStart: weekStart, periodEnd: weekEnd,
        [field]: value.trim(),
        createdAt: existing?.createdAt ?? ts(), updatedAt: ts(),
      } as Record<string, unknown>), { merge: true });
      setWeeklyReports(prev => existing
        ? prev.map(r => r.id === id ? { ...r, [field]: value.trim() } : r)
        : [...prev, { id, itemId: item.id, periodStart: weekStart, periodEnd: weekEnd, [field]: value.trim(), createdAt: ts(), updatedAt: ts() } as RndWeeklyReport]);
      toast.success('저장됨');
    } catch { toast.error('저장 실패'); }
  };

  // ── 월별 계획 ──────────────────────────────────────────
  const handleSaveMonthly = async (data: RndMonthlyDraft) => {
    try {
      if (editingMonthly) {
        await updateDoc(doc(salesDb, 'rnd_monthly', editingMonthly.id),
          scrub({ ...data, updatedAt: ts() } as Record<string, unknown>));
      } else {
        const maxOrder = monthlyPlans.reduce((m, p) => Math.max(m, p.order), -1);
        const id = genId('rm');
        await setDoc(doc(salesDb, 'rnd_monthly', id),
          scrub({ ...data, id, order: maxOrder + 1, createdAt: ts(), updatedAt: ts() } as Record<string, unknown>));
      }
      toast.success('저장됨');
      setShowMonthlyForm(false); setEditingMonthly(null);
      await loadAll();
    } catch (e: unknown) {
      toast.error(`저장 실패: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const handleDeleteMonthly = async (p: RndMonthlyPlan) => {
    const ok = await confirm({ title: '계획 삭제', message: `"${p.title}" 월별 계획을 삭제할까요?`, confirmLabel: '삭제', variant: 'danger' });
    if (!ok) return;
    try { await deleteDoc(doc(salesDb, 'rnd_monthly', p.id)); toast.success('삭제됨'); await loadAll(); }
    catch { toast.error('삭제 실패'); }
  };

  // 완료된 제조품 → 제조실(factory_items) 이관
  const handleSendToFactory = async (item: RndItem, data: { unit: string; safetyDays: number; estimatedMonthlyUsage?: number }) => {
    try {
      const snap = await getDocs(collection(salesDb, 'factory_items'));
      const existing = snap.docs.map(d => d.data() as { name?: string; order?: number });
      if (existing.some(f => f.name === item.name)) {
        toast.error(`제조실에 같은 이름의 품목이 이미 있습니다: ${item.name}`);
        return;
      }
      const maxOrder = existing.reduce((m, f) => Math.max(m, f.order ?? -1), -1);
      const id = genId('fi');
      await setDoc(doc(salesDb, 'factory_items', id), scrub({
        id, name: item.name, unit: data.unit, safetyDays: data.safetyDays,
        estimatedMonthlyUsage: data.estimatedMonthlyUsage,
        order: maxOrder + 1, createdAt: ts(), updatedAt: ts(),
      } as Record<string, unknown>));
      await updateDoc(doc(salesDb, 'rnd_items', item.id), { factoryItemId: id, updatedAt: ts() });
      toast.success(`"${item.name}" 제조실 품목으로 등록됨`);
      setSendingItem(null);
      await loadAll();
    } catch (e: unknown) {
      toast.error(`이관 실패: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  // ── 집계 ───────────────────────────────────────────────
  const summary = useMemo(() => {
    const total = items.length;
    const count = (s: RndStatus) => items.filter(i => i.status === s).length;
    const avgPct = total > 0 ? Math.round(items.reduce((s, i) => s + stagePct(i.stage), 0) / total) : 0;
    return { total, ongoing: count('진행중'), hold: count('보류'), done: count('완료'), avgPct };
  }, [items]);

  const filteredItems = useMemo(
    () => statusFilter === 'all' ? items : items.filter(i => i.status === statusFilter),
    [items, statusFilter]);

  const filteredDaily = useMemo(
    () => dailyFilterItemId ? dailyLogs.filter(l => l.itemId === dailyFilterItemId) : dailyLogs,
    [dailyLogs, dailyFilterItemId]);

  const dailyByDate = useMemo(() => {
    const map = new Map<string, RndDailyLog[]>();
    filteredDaily.forEach(l => {
      if (!map.has(l.date)) map.set(l.date, []);
      map.get(l.date)!.push(l);
    });
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [filteredDaily]);

  // 주간보고 자동 생성: 해당 주 일일기록 + 보완 코멘트
  const weeklyData = useMemo(() => items
    .map(item => ({
      item,
      logs: dailyLogs
        .filter(l => l.itemId === item.id && l.date >= weekStart && l.date <= weekEnd)
        .sort((a, b) => a.date.localeCompare(b.date)),
      extra: weeklyReports.find(r => r.itemId === item.id && r.periodStart === weekStart),
    }))
    .filter(x => x.logs.length > 0 || x.item.status === '진행중'),
  [items, dailyLogs, weeklyReports, weekStart, weekEnd]);

  const monthPlans = useMemo(
    () => monthlyPlans.filter(p => p.month === month),
    [monthlyPlans, month]);

  // 월별계획 주차 실적: 품목명 일치 시 해당 월·주차 일일기록 수
  const monthWeekLogCount = useCallback((title: string, w: number) => {
    const it = items.find(i => i.name === title);
    if (!it) return 0;
    return dailyLogs.filter(l => l.itemId === it.id && l.date.startsWith(month) && weekOfMonth(l.date) === w).length;
  }, [items, dailyLogs, month]);

  // 상세 화면용: 선택 품목의 일일기록
  const selectedItemLogs = useMemo(
    () => selectedItem ? dailyLogs.filter(l => l.itemId === selectedItem.id) : [],
    [dailyLogs, selectedItem]);

  // ── 카톡 공유 ──────────────────────────────────────────
  const shareBoard = () => {
    const active = items.filter(i => i.status !== '중단');
    const lines = active.map(i => {
      const d = i.status !== '완료' ? dday(i.targetDate) : null;
      return `${i.name} — ${stageLabel(i.stage)} ${stagePct(i.stage)}%${d != null ? ` (${fmtDday(d)})` : ''}${i.status !== '진행중' ? ` [${i.status}]` : ''}`;
    });
    const today = new Date();
    shareKakao({
      title: `R&D 진행 현황 — ${today.getMonth() + 1}/${today.getDate()}`,
      body: [`진행중 ${summary.ongoing} · 완료 ${summary.done} · 평균 ${summary.avgPct}%`, ...lines].join('\n'),
      onSuccess: msg => toast.success(msg), onError: msg => toast.error(msg),
    });
  };

  const shareWeeklyAuto = () => {
    const blocks = weeklyData.map(({ item, logs, extra }) => {
      const lines = [`■ ${item.name} — ${stageLabel(item.stage)} ${stagePct(item.stage)}%`];
      if (logs.length === 0) lines.push('- 금주 기록 없음');
      logs.forEach(l => lines.push(`- ${fmtDateShort(l.date)}: ${l.workContent}${l.resultIssue ? ` (이슈: ${l.resultIssue})` : ''}`));
      if (extra?.issueRisk) lines.push(`- 이슈/리스크: ${extra.issueRisk}`);
      if (extra?.nextWeekPlan) lines.push(`- 차주 계획: ${extra.nextWeekPlan}`);
      if (extra?.supportRequest) lines.push(`- 지원 요청: ${extra.supportRequest}`);
      return lines.join('\n');
    });
    shareKakao({
      title: `R&D 주간보고 (${fmtDateShort(weekStart)}~${fmtDateShort(weekEnd)})`,
      body: blocks.join('\n\n'),
      onSuccess: msg => toast.success(msg), onError: msg => toast.error(msg),
    });
  };

  // ── 렌더 ───────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <div className="w-6 h-6 border-2 border-stone-300 border-t-stone-800 rounded-full animate-spin" />
    </div>
  );

  const TABS: { id: RndTab; label: string; icon: React.ReactNode }[] = [
    { id: 'board',   label: '관리대장',  icon: <ClipboardList size={13} /> },
    { id: 'daily',   label: '일일 기록', icon: <NotebookPen size={13} /> },
    { id: 'weekly',  label: '주간 보고', icon: <CalendarDays size={13} /> },
    { id: 'monthly', label: '월별 계획', icon: <CalendarRange size={13} /> },
  ];

  const cellCls = 'px-2 py-2 border-b border-stone-100 dark:border-stone-800 text-xs text-stone-700 dark:text-stone-300';
  const printCell = 'border border-stone-400 px-1 py-1 align-top';

  return (
    <div>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-black text-stone-900 dark:text-white flex items-center gap-2">
            <FlaskConical size={18} /> R&D 관리대장
          </h1>
          <p className="text-sm text-stone-500 dark:text-stone-400 mt-0.5">
            소스·반찬 제조실 연구개발 — 품목을 클릭하면 공정 체크시트와 기록이 함께 열립니다
          </p>
        </div>
        <div className="flex items-center gap-2">
          {tab === 'board' && !selectedItem && (
            <button onClick={shareBoard} disabled={items.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400 text-xs font-bold rounded-sm hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors disabled:opacity-40">
              <MessageCircle size={12} /> 카톡 복사
            </button>
          )}
          {tab === 'weekly' && (
            <button onClick={shareWeeklyAuto} disabled={weeklyData.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400 text-xs font-bold rounded-sm hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors disabled:opacity-40">
              <MessageCircle size={12} /> 카톡 복사
            </button>
          )}
          <button onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-2 border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400 text-xs font-bold rounded-sm hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors">
            <Printer size={12} /> 인쇄
          </button>
          {tab === 'board' && !selectedItem && (
            <button onClick={() => { setEditingItem(null); setShowItemForm(true); }}
              className="flex items-center gap-1.5 px-3 py-2 bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-xs font-bold rounded-sm hover:bg-stone-700 transition-colors">
              <Plus size={12} /> 품목 등록
            </button>
          )}
          {tab === 'daily' && (
            <button onClick={() => { setEditingDaily(null); setShowDailyForm(true); }} disabled={items.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-xs font-bold rounded-sm hover:bg-stone-700 transition-colors disabled:opacity-40">
              <Plus size={12} /> 기록 추가
            </button>
          )}
          {tab === 'monthly' && (
            <button onClick={() => { setEditingMonthly(null); setShowMonthlyForm(true); }}
              className="flex items-center gap-1.5 px-3 py-2 bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-xs font-bold rounded-sm hover:bg-stone-700 transition-colors">
              <Plus size={12} /> 계획 추가
            </button>
          )}
        </div>
      </div>

      {/* 탭 */}
      <div className="flex items-center gap-1 border-b border-stone-200 dark:border-stone-700 mb-4">
        {TABS.map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); if (t.id !== 'board') setSelectedItemId(null); }}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold border-b-2 -mb-px transition-colors ${
              tab === t.id
                ? 'border-stone-800 dark:border-stone-300 text-stone-900 dark:text-white'
                : 'border-transparent text-stone-400 hover:text-stone-700 dark:hover:text-stone-300'
            }`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── 탭 1: 관리대장 (목록 ↔ 품목 상세) ── */}
      {tab === 'board' && selectedItem && (
        <div>
          {/* 상세 헤더 */}
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <button onClick={() => setSelectedItemId(null)}
                className="p-1.5 text-stone-400 hover:text-stone-800 dark:hover:text-stone-200 border border-stone-200 dark:border-stone-700 rounded-sm shrink-0">
                <ArrowLeft size={14} />
              </button>
              <h2 className="text-lg font-black text-stone-900 dark:text-white truncate">{selectedItem.name}</h2>
              <span className={`px-1.5 py-0.5 rounded-sm text-[10px] font-bold shrink-0 ${PRODUCT_TYPE_BADGE[productTypeOf(selectedItem)]}`}>{productTypeOf(selectedItem)}</span>
              <span className="text-xs text-stone-400 shrink-0">{selectedItem.category} · 담당 {selectedItem.assignee ?? '-'}</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {(() => {
                const d = selectedItem.status !== '완료' ? dday(selectedItem.targetDate) : null;
                return d != null && (
                  <span className={`text-xs font-black ${d < 0 ? 'text-red-500' : d <= 7 ? 'text-amber-600 dark:text-amber-400' : 'text-stone-500'}`}>
                    {fmtDday(d)} <span className="font-bold text-stone-400">({selectedItem.targetDate})</span>
                  </span>
                );
              })()}
              <select value={selectedItem.stage} onChange={e => handleInlineUpdate(selectedItem, { stage: Number(e.target.value) })}
                className="text-xs border border-stone-200 dark:border-stone-600 rounded-sm px-1.5 py-1.5 bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200 focus:outline-none">
                {RND_STAGES.map(s => <option key={s.stage} value={s.stage}>{s.stage}. {s.short} ({s.pct}%)</option>)}
              </select>
              <select value={selectedItem.status} onChange={e => handleInlineUpdate(selectedItem, { status: e.target.value as RndStatus })}
                className={`text-[11px] font-bold rounded-sm px-1.5 py-1.5 border-0 focus:outline-none ${STATUS_BADGE[selectedItem.status]}`}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <div className="flex items-center gap-1.5">
                <div className="w-20 h-1.5 bg-stone-100 dark:bg-stone-800 rounded-full overflow-hidden">
                  <div className="h-full bg-stone-700 dark:bg-stone-300 rounded-full" style={{ width: `${stagePct(selectedItem.stage)}%` }} />
                </div>
                <span className="text-[11px] font-black text-stone-600 dark:text-stone-300">{stagePct(selectedItem.stage)}%</span>
              </div>
              {productTypeOf(selectedItem) === '제조품' && selectedItem.status === '완료' && !selectedItem.factoryItemId && (
                <button onClick={() => setSendingItem(selectedItem)}
                  className="flex items-center gap-1 px-2 py-1.5 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 rounded-sm hover:bg-indigo-50 dark:hover:bg-indigo-900/20">
                  <Factory size={11} /> 제조실 등록
                </button>
              )}
              {selectedItem.factoryItemId && (
                <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400"><Factory size={11} /> 제조실 등록됨</span>
              )}
              <button onClick={() => { setEditingItem(selectedItem); setShowItemForm(true); }}
                className="p-1.5 text-stone-400 hover:text-stone-700 border border-stone-200 dark:border-stone-700 rounded-sm"><Edit2 size={13} /></button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* 좌: 공정 체크시트 (상시 노출) */}
            <div className="border border-stone-200 dark:border-stone-700 rounded-sm bg-white dark:bg-stone-900">
              <div className="flex items-center justify-between px-3 py-2 border-b-[3px] border-double border-stone-800 dark:border-stone-400">
                <h3 className="text-xs font-black text-stone-900 dark:text-white flex items-center gap-1.5"><CheckSquare size={13} /> 공정 체크시트</h3>
                <button onClick={() => setChecklistEditMode(m => !m)}
                  className={`text-[10px] font-bold px-2 py-1 rounded-sm border transition-colors ${
                    checklistEditMode
                      ? 'bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 border-stone-900 dark:border-stone-100'
                      : 'text-stone-500 border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800'
                  }`}>
                  {checklistEditMode ? '편집 완료' : '항목 편집'}
                </button>
              </div>
              <div className="p-3 space-y-2">
                {RND_STAGES.map(s => {
                  const cl = buildChecklist(selectedItem);
                  const entries = cl.map((e, i) => ({ ...e, idx: i })).filter(e => e.stage === s.stage);
                  const done = entries.filter(e => e.done).length;
                  const allDone = entries.length > 0 && done === entries.length;
                  const isCurrent = s.stage === selectedItem.stage;
                  return (
                    <div key={s.stage} className={`border rounded-sm ${isCurrent ? 'border-stone-800 dark:border-stone-300' : 'border-stone-200 dark:border-stone-700'}`}>
                      <button onClick={() => handleInlineUpdate(selectedItem, { stage: s.stage })}
                        title="클릭하면 이 단계를 현재 단계로 설정"
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 text-left ${isCurrent ? 'bg-stone-100 dark:bg-stone-800' : 'hover:bg-stone-50 dark:hover:bg-stone-800/50'}`}>
                        <span className={`text-[11px] font-black ${allDone ? 'text-emerald-600 dark:text-emerald-400' : 'text-stone-900 dark:text-white'}`}>
                          {s.stage}. {s.label}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-stone-400">{done}/{entries.length}</span>
                          {isCurrent && <span className="text-[9px] font-bold px-1 py-0.5 rounded-sm bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900">현재</span>}
                        </span>
                      </button>
                      <div className="px-2.5 py-1.5 space-y-1 border-t border-stone-100 dark:border-stone-800">
                        {entries.map(e => (
                          <div key={e.idx} className="flex items-center gap-1.5 group">
                            <label className="flex items-center gap-2 cursor-pointer flex-1 min-w-0">
                              <input type="checkbox" checked={e.done} onChange={() => toggleCheck(selectedItem, e.idx)}
                                className="w-3.5 h-3.5 accent-stone-800 dark:accent-stone-200 shrink-0" />
                              <span className={`text-[11px] ${e.done ? 'text-stone-400 line-through' : 'text-stone-700 dark:text-stone-300'}`}>{e.text}</span>
                            </label>
                            {checklistEditMode && (
                              <button onClick={() => deleteCheckSub(selectedItem, e.idx)}
                                className="p-0.5 text-stone-300 hover:text-red-500 shrink-0"><X size={11} /></button>
                            )}
                          </div>
                        ))}
                        {checklistEditMode && <StageAddInput onAdd={text => addCheckSub(selectedItem, s.stage, text)} />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 우: 일일 기록 (빠른 입력 + 타임라인) */}
            <div className="border border-stone-200 dark:border-stone-700 rounded-sm bg-white dark:bg-stone-900 flex flex-col">
              <div className="px-3 py-2 border-b-[3px] border-double border-stone-800 dark:border-stone-400">
                <h3 className="text-xs font-black text-stone-900 dark:text-white flex items-center gap-1.5">
                  <NotebookPen size={13} /> 일일 기록 <span className="text-stone-400 font-bold">({selectedItemLogs.length}건)</span>
                </h3>
              </div>
              <div className="p-3 space-y-2">
                <QuickLogForm onAdd={d => handleAddLogInline(selectedItem.id, d)} />
                {selectedItemLogs.length === 0 ? (
                  <p className="text-xs text-stone-400 text-center py-6">아직 기록이 없습니다. 위에서 오늘 작업을 기록하세요.</p>
                ) : (
                  <div className="space-y-1.5 max-h-[600px] overflow-y-auto">
                    {selectedItemLogs.map(log => (
                      <div key={log.id} className="flex items-start gap-2.5 px-2.5 py-2 border border-stone-100 dark:border-stone-800 rounded-sm">
                        <div className="shrink-0 w-16">
                          <p className="text-[11px] font-black text-stone-800 dark:text-stone-200">{fmtDateShort(log.date)}</p>
                          <p className="text-[9px] text-stone-400">{log.author}</p>
                        </div>
                        <div className="flex-1 min-w-0 text-[11px] text-stone-700 dark:text-stone-300 space-y-0.5">
                          <p className="whitespace-pre-wrap">{log.workContent}</p>
                          {log.resultIssue && <p className="text-amber-700 dark:text-amber-400 whitespace-pre-wrap">이슈: {log.resultIssue}</p>}
                          {log.nextPlan && <p className="text-stone-400">익일: {log.nextPlan}</p>}
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0">
                          <button onClick={() => { setEditingDaily(log); setShowDailyForm(true); }} className="p-1 text-stone-400 hover:text-stone-700"><Edit2 size={11} /></button>
                          <button onClick={() => handleDeleteDaily(log)} className="p-1 text-stone-400 hover:text-red-500"><Trash2 size={11} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'board' && !selectedItem && (
        <div>
          {/* 요약 카드 */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
            {[
              { label: '전체 품목', value: `${summary.total}건` },
              { label: '진행중', value: `${summary.ongoing}건` },
              { label: '보류', value: `${summary.hold}건` },
              { label: '완료', value: `${summary.done}건` },
              { label: '평균 진행률', value: `${summary.avgPct}%` },
            ].map(c => (
              <div key={c.label} className="px-3 py-2.5 border border-stone-200 dark:border-stone-700 rounded-sm bg-white dark:bg-stone-900">
                <p className="text-[10px] font-bold text-stone-400">{c.label}</p>
                <p className="text-lg font-black text-stone-900 dark:text-white">{c.value}</p>
              </div>
            ))}
          </div>

          {/* 상태 필터 칩 */}
          <div className="flex items-center gap-1 mb-3 flex-wrap">
            {([...STATUSES, 'all'] as (RndStatus | 'all')[]).map(s => {
              const cnt = s === 'all' ? items.length : items.filter(i => i.status === s).length;
              const active = statusFilter === s;
              return (
                <button key={s} onClick={() => setStatusFilter(s)}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-sm border transition-colors ${
                    active
                      ? 'bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 border-stone-900 dark:border-stone-100'
                      : 'bg-white dark:bg-stone-900 text-stone-500 dark:text-stone-400 border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800'
                  }`}>
                  {s === 'all' ? '전체' : s} {cnt}
                </button>
              );
            })}
          </div>

          {items.length === 0 ? (
            <div className="text-center py-20 border border-dashed border-stone-300 dark:border-stone-700 rounded-sm">
              <FlaskConical size={28} className="mx-auto text-stone-300 mb-2" />
              <p className="text-sm text-stone-400">등록된 R&D 품목이 없습니다. '품목 등록'으로 시작하세요.</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-stone-300 dark:border-stone-700 rounded-sm">
              <p className="text-sm text-stone-400">'{statusFilter}' 상태의 품목이 없습니다.</p>
            </div>
          ) : (
            <div className="overflow-x-auto border border-stone-200 dark:border-stone-700 rounded-sm bg-white dark:bg-stone-900">
              <table className="w-full min-w-[1160px]">
                <thead>
                  <tr className="bg-stone-50 dark:bg-stone-800/50">
                    {['No', '품목명', '구분', '카테고리', '담당자', '우선순위', '시작일', '목표일', '현재 단계', 'D-Day', '진행률', '상태', '금주 진행 / 다음 액션', ''].map((h, i) => (
                      <th key={i} className="px-2 py-2 text-left text-[10px] font-bold text-stone-400 border-b border-stone-200 dark:border-stone-700 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item, idx) => {
                    const d = item.status !== '완료' ? dday(item.targetDate) : null;
                    const pct = stagePct(item.stage);
                    const pType = productTypeOf(item);
                    const { done, total } = stageCheckProgress(item);
                    return (
                      <tr key={item.id} className="hover:bg-stone-50 dark:hover:bg-stone-800/30">
                        <td className={`${cellCls} text-stone-400`}>{idx + 1}</td>
                        <td className={`${cellCls} whitespace-nowrap`}>
                          <button onClick={() => setSelectedItemId(item.id)}
                            className="font-bold text-stone-900 dark:text-white hover:underline text-left">
                            {item.name}
                          </button>
                        </td>
                        <td className={cellCls}>
                          <span className={`inline-block px-1.5 py-0.5 rounded-sm text-[10px] font-bold whitespace-nowrap ${PRODUCT_TYPE_BADGE[pType]}`}>{pType}</span>
                        </td>
                        <td className={`${cellCls} whitespace-nowrap`}>{item.category}</td>
                        <td className={`${cellCls} whitespace-nowrap`}>{item.assignee ?? '-'}</td>
                        <td className={cellCls}>
                          <span className={`inline-block px-1.5 py-0.5 rounded-sm text-[10px] font-bold ${PRIORITY_BADGE[item.priority]}`}>{item.priority}</span>
                        </td>
                        <td className={`${cellCls} whitespace-nowrap`}>{item.startDate ? fmtDateShort(item.startDate) : '-'}</td>
                        <td className={`${cellCls} whitespace-nowrap`}>{item.targetDate ? fmtDateShort(item.targetDate) : '-'}</td>
                        <td className={cellCls}>
                          <select value={item.stage} onChange={e => handleInlineUpdate(item, { stage: Number(e.target.value) })}
                            className="text-xs border border-stone-200 dark:border-stone-600 rounded-sm px-1 py-1 bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200 focus:outline-none">
                            {RND_STAGES.map(s => <option key={s.stage} value={s.stage}>{s.stage}. {s.short}</option>)}
                          </select>
                          <button onClick={() => setSelectedItemId(item.id)}
                            className={`block mt-0.5 text-[9px] font-bold hover:underline ${done === total && total > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-stone-400'}`}>
                            체크 {done}/{total}
                          </button>
                        </td>
                        <td className={`${cellCls} whitespace-nowrap font-bold ${d != null && d < 0 ? 'text-red-500' : d != null && d <= 7 ? 'text-amber-600 dark:text-amber-400' : ''}`}>
                          {d != null ? fmtDday(d) : '-'}
                        </td>
                        <td className={cellCls}>
                          <div className="flex items-center gap-1.5">
                            <div className="w-14 h-1.5 bg-stone-100 dark:bg-stone-800 rounded-full overflow-hidden">
                              <div className="h-full bg-stone-700 dark:bg-stone-300 rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-[10px] font-bold text-stone-500">{pct}%</span>
                          </div>
                        </td>
                        <td className={cellCls}>
                          <select value={item.status} onChange={e => handleInlineUpdate(item, { status: e.target.value as RndStatus })}
                            className={`text-[10px] font-bold rounded-sm px-1.5 py-1 border-0 focus:outline-none ${STATUS_BADGE[item.status]}`}>
                            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </td>
                        <td className={`${cellCls} max-w-[220px]`}>
                          {item.thisWeekNote && <p className="truncate">{item.thisWeekNote}</p>}
                          {item.nextAction && <p className="truncate text-stone-400">→ {item.nextAction}</p>}
                          {!item.thisWeekNote && !item.nextAction && '-'}
                        </td>
                        <td className={`${cellCls} whitespace-nowrap`}>
                          <div className="flex items-center gap-0.5">
                            <button onClick={() => setSelectedItemId(item.id)} title="공정 체크시트 · 기록"
                              className="p-1 text-stone-400 hover:text-stone-700"><CheckSquare size={12} /></button>
                            {pType === '제조품' && item.status === '완료' && (
                              item.factoryItemId
                                ? <span title="제조실 등록됨" className="p-1 text-emerald-500"><Factory size={12} /></span>
                                : <button onClick={() => setSendingItem(item)} title="제조실 품목으로 등록"
                                    className="p-1 text-indigo-500 hover:text-indigo-700 dark:text-indigo-400"><Factory size={12} /></button>
                            )}
                            <button onClick={() => handleMoveItem(item, 'up', filteredItems)} className="p-1 text-stone-300 hover:text-stone-600"><ChevronUp size={12} /></button>
                            <button onClick={() => handleMoveItem(item, 'down', filteredItems)} className="p-1 text-stone-300 hover:text-stone-600"><ChevronDown size={12} /></button>
                            <button onClick={() => { setEditingItem(item); setShowItemForm(true); }} className="p-1 text-stone-400 hover:text-stone-700"><Edit2 size={12} /></button>
                            <button onClick={() => handleDeleteItem(item)} className="p-1 text-stone-400 hover:text-red-500"><Trash2 size={12} /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── 탭 2: 일일 기록 (전체 타임라인) ── */}
      {tab === 'daily' && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <select value={dailyFilterItemId} onChange={e => setDailyFilterItemId(e.target.value)}
              className="text-xs border border-stone-200 dark:border-stone-600 rounded-sm px-2 py-1.5 bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200 focus:outline-none">
              <option value="">전체 품목</option>
              {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
            <span className="text-[11px] text-stone-400">{filteredDaily.length}건 — 품목 상세 화면에서도 바로 기록할 수 있습니다</span>
          </div>
          {dailyByDate.length === 0 ? (
            <div className="text-center py-20 border border-dashed border-stone-300 dark:border-stone-700 rounded-sm">
              <NotebookPen size={28} className="mx-auto text-stone-300 mb-2" />
              <p className="text-sm text-stone-400">일일 기록이 없습니다. 관리대장에서 품목을 클릭해 바로 기록하세요.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {dailyByDate.map(([date, logs]) => (
                <div key={date}>
                  <p className="text-xs font-black text-stone-900 dark:text-white mb-1.5 pb-1 border-b-[3px] border-double border-stone-800 dark:border-stone-400 inline-block pr-6">
                    {date} <span className="text-stone-400 font-bold">({logs.length}건)</span>
                  </p>
                  <div className="space-y-1.5">
                    {logs.map(log => (
                      <div key={log.id} className="flex items-start gap-3 px-3 py-2.5 border border-stone-200 dark:border-stone-700 rounded-sm bg-white dark:bg-stone-900">
                        <div className="shrink-0 w-32">
                          <button onClick={() => { setTab('board'); setSelectedItemId(log.itemId); }}
                            className="text-xs font-bold text-stone-900 dark:text-white truncate hover:underline text-left block max-w-full">
                            {itemName(log.itemId)}
                          </button>
                          <p className="text-[10px] text-stone-400">{log.author}</p>
                        </div>
                        <div className="flex-1 min-w-0 text-xs text-stone-700 dark:text-stone-300 space-y-0.5">
                          <p className="whitespace-pre-wrap">{log.workContent}</p>
                          {log.resultIssue && <p className="text-amber-700 dark:text-amber-400 whitespace-pre-wrap">이슈: {log.resultIssue}</p>}
                          {log.nextPlan && <p className="text-stone-400">익일: {log.nextPlan}</p>}
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0">
                          <button onClick={() => { setEditingDaily(log); setShowDailyForm(true); }} className="p-1 text-stone-400 hover:text-stone-700"><Edit2 size={12} /></button>
                          <button onClick={() => handleDeleteDaily(log)} className="p-1 text-stone-400 hover:text-red-500"><Trash2 size={12} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── 탭 3: 주간 보고 (일일기록 자동 집계) ── */}
      {tab === 'weekly' && (
        <div>
          {/* 주 이동 */}
          <div className="flex items-center gap-2 mb-3">
            <button onClick={() => setWeekStart(addDays(weekStart, -7))}
              className="p-1.5 border border-stone-200 dark:border-stone-700 rounded-sm text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800"><ChevronLeft size={13} /></button>
            <span className="text-xs font-black text-stone-900 dark:text-white">{weekStart} ~ {weekEnd}</span>
            <button onClick={() => setWeekStart(addDays(weekStart, 7))}
              className="p-1.5 border border-stone-200 dark:border-stone-700 rounded-sm text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800"><ChevronRight size={13} /></button>
            <button onClick={() => setWeekStart(toYMD(mondayOf(new Date())))}
              className="px-2 py-1 text-[11px] font-bold text-stone-500 border border-stone-200 dark:border-stone-700 rounded-sm hover:bg-stone-100 dark:hover:bg-stone-800">이번 주</button>
            <span className="text-[11px] text-stone-400 hidden sm:inline">일일기록에서 자동 생성 — 이슈·차주 계획만 보완 입력</span>
          </div>

          {weeklyData.length === 0 ? (
            <div className="text-center py-20 border border-dashed border-stone-300 dark:border-stone-700 rounded-sm">
              <CalendarDays size={28} className="mx-auto text-stone-300 mb-2" />
              <p className="text-sm text-stone-400">이 주에 해당하는 진행중 품목이나 일일 기록이 없습니다.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {weeklyData.map(({ item, logs, extra }) => (
                <div key={item.id} className="border border-stone-200 dark:border-stone-700 rounded-sm bg-white dark:bg-stone-900">
                  <div className="flex items-center justify-between px-3 py-2 border-b border-stone-100 dark:border-stone-800 flex-wrap gap-1">
                    <button onClick={() => { setTab('board'); setSelectedItemId(item.id); }}
                      className="text-xs font-black text-stone-900 dark:text-white hover:underline">
                      {item.name}
                    </button>
                    <span className="text-[10px] font-bold text-stone-400">
                      {stageLabel(item.stage)} · {stagePct(item.stage)}%
                      <span className={`ml-2 px-1.5 py-0.5 rounded-sm ${STATUS_BADGE[item.status]}`}>{item.status}</span>
                    </span>
                  </div>
                  <div className="px-3 py-2">
                    {logs.length === 0 ? (
                      <p className="text-[11px] text-stone-400">금주 일일 기록 없음</p>
                    ) : (
                      <div className="space-y-0.5 mb-2">
                        {logs.map(l => (
                          <p key={l.id} className="text-[11px] text-stone-700 dark:text-stone-300">
                            <span className="font-black text-stone-500 dark:text-stone-400">{fmtDateShort(l.date)}</span>{' '}
                            {l.workContent}
                            {l.resultIssue && <span className="text-amber-700 dark:text-amber-400"> — 이슈: {l.resultIssue}</span>}
                          </p>
                        ))}
                      </div>
                    )}
                    {extra?.progressNote && (
                      <p className="text-[11px] text-stone-500 dark:text-stone-400 mb-2">메모: {extra.progressNote}</p>
                    )}
                    <div className="flex gap-2 flex-wrap pt-1.5 border-t border-dashed border-stone-200 dark:border-stone-700">
                      <WeeklyExtraInput label="이슈 / 리스크" value={extra?.issueRisk ?? ''}
                        onSave={v => handleSaveWeeklyExtra(item, 'issueRisk', v)} />
                      <WeeklyExtraInput label="차주 계획" value={extra?.nextWeekPlan ?? ''}
                        onSave={v => handleSaveWeeklyExtra(item, 'nextWeekPlan', v)} />
                      <WeeklyExtraInput label="지원 요청" value={extra?.supportRequest ?? ''}
                        onSave={v => handleSaveWeeklyExtra(item, 'supportRequest', v)} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── 탭 4: 월별 계획 (주차별 실적 자동 연동) ── */}
      {tab === 'monthly' && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <input type="month" value={month} onChange={e => setMonth(e.target.value)}
              className="text-xs border border-stone-200 dark:border-stone-600 rounded-sm px-2 py-1.5 bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200 focus:outline-none" />
            <span className="text-[11px] text-stone-400">{monthPlans.length}건 — 품목명이 일치하면 주차별 기록 수가 자동 표시됩니다</span>
          </div>
          {monthPlans.length === 0 ? (
            <div className="text-center py-20 border border-dashed border-stone-300 dark:border-stone-700 rounded-sm">
              <CalendarRange size={28} className="mx-auto text-stone-300 mb-2" />
              <p className="text-sm text-stone-400">{month} 계획이 없습니다. 월초에 품목별 목표와 주차별 계획을 세우세요.</p>
            </div>
          ) : (
            <div className="overflow-x-auto border border-stone-200 dark:border-stone-700 rounded-sm bg-white dark:bg-stone-900">
              <table className="w-full min-w-[980px]">
                <thead>
                  <tr className="bg-stone-50 dark:bg-stone-800/50">
                    {['No', '품목 / 과제', '담당자', '월 목표', 'W1', 'W2', 'W3', 'W4', 'W5', '목표일', ''].map((h, i) => (
                      <th key={i} className="px-2 py-2 text-left text-[10px] font-bold text-stone-400 border-b border-stone-200 dark:border-stone-700 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {monthPlans.map((p, idx) => (
                    <tr key={p.id} className="hover:bg-stone-50 dark:hover:bg-stone-800/30 align-top">
                      <td className={`${cellCls} text-stone-400`}>{idx + 1}</td>
                      <td className={`${cellCls} font-bold text-stone-900 dark:text-white whitespace-nowrap`}>{p.title}</td>
                      <td className={`${cellCls} whitespace-nowrap`}>{p.assignee ?? '-'}</td>
                      <td className={`${cellCls} max-w-[200px] whitespace-pre-wrap`}>{p.monthGoal ?? '-'}</td>
                      {[1, 2, 3, 4, 5].map(w => {
                        const cnt = monthWeekLogCount(p.title, w);
                        return (
                          <td key={w} className={`${cellCls} max-w-[120px]`}>
                            <p className="whitespace-pre-wrap">{p.weekPlans?.[w - 1] || '-'}</p>
                            {cnt > 0 && (
                              <span className="inline-block mt-0.5 px-1 py-0.5 text-[9px] font-bold rounded-sm bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                                기록 {cnt}
                              </span>
                            )}
                          </td>
                        );
                      })}
                      <td className={`${cellCls} whitespace-nowrap`}>{p.targetDate ? fmtDateShort(p.targetDate) : '-'}</td>
                      <td className={`${cellCls} whitespace-nowrap`}>
                        <div className="flex items-center gap-0.5">
                          <button onClick={() => { setEditingMonthly(p); setShowMonthlyForm(true); }} className="p-1 text-stone-400 hover:text-stone-700"><Edit2 size={12} /></button>
                          <button onClick={() => handleDeleteMonthly(p)} className="p-1 text-stone-400 hover:text-red-500"><Trash2 size={12} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── 인쇄 전용 영역 (화면에서는 숨김) ── */}
      <div id="rnd-print-area" className="hidden print:block bg-white text-black p-2">
        {/* 품목 상세: 공정 체크시트 리포트 */}
        {tab === 'board' && selectedItem ? (
          <>
            <h1 className="text-lg font-black border-b-[3px] border-double border-black pb-1 mb-1">
              새모양 F&B | R&D 공정 체크시트
            </h1>
            <p className="text-[11px] mb-2">
              메뉴명: <span className="font-black">{selectedItem.name}</span>
              {' · '}담당자: {selectedItem.assignee ?? '-'}
              {' · '}{productTypeOf(selectedItem)} / {selectedItem.category}
              {' · '}상태: {selectedItem.status}
              {' · '}단계: {stageLabel(selectedItem.stage)} ({stagePct(selectedItem.stage)}%)
              {selectedItem.targetDate && ` · 목표일: ${selectedItem.targetDate}`}
              {' · '}출력일: {todayYMD()}
            </p>
            {RND_STAGES.map(s => {
              const entries = buildChecklist(selectedItem).filter(e => e.stage === s.stage);
              return (
                <div key={s.stage} className="mb-2">
                  <p className={`text-[11px] font-black border-b border-black ${s.stage === selectedItem.stage ? 'bg-stone-200' : ''}`}>
                    {s.stage}. {s.label} ({entries.filter(e => e.done).length}/{entries.length})
                    {s.stage === selectedItem.stage && ' ◀ 현재 단계'}
                  </p>
                  {entries.map((e, i) => (
                    <p key={i} className="text-[10px] pl-2">{e.done ? '☑' : '☐'} {e.text}</p>
                  ))}
                </div>
              );
            })}
            {selectedItemLogs.length > 0 && (
              <>
                <p className="text-[11px] font-black border-b border-black mt-3 mb-1">일일 기록</p>
                <table className="w-full table-fixed border-collapse text-[10px]">
                  <colgroup><col className="w-14" /><col className="w-12" /><col /><col /><col className="w-28" /></colgroup>
                  <thead>
                    <tr>{['날짜', '작성자', '작업 내용', '결과 / 이슈', '익일 계획'].map((h, i) => (
                      <th key={i} className={`${printCell} text-left font-bold bg-stone-100`}>{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {selectedItemLogs.map(l => (
                      <tr key={l.id}>
                        <td className={printCell}>{l.date}</td>
                        <td className={printCell}>{l.author}</td>
                        <td className={`${printCell} break-words whitespace-pre-wrap`}>{l.workContent}</td>
                        <td className={`${printCell} break-words whitespace-pre-wrap`}>{l.resultIssue ?? ''}</td>
                        <td className={`${printCell} break-words`}>{l.nextPlan ?? ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </>
        ) : (
          <>
            <h1 className="text-lg font-black border-b-[3px] border-double border-black pb-1 mb-1">
              새모양 F&B | R&D {TABS.find(t => t.id === tab)?.label}
              {tab === 'monthly' && ` — ${month}`}
              {tab === 'weekly' && ` — ${weekStart} ~ ${weekEnd}`}
            </h1>
            <p className="text-[10px] text-stone-600 mb-3">출력일: {todayYMD()}{tab === 'board' ? ` · 전체 ${summary.total} · 진행중 ${summary.ongoing} · 완료 ${summary.done} · 평균 진행률 ${summary.avgPct}%` : ''}</p>

            {tab === 'board' && (
              <table className="w-full table-fixed border-collapse text-[10px]">
                <colgroup>
                  <col className="w-6" /><col className="w-28" /><col className="w-14" /><col className="w-14" /><col className="w-12" />
                  <col className="w-10" /><col className="w-14" /><col className="w-14" /><col className="w-20" />
                  <col className="w-12" /><col className="w-10" /><col className="w-10" /><col /><col />
                </colgroup>
                <thead>
                  <tr>
                    {['No', '품목명', '구분', '카테고리', '담당자', '우선', '시작일', '목표일', '현재 단계', 'D-Day', '진행률', '상태', '금주 진행', '다음 액션'].map((h, i) => (
                      <th key={i} className={`${printCell} text-left font-bold bg-stone-100`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => {
                    const d = item.status !== '완료' ? dday(item.targetDate) : null;
                    return (
                      <tr key={item.id}>
                        <td className={printCell}>{idx + 1}</td>
                        <td className={`${printCell} font-bold break-words`}>{item.name}</td>
                        <td className={printCell}>{productTypeOf(item)}</td>
                        <td className={printCell}>{item.category}</td>
                        <td className={printCell}>{item.assignee ?? ''}</td>
                        <td className={printCell}>{item.priority}</td>
                        <td className={printCell}>{item.startDate ?? ''}</td>
                        <td className={printCell}>{item.targetDate ?? ''}</td>
                        <td className={printCell}>{stageLabel(item.stage)}</td>
                        <td className={printCell}>{d != null ? fmtDday(d) : ''}</td>
                        <td className={printCell}>{stagePct(item.stage)}%</td>
                        <td className={printCell}>{item.status}</td>
                        <td className={`${printCell} break-words`}>{item.thisWeekNote ?? ''}</td>
                        <td className={`${printCell} break-words`}>{item.nextAction ?? ''}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {tab === 'daily' && dailyByDate.map(([date, logs]) => (
              <div key={date} className="mb-3">
                <p className="text-xs font-black border-b border-black mb-1">{date}</p>
                <table className="w-full table-fixed border-collapse text-[10px]">
                  <colgroup><col className="w-24" /><col className="w-14" /><col /><col /><col className="w-32" /></colgroup>
                  <thead>
                    <tr>{['품목명', '작성자', '금일 작업 내용', '결과 / 이슈', '익일 계획'].map((h, i) => (
                      <th key={i} className={`${printCell} text-left font-bold bg-stone-100`}>{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {logs.map(l => (
                      <tr key={l.id}>
                        <td className={`${printCell} font-bold break-words`}>{itemName(l.itemId)}</td>
                        <td className={printCell}>{l.author}</td>
                        <td className={`${printCell} break-words whitespace-pre-wrap`}>{l.workContent}</td>
                        <td className={`${printCell} break-words whitespace-pre-wrap`}>{l.resultIssue ?? ''}</td>
                        <td className={`${printCell} break-words`}>{l.nextPlan ?? ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}

            {tab === 'weekly' && weeklyData.map(({ item, logs, extra }) => (
              <div key={item.id} className="mb-3">
                <p className="text-xs font-black border-b border-black mb-1">
                  {item.name} — {stageLabel(item.stage)} {stagePct(item.stage)}% [{item.status}]
                </p>
                {logs.length === 0
                  ? <p className="text-[10px] pl-2">금주 기록 없음</p>
                  : logs.map(l => (
                      <p key={l.id} className="text-[10px] pl-2">
                        · {fmtDateShort(l.date)}: {l.workContent}{l.resultIssue ? ` — 이슈: ${l.resultIssue}` : ''}
                      </p>
                    ))}
                {extra?.progressNote && <p className="text-[10px] pl-2">· 메모: {extra.progressNote}</p>}
                {extra?.issueRisk && <p className="text-[10px] pl-2 font-bold">· 이슈/리스크: {extra.issueRisk}</p>}
                {extra?.nextWeekPlan && <p className="text-[10px] pl-2">· 차주 계획: {extra.nextWeekPlan}</p>}
                {extra?.supportRequest && <p className="text-[10px] pl-2">· 지원 요청: {extra.supportRequest}</p>}
              </div>
            ))}

            {tab === 'monthly' && (
              <table className="w-full table-fixed border-collapse text-[10px]">
                <colgroup>
                  <col className="w-6" /><col className="w-24" /><col className="w-12" /><col />
                  <col /><col /><col /><col /><col /><col className="w-16" />
                </colgroup>
                <thead>
                  <tr>{['No', '품목 / 과제', '담당자', '월 목표', 'W1', 'W2', 'W3', 'W4', 'W5', '목표일'].map((h, i) => (
                    <th key={i} className={`${printCell} text-left font-bold bg-stone-100`}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {monthPlans.map((p, idx) => (
                    <tr key={p.id}>
                      <td className={printCell}>{idx + 1}</td>
                      <td className={`${printCell} font-bold break-words`}>{p.title}</td>
                      <td className={printCell}>{p.assignee ?? ''}</td>
                      <td className={`${printCell} break-words whitespace-pre-wrap`}>{p.monthGoal ?? ''}</td>
                      {[1, 2, 3, 4, 5].map(w => {
                        const cnt = monthWeekLogCount(p.title, w);
                        return (
                          <td key={w} className={`${printCell} break-words`}>
                            {p.weekPlans?.[w - 1] ?? ''}{cnt > 0 ? ` (기록 ${cnt})` : ''}
                          </td>
                        );
                      })}
                      <td className={printCell}>{p.targetDate ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>

      {/* ── 모달 ── */}
      {showItemForm && (
        <ItemFormModal item={editingItem ?? undefined} onSave={handleSaveItem}
          onClose={() => { setShowItemForm(false); setEditingItem(null); }} />
      )}
      {showDailyForm && (
        <DailyLogModal log={editingDaily ?? undefined} items={items} onSave={handleSaveDaily}
          onClose={() => { setShowDailyForm(false); setEditingDaily(null); }} />
      )}
      {showMonthlyForm && (
        <MonthlyModal plan={editingMonthly ?? undefined} month={month} items={items} onSave={handleSaveMonthly}
          onClose={() => { setShowMonthlyForm(false); setEditingMonthly(null); }} />
      )}
      {sendingItem && (
        <SendToFactoryModal item={sendingItem}
          onSave={data => handleSendToFactory(sendingItem, data)}
          onClose={() => setSendingItem(null)} />
      )}
    </div>
  );
}
