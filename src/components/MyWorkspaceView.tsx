import React, { useState, useEffect, useRef } from 'react';
import {
  Plus, Trash2, Pin, CheckSquare, Square, ChevronRight,
  Calendar, FileText, ClipboardList, Zap, StickyNote,
  Clock, AlertCircle, Pencil, Check, X, AlertTriangle,
} from 'lucide-react';
import { salesDb } from '../firebase';
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc,
  doc, query, where, orderBy,
} from 'firebase/firestore';
import { useToast } from './Toast';
import { useConfirm } from './ConfirmModal';
import type { User, Task, CalendarEvent, SidebarSection, BrandId } from '../types';

interface Memo {
  id: string;
  uid: string;
  content: string;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
}

// 개인 단발성 할 일 — 메모(기록)나 내 담당 업무(공식 배정)와는 별개로,
// 본인이 직접 적고 체크하는 가벼운 일회성 체크리스트
interface TodoItem {
  id: string;
  uid: string;
  text: string;
  done: boolean;
  createdAt: string;
  updatedAt: string;
}

function scrub<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  ) as T;
}

function toYMD(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function MiniCalendar({ markedDates }: { markedDates: Set<string> }) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const todayStr = toYMD(now);
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = Array(firstDay).fill(null);
  for (let i = 1; i <= daysInMonth; i++) cells.push(toYMD(new Date(year, month, i)));

  return (
    <div className="px-4 py-3">
      <p className="text-center text-[11px] font-black text-stone-500 dark:text-stone-400 mb-2">{year}년 {month + 1}월</p>
      <div className="grid grid-cols-7 gap-1 text-center text-[9px] font-bold text-stone-400 mb-1">
        <span className="text-rose-400">일</span><span>월</span><span>화</span><span>수</span><span>목</span><span>금</span><span className="text-blue-400">토</span>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (!d) return <div key={i} className="h-7" />;
          const isToday = d === todayStr;
          const hasEvent = markedDates.has(d);
          return (
            <div key={i} className="h-7 flex flex-col items-center justify-center relative">
              <span className={`w-6 h-6 flex items-center justify-center rounded-full text-[10px] font-bold ${
                isToday ? 'bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900' : 'text-stone-600 dark:text-stone-300'
              }`}>
                {Number(d.slice(-2))}
              </span>
              {hasEvent && !isToday && <span className="absolute bottom-0 w-1 h-1 rounded-full bg-blue-400" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface Props {
  currentUser: User;
  onNavigate: (brandId: BrandId | null, section: SidebarSection) => void;
  onOpenQuickInput: () => void;
}

export function MyWorkspaceView({ currentUser, onNavigate, onOpenQuickInput }: Props) {
  const toast = useToast();
  const { confirm } = useConfirm();

  const today = toYMD(new Date());
  const [employeeId, setEmployeeId] = useState<string | null | undefined>(undefined);
  const [myTasks, setMyTasks] = useState<Task[]>([]);
  const [todayEvents, setTodayEvents] = useState<CalendarEvent[]>([]);
  const [monthEventDates, setMonthEventDates] = useState<Set<string>>(new Set());
  const [memos, setMemos] = useState<Memo[]>([]);
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [newTodo, setNewTodo] = useState('');
  const [addingTodo, setAddingTodo] = useState(false);
  const todoRef = useRef<HTMLInputElement>(null);
  const [todayMorning, setTodayMorning] = useState<boolean | null>(null);
  const [todayEvening, setTodayEvening] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  const [newMemo, setNewMemo] = useState('');
  const [addingMemo, setAddingMemo] = useState(false);
  const memoRef = useRef<HTMLTextAreaElement>(null);

  const [editingMemoId, setEditingMemoId] = useState<string | null>(null);
  const [editingMemoContent, setEditingMemoContent] = useState('');
  const editingMemoRef = useRef<HTMLTextAreaElement>(null);

  // ── 데이터 로드 ──────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const empSnap = await getDocs(
          query(collection(salesDb, 'employees'), where('linkedUid', '==', currentUser.uid))
        );
        const empId = empSnap.empty ? null : empSnap.docs[0].id;
        setEmployeeId(empId);

        await Promise.all([
          (async () => {
            const snap = await getDocs(
              query(collection(salesDb, 'user_memos'), where('uid', '==', currentUser.uid))
            );
            const raw = snap.docs.map(d => ({ id: d.id, ...d.data() } as Memo));
            raw.sort((a, b) => {
              if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
              return a.createdAt > b.createdAt ? -1 : 1;
            });
            setMemos(raw);
          })(),
          (async () => {
            const snap = await getDocs(
              query(collection(salesDb, 'personal_todos'), where('uid', '==', currentUser.uid))
            );
            const raw = snap.docs.map(d => ({ id: d.id, ...d.data() } as TodoItem));
            raw.sort((a, b) => {
              if (a.done !== b.done) return a.done ? 1 : -1;
              return a.createdAt > b.createdAt ? -1 : 1;
            });
            setTodos(raw);
          })(),
          empId ? (async () => {
            const snap = await getDocs(
              query(collection(salesDb, 'tasks'), where('assigneeId', '==', empId))
            );
            const active = snap.docs
              .map(d => ({ id: d.id, ...d.data() } as Task))
              .filter(t => t.status === 'pending' || t.status === 'in_progress')
              .sort((a, b) => (a.dueDate ?? '9999') < (b.dueDate ?? '9999') ? -1 : 1);
            setMyTasks(active);
          })() : Promise.resolve(),
          (async () => {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const pastStr = toYMD(thirtyDaysAgo);
            const snap = await getDocs(
              query(collection(salesDb, 'calendar_events'),
                where('startDate', '>=', pastStr), orderBy('startDate'))
            );
            const visibleEvents = snap.docs.map(d => ({ id: d.id, ...d.data() } as CalendarEvent))
              .filter(e => e.visibility === 'all' || e.visibility === 'team' || (empId && e.employeeId === empId));
            setTodayEvents(visibleEvents.filter(e => e.startDate <= today && e.endDate >= today));

            // 이번 달 안에서 일정이 있는 날짜만 모아 미니 캘린더 점 표시용으로 사용 (추가 조회 없음)
            const now = new Date();
            const monthStart = toYMD(new Date(now.getFullYear(), now.getMonth(), 1));
            const monthEnd = toYMD(new Date(now.getFullYear(), now.getMonth() + 1, 0));
            const marked = new Set<string>();
            visibleEvents.forEach(e => {
              const start = e.startDate < monthStart ? monthStart : e.startDate;
              const end = e.endDate > monthEnd ? monthEnd : e.endDate;
              if (start > end) return;
              let cur = new Date(start + 'T00:00:00');
              const endD = new Date(end + 'T00:00:00');
              while (cur <= endD) { marked.add(toYMD(cur)); cur.setDate(cur.getDate() + 1); }
            });
            setMonthEventDates(marked);
          })(),
          empId ? (async () => {
            const snap = await getDocs(
              query(collection(salesDb, 'daily_reports'),
                where('date', '==', today),
                where('employeeId', '==', empId))
            );
            const reports = snap.docs.map(d => d.data());
            setTodayMorning(reports.some(r => r.type === 'morning'));
            setTodayEvening(reports.some(r => r.type === 'evening'));
          })() : Promise.resolve(),
        ]);
      } catch (err) {
        console.error(err);
        toast.error('데이터 로드 실패');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [currentUser.uid]);

  // ── 메모 추가 ─────────────────────────────────────────────
  const handleAddMemo = async () => {
    const content = newMemo.trim();
    if (!content) return;
    const now = new Date().toISOString();
    try {
      const ref = await addDoc(collection(salesDb, 'user_memos'), scrub({
        uid: currentUser.uid,
        content,
        isPinned: false,
        createdAt: now,
        updatedAt: now,
      }));
      setMemos(prev => [{ id: ref.id, uid: currentUser.uid, content, isPinned: false, createdAt: now, updatedAt: now }, ...prev]);
      setNewMemo('');
      setAddingMemo(false);
    } catch {
      toast.error('메모 저장 실패');
    }
  };

  // ── 메모 편집 ─────────────────────────────────────────────
  const startEditMemo = (memo: Memo) => {
    setEditingMemoId(memo.id);
    setEditingMemoContent(memo.content);
    setTimeout(() => {
      editingMemoRef.current?.focus();
      const len = memo.content.length;
      editingMemoRef.current?.setSelectionRange(len, len);
    }, 50);
  };

  const handleSaveEdit = async (memo: Memo) => {
    const content = editingMemoContent.trim();
    if (!content) return;
    if (content === memo.content) { setEditingMemoId(null); return; }
    const now = new Date().toISOString();
    try {
      await updateDoc(doc(salesDb, 'user_memos', memo.id), { content, updatedAt: now });
      setMemos(prev => prev.map(m => m.id === memo.id ? { ...m, content, updatedAt: now } : m));
      setEditingMemoId(null);
    } catch {
      toast.error('메모 수정 실패');
    }
  };

  const cancelEdit = () => setEditingMemoId(null);

  // ── 메모 삭제 ─────────────────────────────────────────────
  const handleDeleteMemo = async (memo: Memo) => {
    const ok = await confirm({ title: '메모 삭제', message: '이 메모를 삭제할까요?', confirmLabel: '삭제', variant: 'danger' });
    if (!ok) return;
    try {
      await deleteDoc(doc(salesDb, 'user_memos', memo.id));
      setMemos(prev => prev.filter(m => m.id !== memo.id));
    } catch {
      toast.error('메모 삭제 실패');
    }
  };

  // ── 메모 핀 토글 ──────────────────────────────────────────
  const handlePinMemo = async (memo: Memo) => {
    try {
      await updateDoc(doc(salesDb, 'user_memos', memo.id), { isPinned: !memo.isPinned, updatedAt: new Date().toISOString() });
      setMemos(prev => {
        const next = prev.map(m => m.id === memo.id ? { ...m, isPinned: !m.isPinned } : m);
        return next.sort((a, b) => {
          if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
          return a.createdAt > b.createdAt ? -1 : 1;
        });
      });
    } catch {
      toast.error('업데이트 실패');
    }
  };

  // ── 할 일 추가 ────────────────────────────────────────────
  const handleAddTodo = async () => {
    const text = newTodo.trim();
    if (!text) return;
    const now = new Date().toISOString();
    try {
      const ref = await addDoc(collection(salesDb, 'personal_todos'), scrub({
        uid: currentUser.uid, text, done: false, createdAt: now, updatedAt: now,
      }));
      setTodos(prev => [{ id: ref.id, uid: currentUser.uid, text, done: false, createdAt: now, updatedAt: now }, ...prev]);
      setNewTodo('');
    } catch {
      toast.error('할 일 저장 실패');
    }
  };

  // ── 할 일 완료 토글 ───────────────────────────────────────
  const handleToggleTodo = async (todo: TodoItem) => {
    const done = !todo.done;
    setTodos(prev => prev.map(t => t.id === todo.id ? { ...t, done } : t)
      .sort((a, b) => { if (a.done !== b.done) return a.done ? 1 : -1; return a.createdAt > b.createdAt ? -1 : 1; }));
    try {
      await updateDoc(doc(salesDb, 'personal_todos', todo.id), { done, updatedAt: new Date().toISOString() });
    } catch {
      toast.error('업데이트 실패');
      setTodos(prev => prev.map(t => t.id === todo.id ? { ...t, done: todo.done } : t));
    }
  };

  // ── 할 일 삭제 ────────────────────────────────────────────
  const handleDeleteTodo = async (todo: TodoItem) => {
    try {
      await deleteDoc(doc(salesDb, 'personal_todos', todo.id));
      setTodos(prev => prev.filter(t => t.id !== todo.id));
    } catch {
      toast.error('삭제 실패');
    }
  };

  // ── 업무 완료 처리 (confirm 없이 즉시 + undo 토스트) ───────
  const handleCompleteTask = async (task: Task) => {
    const prevStatus = task.status;
    setMyTasks(prev => prev.filter(t => t.id !== task.id));
    try {
      await updateDoc(doc(salesDb, 'tasks', task.id), { status: 'done', updatedAt: new Date().toISOString() });
      toast.success(`"${task.title}" 완료 처리됨`);
    } catch {
      setMyTasks(prev => [...prev, task].sort((a, b) => (a.dueDate ?? '9999') < (b.dueDate ?? '9999') ? -1 : 1));
      toast.error('업데이트 실패');
    }
  };

  const tasksByCriticality = myTasks.filter(t => t.dueDate && t.dueDate <= today);
  const upcomingTasks = myTasks.filter(t => !t.dueDate || t.dueDate > today);

  const getStatusBadge = (status: Task['status']) => {
    if (status === 'in_progress') return <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded-sm">진행중</span>;
    return <span className="text-[10px] font-bold text-stone-500 dark:text-stone-400 bg-stone-100 dark:bg-stone-800 px-1.5 py-0.5 rounded-sm">대기</span>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-6 h-6 border-2 border-stone-300 border-t-stone-800 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-16 animate-in fade-in duration-300">

      {/* ── 헤더 ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-stone-900 dark:text-stone-100 tracking-tight">내 업무공간</h1>
          <p className="text-[11px] text-stone-400 font-bold mt-0.5">{currentUser.name} · {today}</p>
        </div>
        <button
          onClick={onOpenQuickInput}
          className="flex items-center gap-1.5 px-3 py-2 bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-xs font-black rounded-sm hover:bg-stone-700 dark:hover:bg-stone-300 transition-colors"
        >
          <Zap size={13} /> 빠른 입력
          <kbd className="ml-1 text-[9px] opacity-60 font-mono bg-white/20 dark:bg-black/20 px-1 rounded">Ctrl+N</kbd>
        </button>
      </div>

      {/* ── 직원 미연결 경고 ── */}
      {employeeId === null && (
        <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3">
          <AlertTriangle size={15} className="text-amber-500 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">
            직원 정보가 연결되지 않았습니다. 담당 업무·업무보고 현황이 표시되지 않습니다. 관리자에게 직원 프로필 연동을 요청하세요.
          </p>
        </div>
      )}

      {/* ── 오늘 상태 바 ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: '오전 보고', icon: <ClipboardList size={14} />,
            value: todayMorning === null ? '—' : todayMorning ? '완료' : '미제출',
            ok: !!todayMorning, warn: todayMorning === false && employeeId !== null,
            onClick: () => onNavigate(null, 'daily'),
          },
          {
            label: '퇴근 보고', icon: <ClipboardList size={14} />,
            value: todayEvening === null ? '—' : todayEvening ? '완료' : '미제출',
            ok: !!todayEvening, warn: false,
            onClick: () => onNavigate(null, 'daily'),
          },
          {
            label: '오늘 일정', icon: <Calendar size={14} />,
            value: `${todayEvents.length}건`,
            ok: todayEvents.length === 0, warn: false,
            onClick: () => onNavigate(null, 'calendar'),
          },
          {
            label: '내 담당 업무', icon: <CheckSquare size={14} />,
            value: employeeId === null ? '—' : `${myTasks.length}건`,
            ok: myTasks.length === 0, warn: tasksByCriticality.length > 0,
            onClick: () => onNavigate(null, 'daily'),
          },
        ].map(s => (
          <button
            key={s.label}
            onClick={s.onClick}
            className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl px-4 py-3 text-left hover:border-stone-400 dark:hover:border-stone-500 transition-colors"
          >
            <div className="flex items-center gap-1.5 mb-1.5 text-stone-400">
              {s.icon}
              <span className="text-[10px] font-bold tracking-wide">{s.label}</span>
            </div>
            <p className={`text-lg font-black ${s.warn ? 'text-rose-600 dark:text-rose-400' : s.ok ? 'text-stone-400' : 'text-stone-900 dark:text-stone-100'}`}>
              {s.value}
            </p>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── 내 메모 ── */}
        <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between">
            <p className="text-[10px] font-black text-stone-400 tracking-widest uppercase flex items-center gap-1.5">
              <StickyNote size={11} /> 내 메모
            </p>
            <button
              onClick={() => { setAddingMemo(true); setTimeout(() => memoRef.current?.focus(), 50); }}
              className="p-1 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-sm transition-colors"
            >
              <Plus size={14} />
            </button>
          </div>

          {addingMemo && (
            <div className="px-4 pt-3">
              <textarea
                ref={memoRef}
                value={newMemo}
                onChange={e => setNewMemo(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleAddMemo();
                  if (e.key === 'Escape') { setAddingMemo(false); setNewMemo(''); }
                }}
                placeholder="메모 내용 입력... (Ctrl+Enter 저장)"
                rows={3}
                className="w-full text-xs px-3 py-2 border border-stone-300 dark:border-stone-600 rounded-sm bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:border-stone-600 dark:focus:border-stone-400 resize-none"
              />
              <div className="flex gap-2 mt-2 mb-3">
                <button onClick={handleAddMemo} className="px-3 py-1.5 bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-xs font-bold rounded-sm hover:bg-stone-700 dark:hover:bg-stone-300 transition-colors">저장</button>
                <button onClick={() => { setAddingMemo(false); setNewMemo(''); }} className="px-3 py-1.5 text-xs font-bold text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-sm transition-colors">취소</button>
              </div>
            </div>
          )}

          <div className="divide-y divide-stone-100 dark:divide-stone-800 max-h-72 overflow-y-auto">
            {memos.length === 0 && !addingMemo && (
              <div className="px-4 py-8 text-center">
                <StickyNote size={24} className="mx-auto text-stone-300 dark:text-stone-600 mb-2" />
                <p className="text-xs text-stone-400">메모가 없습니다. + 버튼으로 추가하세요.</p>
              </div>
            )}
            {memos.map(memo => (
              <div key={memo.id} className="group px-4 py-3 hover:bg-stone-50 dark:hover:bg-stone-800/50">
                {editingMemoId === memo.id ? (
                  /* 인라인 편집 모드 */
                  <div>
                    <textarea
                      ref={editingMemoRef}
                      value={editingMemoContent}
                      onChange={e => setEditingMemoContent(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSaveEdit(memo);
                        if (e.key === 'Escape') cancelEdit();
                      }}
                      rows={3}
                      className="w-full text-xs px-2 py-1.5 border border-blue-400 dark:border-blue-600 rounded-sm bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none resize-none"
                    />
                    <div className="flex gap-1.5 mt-1.5">
                      <button onClick={() => handleSaveEdit(memo)} className="flex items-center gap-1 px-2 py-1 bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-[10px] font-bold rounded-sm hover:bg-stone-700 transition-colors">
                        <Check size={10} /> 저장
                      </button>
                      <button onClick={cancelEdit} className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-700 rounded-sm transition-colors">
                        <X size={10} /> 취소
                      </button>
                    </div>
                  </div>
                ) : (
                  /* 읽기 모드 */
                  <div className="flex items-start gap-2">
                    <p
                      className="flex-1 text-xs text-stone-700 dark:text-stone-300 whitespace-pre-wrap leading-relaxed min-w-0 cursor-text"
                      onDoubleClick={() => startEditMemo(memo)}
                      title="더블클릭해서 편집"
                    >
                      {memo.isPinned && <Pin size={10} className="inline mr-1 text-amber-400 mb-0.5" />}
                      {memo.content}
                    </p>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button
                        onClick={() => startEditMemo(memo)}
                        className="p-1 rounded-sm text-stone-400 hover:text-blue-500 transition-colors"
                        title="편집"
                      >
                        <Pencil size={11} />
                      </button>
                      <button
                        onClick={() => handlePinMemo(memo)}
                        className={`p-1 rounded-sm transition-colors ${memo.isPinned ? 'text-amber-500' : 'text-stone-400 hover:text-stone-600 dark:hover:text-stone-300'}`}
                        title={memo.isPinned ? '핀 해제' : '핀 고정'}
                      >
                        <Pin size={12} />
                      </button>
                      <button onClick={() => handleDeleteMemo(memo)} className="p-1 text-stone-400 hover:text-rose-500 rounded-sm transition-colors">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── 내 담당 업무 ── */}
        <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between">
            <p className="text-[10px] font-black text-stone-400 tracking-widest uppercase flex items-center gap-1.5">
              <CheckSquare size={11} /> 내 담당 업무
              {myTasks.length > 0 && (
                <span className="ml-1 bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-[9px] font-black px-1.5 py-0.5 rounded-full">{myTasks.length}</span>
              )}
            </p>
            <button onClick={() => onNavigate(null, 'daily')} className="text-[10px] font-bold text-stone-400 hover:text-stone-700 dark:hover:text-stone-300 flex items-center gap-0.5">
              업무보고 <ChevronRight size={11} />
            </button>
          </div>

          <div className="divide-y divide-stone-100 dark:divide-stone-800 max-h-72 overflow-y-auto">
            {myTasks.length === 0 && (
              <div className="px-4 py-8 text-center">
                <CheckSquare size={24} className="mx-auto text-stone-300 dark:text-stone-600 mb-2" />
                <p className="text-xs text-stone-400">
                  {employeeId === null ? '직원 정보 미연결' : '담당 업무가 없습니다.'}
                </p>
              </div>
            )}

            {tasksByCriticality.length > 0 && (
              <div className="px-4 py-2 bg-rose-50 dark:bg-rose-900/10">
                <p className="text-[10px] font-black text-rose-500 flex items-center gap-1"><AlertCircle size={10} /> 기한 초과 / 오늘 마감</p>
              </div>
            )}

            {[...tasksByCriticality, ...upcomingTasks].map(task => (
              <div key={task.id} className="group flex items-start gap-3 px-4 py-3 hover:bg-stone-50 dark:hover:bg-stone-800/50">
                <button
                  onClick={() => handleCompleteTask(task)}
                  className="mt-0.5 shrink-0 text-stone-300 dark:text-stone-600 hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors"
                  title="완료 처리"
                >
                  <Square size={14} />
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-stone-800 dark:text-stone-200 truncate">{task.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {task.dueDate && (
                      <span className={`text-[10px] font-bold flex items-center gap-0.5 ${
                        task.dueDate <= today ? 'text-rose-500 dark:text-rose-400' : 'text-stone-400'
                      }`}>
                        <Clock size={9} /> {task.dueDate}
                      </span>
                    )}
                    {getStatusBadge(task.status)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── 할 일 (개인 단발성 체크리스트 — 메모·내 담당 업무와 별개) ── */}
        <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between">
            <p className="text-[10px] font-black text-stone-400 tracking-widest uppercase flex items-center gap-1.5">
              <CheckSquare size={11} /> 할 일
              {todos.filter(t => !t.done).length > 0 && (
                <span className="ml-1 bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-[9px] font-black px-1.5 py-0.5 rounded-full">{todos.filter(t => !t.done).length}</span>
              )}
            </p>
            <button
              onClick={() => { setAddingTodo(true); setTimeout(() => todoRef.current?.focus(), 50); }}
              className="p-1 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-sm transition-colors"
            >
              <Plus size={14} />
            </button>
          </div>

          {addingTodo && (
            <div className="px-4 pt-3 flex gap-2">
              <input
                ref={todoRef}
                type="text"
                value={newTodo}
                onChange={e => setNewTodo(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleAddTodo();
                  if (e.key === 'Escape') { setAddingTodo(false); setNewTodo(''); }
                }}
                onBlur={() => { if (!newTodo.trim()) setAddingTodo(false); }}
                placeholder="할 일 입력 후 Enter"
                className="flex-1 text-xs px-3 py-2 border border-stone-300 dark:border-stone-600 rounded-sm bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:border-stone-600 dark:focus:border-stone-400"
              />
            </div>
          )}

          <div className="divide-y divide-stone-100 dark:divide-stone-800 max-h-72 overflow-y-auto">
            {todos.length === 0 && !addingTodo && (
              <div className="px-4 py-8 text-center">
                <CheckSquare size={24} className="mx-auto text-stone-300 dark:text-stone-600 mb-2" />
                <p className="text-xs text-stone-400">단발성 할 일이 없습니다. + 버튼으로 추가하세요.</p>
              </div>
            )}
            {todos.map(todo => (
              <div key={todo.id} className="group flex items-start gap-2 px-4 py-2.5 hover:bg-stone-50 dark:hover:bg-stone-800/50">
                <button
                  onClick={() => handleToggleTodo(todo)}
                  className="mt-0.5 shrink-0 text-stone-300 dark:text-stone-600 hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors"
                  title={todo.done ? '완료 취소' : '완료 처리'}
                >
                  {todo.done ? <CheckSquare size={14} className="text-emerald-500" /> : <Square size={14} />}
                </button>
                <p className={`flex-1 text-xs ${todo.done ? 'line-through text-stone-400' : 'text-stone-800 dark:text-stone-200'}`}>{todo.text}</p>
                <button
                  onClick={() => handleDeleteTodo(todo)}
                  className="shrink-0 opacity-0 group-hover:opacity-100 text-stone-400 hover:text-rose-500 transition-colors"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── 오늘 일정 (항상 표시) ── */}
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between">
          <p className="text-[10px] font-black text-stone-400 tracking-widest uppercase flex items-center gap-1.5">
            <Calendar size={11} /> 오늘 일정
          </p>
          <button onClick={() => onNavigate(null, 'calendar')} className="text-[10px] font-bold text-stone-400 hover:text-stone-700 dark:hover:text-stone-300 flex items-center gap-0.5">
            캘린더 <ChevronRight size={11} />
          </button>
        </div>
        {todayEvents.length === 0 ? (
          <>
            <MiniCalendar markedDates={monthEventDates} />
            <p className="px-4 pb-4 text-center text-xs text-stone-400">오늘 일정이 없습니다.</p>
          </>
        ) : (
          <div className="divide-y divide-stone-100 dark:divide-stone-800">
            {todayEvents.map(evt => (
              <div key={evt.id} className="flex items-center gap-3 px-4 py-3">
                <div className={`w-2 h-2 rounded-full shrink-0 ${evt.color ? '' : 'bg-blue-400'}`} style={evt.color ? { backgroundColor: evt.color } : {}} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-stone-800 dark:text-stone-200 truncate">{evt.title}</p>
                  {!evt.allDay && evt.startTime && (
                    <p className="text-[10px] text-stone-400 font-bold">{evt.startTime}{evt.endTime ? ` ~ ${evt.endTime}` : ''}</p>
                  )}
                </div>
                {evt.allDay && <span className="text-[10px] font-bold text-stone-400 shrink-0">종일</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── 바로가기 ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: '업무보고 작성', icon: <FileText size={16} />, onClick: () => onNavigate(null, 'daily') },
          { label: '회의록', icon: <ClipboardList size={16} />, onClick: () => onNavigate(null, 'meetings') },
          { label: '캘린더', icon: <Calendar size={16} />, onClick: () => onNavigate(null, 'calendar') },
          { label: '결재보고서', icon: <CheckSquare size={16} />, onClick: () => onNavigate(null, 'reports') },
        ].map(item => (
          <button
            key={item.label}
            onClick={item.onClick}
            className="flex flex-col items-center gap-2 py-5 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl hover:border-stone-400 dark:hover:border-stone-500 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
          >
            <span className="text-stone-500 dark:text-stone-400">{item.icon}</span>
            <span className="text-[11px] font-bold text-stone-600 dark:text-stone-400">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
