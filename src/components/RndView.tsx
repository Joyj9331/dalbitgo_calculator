// R&D 관리대장 — 소스·반찬 제조실 연구개발 관리 (단순화 구조)
// 탭 2개: 품목(목록↔상세: 공정 체크시트 + 항목별 메모/이슈 + 자동 진행보고 + 계획일정) / 캘린더(R&D 전용)
// 체크시트: 항목마다 메모(이슈) 가능, 현재 단계 전체 체크 시 다음 단계 자동 진행, 진행/남은 공정은 자동 집계
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { salesDb } from '../firebase';
import {
  collection, getDocs, doc, setDoc, updateDoc, deleteDoc,
  query, orderBy,
} from 'firebase/firestore';
import {
  RndItem, RndCategory, RndPriority, RndStatus, RndProductType, User,
} from '../types';
import { useToast } from './Toast';
import { useConfirm } from './ConfirmModal';
import { shareKakao } from '../utils/kakao';
import {
  Plus, X, Edit2, Trash2, ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
  Printer, MessageCircle, FlaskConical, ClipboardList,
  CalendarDays, Factory, CheckSquare, ArrowLeft, MessageSquare,
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
const productTypeOf = (item: RndItem): RndProductType => item.productType ?? '제조품';

const stagePct = (stage: number) => RND_STAGES.find(s => s.stage === stage)?.pct ?? 0;
const stageLabel = (stage: number) => {
  const s = RND_STAGES.find(x => x.stage === stage);
  return s ? `${s.stage}. ${s.short}` : '-';
};

// ── 공정 체크시트 ───────────────────────────────────────────
type ChecklistEntry = { stage: number; text: string; done: boolean; doneAt?: string; memo?: string; memoAt?: string };
// checklist 없으면 공통 템플릿 + 구버전 stageChecks에서 마이그레이션
const buildChecklist = (item: RndItem): ChecklistEntry[] =>
  (item.checklist && item.checklist.length > 0)
    ? item.checklist
    : RND_STAGES.flatMap(s => s.subs.map((text, i) => ({
        stage: s.stage, text, done: !!item.stageChecks?.[`${s.stage}-${i}`],
      })));

const stageCheckProgress = (item: RndItem): { done: number; total: number } => {
  const entries = buildChecklist(item).filter(e => e.stage === item.stage);
  return { done: entries.filter(e => e.done).length, total: entries.length };
};
const issueCount = (item: RndItem) => buildChecklist(item).filter(e => e.memo && e.memo.trim()).length;

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
  const [note, setNote] = useState(item?.note ?? '');

  const save = () => name.trim() && onSave({
    name: name.trim(), productType, category, assignee: assignee.trim() || undefined, priority,
    startDate: startDate || undefined, targetDate: targetDate || undefined,
    stage, status, note: note.trim() || undefined,
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
          <label className={labelCls}>시작일 <span className="text-stone-400 font-normal">— 캘린더 표시</span></label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>목표 완료일 <span className="text-stone-400 font-normal">— D-Day·캘린더</span></label>
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

// ── 체크 항목 1줄 (체크 + 메모/이슈) ────────────────────────
function CheckRow({ entry, editMode, onToggle, onSaveMemo, onDelete }: {
  entry: ChecklistEntry; editMode: boolean;
  onToggle: () => void; onSaveMemo: (memo: string) => void; onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(entry.memo ?? '');
  useEffect(() => { setDraft(entry.memo ?? ''); }, [entry.memo]);
  const hasMemo = !!(entry.memo && entry.memo.trim());

  return (
    <div className="group">
      <div className="flex items-center gap-1.5">
        <label className="flex items-center gap-2 cursor-pointer flex-1 min-w-0">
          <input type="checkbox" checked={entry.done} onChange={onToggle}
            className="w-3.5 h-3.5 accent-stone-800 dark:accent-stone-200 shrink-0" />
          <span className={`text-[11px] ${entry.done ? 'text-stone-400 line-through' : 'text-stone-700 dark:text-stone-300'}`}>{entry.text}</span>
        </label>
        <button onClick={() => setOpen(o => !o)} title="메모 / 이슈"
          className={`p-0.5 shrink-0 ${hasMemo ? 'text-amber-500' : 'text-stone-300 hover:text-stone-500 opacity-0 group-hover:opacity-100'}`}>
          <MessageSquare size={12} />
        </button>
        {editMode && (
          <button onClick={onDelete} className="p-0.5 text-stone-300 hover:text-red-500 shrink-0"><X size={11} /></button>
        )}
      </div>
      {hasMemo && !open && (
        <p onClick={() => setOpen(true)} className="ml-5 text-[10px] text-amber-700 dark:text-amber-400 cursor-pointer whitespace-pre-wrap">
          ⚑ {entry.memo}
        </p>
      )}
      {open && (
        <textarea value={draft} onChange={e => setDraft(e.target.value)}
          onBlur={() => { if ((draft.trim()) !== (entry.memo ?? '').trim()) onSaveMemo(draft); }}
          rows={2} autoFocus placeholder="이슈·메모 입력 (자동 저장)"
          className="ml-5 mt-1 w-[calc(100%-1.25rem)] px-2 py-1 text-[11px] border border-stone-200 dark:border-stone-600 rounded-sm bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 focus:outline-none focus:ring-1 focus:ring-stone-400" />
      )}
    </div>
  );
}

// ── 계획 일정 추가 입력 ─────────────────────────────────────
function ScheduleAddForm({ onAdd }: { onAdd: (date: string, label: string) => void }) {
  const [date, setDate] = useState(todayYMD());
  const [label, setLabel] = useState('');
  const submit = () => { if (date && label.trim()) { onAdd(date, label.trim()); setLabel(''); } };
  return (
    <div className="flex items-center gap-1.5">
      <input type="date" value={date} onChange={e => setDate(e.target.value)}
        className="text-[11px] border border-stone-200 dark:border-stone-600 rounded-sm px-1.5 py-1 bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200 focus:outline-none" />
      <input value={label} onChange={e => setLabel(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') submit(); }}
        placeholder="일정 내용 (예: 매장 테스트)"
        className="flex-1 text-[11px] border border-stone-200 dark:border-stone-600 rounded-sm px-2 py-1 bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 focus:outline-none" />
      <button onClick={submit} disabled={!label.trim()}
        className="shrink-0 p-1 text-stone-400 hover:text-stone-700 disabled:opacity-30"><Plus size={13} /></button>
    </div>
  );
}

// ── 메인 RndView ───────────────────────────────────────────
type RndTab = 'items' | 'calendar';

export function RndView({ currentUser: _currentUser }: { currentUser: User }) {
  const toast = useToast();
  const { confirm } = useConfirm();

  const [items, setItems] = useState<RndItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<RndTab>('items');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  const [showItemForm, setShowItemForm] = useState(false);
  const [editingItem, setEditingItem] = useState<RndItem | null>(null);
  const [sendingItem, setSendingItem] = useState<RndItem | null>(null);
  const [checklistEditMode, setChecklistEditMode] = useState(false);
  const [statusFilter, setStatusFilter] = useState<RndStatus | 'all'>('진행중');
  const [calMonth, setCalMonth] = useState(todayYMD().slice(0, 7));

  // ── 로드 ───────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const itemSnap = await getDocs(query(collection(salesDb, 'rnd_items'), orderBy('order')));
      setItems(itemSnap.docs.map(d => ({ id: d.id, ...d.data() } as RndItem)));
    } catch (e) { console.error('RndView loadAll error:', e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

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
    const ok = await confirm({ title: '품목 삭제', message: `"${item.name}" 품목을 삭제합니다. 체크시트·메모·일정이 모두 삭제됩니다. 계속할까요?`, confirmLabel: '삭제', variant: 'danger' });
    if (!ok) return;
    try {
      await deleteDoc(doc(salesDb, 'rnd_items', item.id));
      if (selectedItemId === item.id) setSelectedItemId(null);
      toast.success('삭제됨');
      await loadAll();
    } catch { toast.error('삭제 실패'); }
  };

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

  const handleInlineUpdate = async (item: RndItem, patch: Partial<Pick<RndItem, 'stage' | 'status'>>) => {
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, ...patch } : i));
    try {
      await updateDoc(doc(salesDb, 'rnd_items', item.id), { ...patch, updatedAt: ts() });
    } catch { toast.error('저장 실패'); await loadAll(); }
  };

  // ── 공정 체크시트 (즉시 저장 + 단계 자동 진행) ──────────
  const saveChecklist = async (item: RndItem, checklist: ChecklistEntry[], newStage?: number) => {
    // Firestore는 배열 내부 객체의 undefined 값도 거부 → 항목별로 undefined 필드 제거
    const cleaned = checklist.map(e => scrub(e as unknown as Record<string, unknown>));
    const patch: Record<string, unknown> = { checklist: cleaned, updatedAt: ts() };
    if (newStage != null) patch.stage = newStage;
    setItems(prev => prev.map(i => i.id === item.id
      ? { ...i, checklist, ...(newStage != null ? { stage: newStage } : {}) }
      : i));
    try {
      await updateDoc(doc(salesDb, 'rnd_items', item.id), patch);
    } catch { toast.error('체크시트 저장 실패'); await loadAll(); }
  };

  const toggleCheck = (item: RndItem, index: number) => {
    const before = buildChecklist(item);
    const nowChecked = !before[index].done;
    const cl = before.map((e, i) => i === index
      ? { ...e, done: nowChecked, doneAt: nowChecked ? todayYMD() : undefined }
      : e);

    let newStage = item.stage;
    if (nowChecked) {
      const stageDone = (st: number) => cl.filter(e => e.stage === st).every(e => e.done);
      while (newStage < 8 && stageDone(newStage)) newStage++;
      if (newStage === 8 && stageDone(8)) {
        toast.success('8단계 공정 항목 전부 완료 — 상태를 완료로 바꾸고 제조실 이관을 진행하세요');
      } else if (newStage !== item.stage) {
        toast.success(`${stageLabel(item.stage)} 완료 → ${stageLabel(newStage)} 자동 진행`);
      }
    }
    saveChecklist(item, cl, newStage !== item.stage ? newStage : undefined);
  };

  const setCheckMemo = (item: RndItem, index: number, memo: string) =>
    saveChecklist(item, buildChecklist(item).map((e, i) => i === index
      ? { ...e, memo: memo.trim() || undefined, memoAt: memo.trim() ? todayYMD() : undefined }
      : e));

  const addCheckSub = (item: RndItem, stage: number, text: string) => {
    const cl = [...buildChecklist(item)];
    let insertAt = cl.length;
    cl.forEach((e, i) => { if (e.stage === stage) insertAt = i + 1; });
    cl.splice(insertAt, 0, { stage, text, done: false });
    saveChecklist(item, cl);
  };

  const deleteCheckSub = (item: RndItem, index: number) =>
    saveChecklist(item, buildChecklist(item).filter((_, i) => i !== index));

  // ── 계획 일정 (캘린더 연동) ─────────────────────────────
  const addSchedule = async (item: RndItem, date: string, label: string) => {
    const schedule = [...(item.schedule ?? []), { id: genId('rs'), date, label }].sort((a, b) => a.date.localeCompare(b.date));
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, schedule } : i));
    try { await updateDoc(doc(salesDb, 'rnd_items', item.id), { schedule, updatedAt: ts() }); }
    catch { toast.error('일정 저장 실패'); await loadAll(); }
  };
  const deleteSchedule = async (item: RndItem, id: string) => {
    const schedule = (item.schedule ?? []).filter(s => s.id !== id);
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, schedule } : i));
    try { await updateDoc(doc(salesDb, 'rnd_items', item.id), { schedule, updatedAt: ts() }); }
    catch { toast.error('일정 삭제 실패'); await loadAll(); }
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

  // 자동 진행 보고 (선택 품목): 진행사항 / 남은 공정 / 이슈
  const report = useMemo(() => {
    if (!selectedItem) return null;
    const cl = buildChecklist(selectedItem);
    const doneEntries = cl.filter(e => e.done);
    const remainByStage = RND_STAGES
      .map(s => ({ stage: s, remain: cl.filter(e => e.stage === s.stage && !e.done) }))
      .filter(x => x.remain.length > 0);
    const issues = cl.filter(e => e.memo && e.memo.trim());
    return { doneCount: doneEntries.length, total: cl.length, remainByStage, issues };
  }, [selectedItem]);

  // 캘린더 이벤트 집계
  const calEvents = useMemo(() => {
    const map = new Map<string, { itemId: string; label: string; type: 'start' | 'target' | 'plan' }[]>();
    const push = (date: string, ev: { itemId: string; label: string; type: 'start' | 'target' | 'plan' }) => {
      if (!date.startsWith(calMonth)) return;
      if (!map.has(date)) map.set(date, []);
      map.get(date)!.push(ev);
    };
    items.forEach(it => {
      if (it.status === '중단') return;
      if (it.startDate) push(it.startDate, { itemId: it.id, label: `${it.name} 시작`, type: 'start' });
      if (it.targetDate) push(it.targetDate, { itemId: it.id, label: `${it.name} 목표완료`, type: 'target' });
      (it.schedule ?? []).forEach(s => push(s.date, { itemId: it.id, label: `${it.name} · ${s.label}`, type: 'plan' }));
    });
    return map;
  }, [items, calMonth]);

  // ── 카톡 공유 (자동 진행 현황) ──────────────────────────
  const shareBoard = () => {
    const active = items.filter(i => i.status !== '중단');
    const lines = active.map(i => {
      const d = i.status !== '완료' ? dday(i.targetDate) : null;
      const cl = buildChecklist(i);
      const remain = cl.filter(e => e.stage === i.stage && !e.done).map(e => e.text);
      const issues = cl.filter(e => e.memo && e.memo.trim());
      let s = `■ ${i.name} — ${stageLabel(i.stage)} ${stagePct(i.stage)}%${d != null ? ` (${fmtDday(d)})` : ''}${i.status !== '진행중' ? ` [${i.status}]` : ''}`;
      if (remain.length) s += `\n  남은: ${remain.join(', ')}`;
      issues.forEach(e => { s += `\n  ⚑ ${e.text}: ${e.memo}`; });
      return s;
    });
    const today = new Date();
    shareKakao({
      title: `R&D 진행 현황 — ${today.getMonth() + 1}/${today.getDate()}`,
      body: [`진행중 ${summary.ongoing} · 완료 ${summary.done} · 평균 ${summary.avgPct}%`, '', ...lines].join('\n'),
      onSuccess: msg => toast.success(msg), onError: msg => toast.error(msg),
    });
  };

  // ── 렌더 ───────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <div className="w-6 h-6 border-2 border-stone-300 border-t-stone-800 rounded-full animate-spin" />
    </div>
  );

  const cellCls = 'px-2 py-2 border-b border-stone-100 dark:border-stone-800 text-xs text-stone-700 dark:text-stone-300';
  const printCell = 'border border-stone-400 px-1 py-1 align-top';

  // 캘린더 그리드 셀 계산
  const [cy, cm] = calMonth.split('-').map(Number);
  const firstBlanks = (new Date(cy, cm - 1, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(cy, cm, 0).getDate();
  const calCells: (number | null)[] = [
    ...Array(firstBlanks).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (calCells.length % 7 !== 0) calCells.push(null);
  const calWeeks: (number | null)[][] = [];
  for (let i = 0; i < calCells.length; i += 7) calWeeks.push(calCells.slice(i, i + 7));
  const EV_COLOR: Record<'start' | 'target' | 'plan', string> = {
    start: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    target: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    plan: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  };

  return (
    <div>
      {/* 화면 UI — 인쇄 시 display:none으로 접어 인쇄영역만 남김(빈 페이지 방지) */}
      <div className="print:hidden">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-black text-stone-900 dark:text-white flex items-center gap-2">
            <FlaskConical size={18} /> R&D 관리대장
          </h1>
          <p className="text-sm text-stone-500 dark:text-stone-400 mt-0.5">
            품목별 공정 체크시트 · 항목별 이슈 메모 · 계획은 캘린더 자동 생성
          </p>
        </div>
        <div className="flex items-center gap-2">
          {tab === 'items' && !selectedItem && (
            <button onClick={shareBoard} disabled={items.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400 text-xs font-bold rounded-sm hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors disabled:opacity-40">
              <MessageCircle size={12} /> 카톡 복사
            </button>
          )}
          <button onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-2 border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400 text-xs font-bold rounded-sm hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors">
            <Printer size={12} /> 인쇄
          </button>
          {tab === 'items' && !selectedItem && (
            <button onClick={() => { setEditingItem(null); setShowItemForm(true); }}
              className="flex items-center gap-1.5 px-3 py-2 bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-xs font-bold rounded-sm hover:bg-stone-700 transition-colors">
              <Plus size={12} /> 품목 등록
            </button>
          )}
        </div>
      </div>

      {/* 탭 */}
      <div className="flex items-center gap-1 border-b border-stone-200 dark:border-stone-700 mb-4">
        {([
          { id: 'items' as RndTab, label: '품목', icon: <ClipboardList size={13} /> },
          { id: 'calendar' as RndTab, label: '캘린더', icon: <CalendarDays size={13} /> },
        ]).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold border-b-2 -mb-px transition-colors ${
              tab === t.id
                ? 'border-stone-800 dark:border-stone-300 text-stone-900 dark:text-white'
                : 'border-transparent text-stone-400 hover:text-stone-700 dark:hover:text-stone-300'
            }`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── 탭 1: 품목 상세 ── */}
      {tab === 'items' && selectedItem && report && (
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
            {/* 좌: 공정 체크시트 */}
            <div className="border border-stone-200 dark:border-stone-700 rounded-sm bg-white dark:bg-stone-900">
              <div className="flex items-center justify-between px-3 py-2 border-b-[3px] border-double border-stone-800 dark:border-stone-400">
                <h3 className="text-xs font-black text-stone-900 dark:text-white flex items-center gap-1.5">
                  <CheckSquare size={13} /> 공정 체크시트
                  <span className="text-[9px] font-bold text-stone-400">단계 전체 체크 시 자동 진행 · 아이콘으로 항목별 메모</span>
                </h3>
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
                          <CheckRow key={e.idx} entry={e} editMode={checklistEditMode}
                            onToggle={() => toggleCheck(selectedItem, e.idx)}
                            onSaveMemo={memo => setCheckMemo(selectedItem, e.idx, memo)}
                            onDelete={() => deleteCheckSub(selectedItem, e.idx)} />
                        ))}
                        {checklistEditMode && <StageAddInput onAdd={text => addCheckSub(selectedItem, s.stage, text)} />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 우: 자동 진행 보고 + 계획 일정 */}
            <div className="space-y-4">
              <div className="border border-stone-200 dark:border-stone-700 rounded-sm bg-white dark:bg-stone-900">
                <div className="px-3 py-2 border-b-[3px] border-double border-stone-800 dark:border-stone-400">
                  <h3 className="text-xs font-black text-stone-900 dark:text-white flex items-center gap-1.5">
                    <ClipboardList size={13} /> 진행 보고 <span className="text-[9px] font-bold text-stone-400">(체크 상태에서 자동 생성)</span>
                  </h3>
                </div>
                <div className="p-3 space-y-2.5 text-[11px]">
                  <div>
                    <span className="font-black text-stone-500 dark:text-stone-400">진행사항 </span>
                    <span className="text-stone-700 dark:text-stone-300">
                      {stageLabel(selectedItem.stage)} 진행 중 · 전체 {report.doneCount}/{report.total} 완료 ({stagePct(selectedItem.stage)}%)
                    </span>
                  </div>
                  <div>
                    <p className="font-black text-stone-500 dark:text-stone-400 mb-0.5">남은 공정</p>
                    {report.remainByStage.length === 0 ? (
                      <p className="text-emerald-600 dark:text-emerald-400">모든 공정 완료 🎉</p>
                    ) : (
                      <ul className="space-y-0.5">
                        {report.remainByStage.map(({ stage, remain }) => (
                          <li key={stage.stage} className="text-stone-700 dark:text-stone-300">
                            <span className="font-bold text-stone-500 dark:text-stone-400">{stage.stage}. {stage.short}:</span> {remain.map(r => r.text).join(', ')}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  {report.issues.length > 0 && (
                    <div>
                      <p className="font-black text-stone-500 dark:text-stone-400 mb-0.5">이슈사항</p>
                      <ul className="space-y-0.5">
                        {report.issues.map((e, i) => (
                          <li key={i} className="text-amber-700 dark:text-amber-400 whitespace-pre-wrap">⚑ {e.text}: {e.memo}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>

              {/* 계획 일정 */}
              <div className="border border-stone-200 dark:border-stone-700 rounded-sm bg-white dark:bg-stone-900">
                <div className="px-3 py-2 border-b-[3px] border-double border-stone-800 dark:border-stone-400">
                  <h3 className="text-xs font-black text-stone-900 dark:text-white flex items-center gap-1.5">
                    <CalendarDays size={13} /> 계획 일정 <span className="text-[9px] font-bold text-stone-400">(캘린더 탭에 자동 표시)</span>
                  </h3>
                </div>
                <div className="p-3 space-y-2">
                  <div className="flex items-center gap-3 text-[11px] text-stone-500 dark:text-stone-400">
                    {selectedItem.startDate && <span>시작 <b className="text-blue-600 dark:text-blue-400">{selectedItem.startDate}</b></span>}
                    {selectedItem.targetDate && <span>목표완료 <b className="text-red-600 dark:text-red-400">{selectedItem.targetDate}</b></span>}
                    {!selectedItem.startDate && !selectedItem.targetDate && <span className="text-stone-400">시작·목표일은 품목 수정에서 입력</span>}
                  </div>
                  {(selectedItem.schedule ?? []).length > 0 && (
                    <ul className="space-y-1">
                      {(selectedItem.schedule ?? []).map(s => (
                        <li key={s.id} className="flex items-center gap-2 text-[11px] group">
                          <span className="font-bold text-stone-500 dark:text-stone-400 w-12 shrink-0">{fmtDateShort(s.date)}</span>
                          <span className="flex-1 text-stone-700 dark:text-stone-300">{s.label}</span>
                          <button onClick={() => deleteSchedule(selectedItem, s.id)} className="p-0.5 text-stone-300 hover:text-red-500 opacity-0 group-hover:opacity-100"><X size={11} /></button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <ScheduleAddForm onAdd={(date, label) => addSchedule(selectedItem, date, label)} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 탭 1: 품목 목록 ── */}
      {tab === 'items' && !selectedItem && (
        <div>
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
              <table className="w-full min-w-[1080px]">
                <thead>
                  <tr className="bg-stone-50 dark:bg-stone-800/50">
                    {['No', '품목명', '구분', '카테고리', '담당자', '우선순위', '시작일', '목표일', '현재 단계', 'D-Day', '진행률', '상태', '이슈', ''].map((h, i) => (
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
                    const issues = issueCount(item);
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
                        <td className={cellCls}>
                          {issues > 0
                            ? <button onClick={() => setSelectedItemId(item.id)} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-sm text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"><MessageSquare size={9} /> {issues}</button>
                            : <span className="text-stone-300">-</span>}
                        </td>
                        <td className={`${cellCls} whitespace-nowrap`}>
                          <div className="flex items-center gap-0.5">
                            <button onClick={() => setSelectedItemId(item.id)} title="공정 체크시트 · 보고 · 일정"
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

      {/* ── 탭 2: R&D 전용 캘린더 ── */}
      {tab === 'calendar' && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <button onClick={() => { const d = new Date(cy, cm - 2, 1); setCalMonth(toYMD(d).slice(0, 7)); }}
              className="p-1.5 border border-stone-200 dark:border-stone-700 rounded-sm text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800"><ChevronLeft size={13} /></button>
            <span className="text-sm font-black text-stone-900 dark:text-white">{cy}년 {cm}월</span>
            <button onClick={() => { const d = new Date(cy, cm, 1); setCalMonth(toYMD(d).slice(0, 7)); }}
              className="p-1.5 border border-stone-200 dark:border-stone-700 rounded-sm text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800"><ChevronRight size={13} /></button>
            <button onClick={() => setCalMonth(todayYMD().slice(0, 7))}
              className="px-2 py-1 text-[11px] font-bold text-stone-500 border border-stone-200 dark:border-stone-700 rounded-sm hover:bg-stone-100 dark:hover:bg-stone-800">이번 달</button>
            <span className="text-[11px] text-stone-400 flex items-center gap-2 ml-2">
              <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-blue-400" />시작</span>
              <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-red-400" />목표완료</span>
              <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-400" />계획</span>
            </span>
          </div>

          <div className="border border-stone-200 dark:border-stone-700 rounded-sm overflow-hidden bg-white dark:bg-stone-900">
            <div className="grid grid-cols-7">
              {['월', '화', '수', '목', '금', '토', '일'].map((d, i) => (
                <div key={d} className={`px-2 py-1.5 text-[10px] font-bold text-center border-b border-stone-200 dark:border-stone-700 ${i >= 5 ? 'text-stone-400' : 'text-stone-500'}`}>{d}</div>
              ))}
              {calCells.map((day, i) => {
                const ymd = day ? `${calMonth}-${String(day).padStart(2, '0')}` : '';
                const evs = day ? (calEvents.get(ymd) ?? []) : [];
                const isToday = ymd === todayYMD();
                return (
                  <div key={i} className={`min-h-[92px] p-1 border-b border-r border-stone-100 dark:border-stone-800 ${(i % 7) >= 5 ? 'bg-stone-50/50 dark:bg-stone-800/20' : ''}`}>
                    {day && (
                      <>
                        <p className={`text-[10px] font-bold mb-0.5 ${isToday ? 'inline-block px-1 rounded-sm bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900' : 'text-stone-400'}`}>{day}</p>
                        <div className="space-y-0.5">
                          {evs.map((ev, j) => (
                            <button key={j} onClick={() => { setTab('items'); setSelectedItemId(ev.itemId); }}
                              title={ev.label}
                              className={`block w-full text-left px-1 py-0.5 rounded-sm text-[9px] font-bold truncate hover:opacity-80 ${EV_COLOR[ev.type]}`}>
                              {ev.label}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      </div>{/* 화면 UI 끝 (print:hidden) */}

      {/* ── 인쇄 전용 영역 ── */}
      <div id="rnd-print-area" className="hidden print:block bg-white text-black p-2">
        {tab === 'items' && selectedItem && report ? (
          <>
            <h1 className="text-lg font-black border-b-[3px] border-double border-black pb-1 mb-1">새모양 F&B | R&D 공정 체크시트</h1>
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
                    {s.stage}. {s.label} ({entries.filter(e => e.done).length}/{entries.length}){s.stage === selectedItem.stage && ' ◀ 현재 단계'}
                  </p>
                  {entries.map((e, i) => (
                    <p key={i} className="text-[10px] pl-2">
                      {e.done ? '☑' : '☐'} {e.text}{e.memo ? `  ⚑ ${e.memo}` : ''}
                    </p>
                  ))}
                </div>
              );
            })}
          </>
        ) : tab === 'calendar' ? (
          <>
            <h1 className="text-lg font-black border-b-[3px] border-double border-black pb-1 mb-1">새모양 F&B | R&D 캘린더 — {cy}년 {cm}월</h1>
            <p className="text-[10px] text-stone-600 mb-2">출력일: {todayYMD()} · ▶시작 ★목표완료 ·계획</p>
            <table className="w-full table-fixed border-collapse text-[9px]">
              <thead>
                <tr>
                  {['월', '화', '수', '목', '금', '토', '일'].map(d => (
                    <th key={d} className={`${printCell} text-center font-bold bg-stone-100`}>{d}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {calWeeks.map((week, wi) => (
                  <tr key={wi}>
                    {week.map((day, di) => {
                      const ymd = day ? `${calMonth}-${String(day).padStart(2, '0')}` : '';
                      const evs = day ? (calEvents.get(ymd) ?? []) : [];
                      return (
                        <td key={di} className={`${printCell} h-16 w-[14.28%]`}>
                          {day && (
                            <>
                              <p className="font-bold">{day}</p>
                              {evs.map((ev, j) => (
                                <p key={j} className="break-words leading-tight">
                                  {ev.type === 'start' ? '▶ ' : ev.type === 'target' ? '★ ' : '· '}{ev.label}
                                </p>
                              ))}
                            </>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : (
          <>
            <h1 className="text-lg font-black border-b-[3px] border-double border-black pb-1 mb-1">새모양 F&B | R&D 관리대장</h1>
            <p className="text-[10px] text-stone-600 mb-3">출력일: {todayYMD()} · 전체 {summary.total} · 진행중 {summary.ongoing} · 완료 {summary.done} · 평균 진행률 {summary.avgPct}%</p>
            <table className="w-full table-fixed border-collapse text-[10px]">
              <colgroup>
                <col className="w-6" /><col className="w-24" /><col className="w-12" /><col className="w-12" /><col className="w-12" />
                <col className="w-14" /><col className="w-14" /><col className="w-20" /><col className="w-12" /><col className="w-10" /><col className="w-10" /><col />
              </colgroup>
              <thead>
                <tr>
                  {['No', '품목명', '구분', '카테고리', '담당자', '시작일', '목표일', '현재 단계', 'D-Day', '진행률', '상태', '남은 공정 / 이슈'].map((h, i) => (
                    <th key={i} className={`${printCell} text-left font-bold bg-stone-100`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => {
                  const d = item.status !== '완료' ? dday(item.targetDate) : null;
                  const cl = buildChecklist(item);
                  const remain = cl.filter(e => e.stage === item.stage && !e.done).map(e => e.text).join(', ');
                  const issues = cl.filter(e => e.memo && e.memo.trim()).map(e => `⚑${e.text}:${e.memo}`).join(' ');
                  return (
                    <tr key={item.id}>
                      <td className={printCell}>{idx + 1}</td>
                      <td className={`${printCell} font-bold break-words`}>{item.name}</td>
                      <td className={printCell}>{productTypeOf(item)}</td>
                      <td className={printCell}>{item.category}</td>
                      <td className={printCell}>{item.assignee ?? ''}</td>
                      <td className={printCell}>{item.startDate ?? ''}</td>
                      <td className={printCell}>{item.targetDate ?? ''}</td>
                      <td className={printCell}>{stageLabel(item.stage)}</td>
                      <td className={printCell}>{d != null ? fmtDday(d) : ''}</td>
                      <td className={printCell}>{stagePct(item.stage)}%</td>
                      <td className={printCell}>{item.status}</td>
                      <td className={`${printCell} break-words`}>{remain}{issues ? `  ${issues}` : ''}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}
      </div>

      {/* ── 모달 ── */}
      {showItemForm && (
        <ItemFormModal item={editingItem ?? undefined} onSave={handleSaveItem}
          onClose={() => { setShowItemForm(false); setEditingItem(null); }} />
      )}
      {sendingItem && (
        <SendToFactoryModal item={sendingItem}
          onSave={data => handleSendToFactory(sendingItem, data)}
          onClose={() => setSendingItem(null)} />
      )}
    </div>
  );
}
