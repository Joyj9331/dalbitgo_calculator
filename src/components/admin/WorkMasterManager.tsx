import React, { useState, useEffect, useRef } from 'react';
import { salesDb as db } from '../../firebase';
import { doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { BrandId, WorkItem, WorkItemCategory, WorkItemInputType, Department, FranchiseSchedule } from '../../types';
import { Plus, Trash2, Archive, RotateCcw, GripVertical, Eye, EyeOff, Save, X, Info, Settings2, Check } from 'lucide-react';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useToast } from '../Toast';
import { useConfirm } from '../ConfirmModal';
import { ProcessSettings } from '../franchise/ProcessMasterModal';

const INPUT_TYPES: { value: WorkItemInputType; label: string }[] = [
  { value: 'date', label: '날짜 선택' },
  { value: 'date_range', label: '기간(시작~종료)' },
  { value: 'location_select', label: '장소 선택' },
  { value: 'participant_count', label: '인원 선택' },
  { value: 'file', label: '파일 첨부' },
  { value: 'phone', label: '전화번호' },
  { value: 'hiorder', label: '하이오더' },
  { value: 'showcase', label: '쇼케이스' },
  { value: 'food_waste', label: '음식물 처리' },
  { value: 'file_date', label: '파일+날짜' },
  { value: 'staffing', label: '인원 구인' },
  { value: 'password', label: '보안 정보(ID/PW)' },
  { value: 'email', label: '이메일' },
  { value: 'training_payment', label: '교육비/장소' },
  { value: 'normal', label: '일반 텍스트' },
];

// Firestore undefined 저장을 방지하기 위한 유틸
const scrub = (obj: any): any => {
  if (Array.isArray(obj)) return obj.map(scrub);
  if (obj && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj)
        .filter(([_, v]) => v !== undefined)
        .map(([k, v]) => [k, scrub(v)])
    );
  }
  return obj;
};

function DeptMultiSelect({ departments, selectedIds, onChange }: {
  departments: Department[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggle = (id: string) => {
    const next = selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id];
    onChange(next);
  };

  const label = selectedIds.length === 0
    ? '미배분'
    : selectedIds.length === 1
      ? (departments.find(d => d.id === selectedIds[0])?.name || '미배분')
      : `${departments.find(d => d.id === selectedIds[0])?.name || ''} 외 ${selectedIds.length - 1}`;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1 text-xs border border-slate-200 dark:border-slate-700 rounded px-2 py-1 bg-white dark:bg-slate-800 hover:border-indigo-400 transition-colors min-w-[80px] text-left"
      >
        <span className={`flex-1 truncate ${selectedIds.length === 0 ? 'text-slate-400' : 'text-slate-800 dark:text-slate-200 font-bold'}`}>{label}</span>
        <span className="text-slate-400 text-[10px]">▾</span>
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl p-1 min-w-[130px]">
          {departments.length === 0 && <p className="text-xs text-slate-400 px-2 py-1">부서 없음</p>}
          {departments.map(d => (
            <label key={d.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedIds.includes(d.id)}
                onChange={() => toggle(d.id)}
                className="rounded accent-indigo-600"
              />
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{d.name}</span>
            </label>
          ))}
          {selectedIds.length > 0 && (
            <button onClick={() => onChange([])} className="w-full text-left px-2 py-1 text-[10px] text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded mt-0.5 font-bold">
              선택 해제
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function SortableWorkItemRow({
  item,
  departments,
  onUpdate,
  onDelete,
  onToggleArchive
}: {
  item: WorkItem,
  departments: Department[],
  onUpdate: (id: string, updates: Partial<WorkItem>) => void,
  onDelete: (id: string) => void,
  onToggleArchive: (id: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const [localText, setLocalText] = useState(item.text);

  // 외부(Firestore)에서 item.text가 바뀌면 로컬 상태도 동기화 (단, 포커스 중엔 무시)
  const isFocused = useRef(false);
  useEffect(() => {
    if (!isFocused.current) setLocalText(item.text);
  }, [item.text]);

  return (
    <tr ref={setNodeRef} style={style} className={`group bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50 ${item.isArchived ? 'opacity-50 grayscale' : ''}`}>
      <td className="p-3 border-b border-slate-100 dark:border-slate-800">
        <div {...attributes} {...listeners} className="cursor-grab text-slate-300 hover:text-slate-500">
          <GripVertical size={16} />
        </div>
      </td>
      <td className="p-3 border-b border-slate-100 dark:border-slate-800">
        <input
          className="w-full bg-transparent border-none focus:ring-0 font-bold text-sm"
          value={localText}
          onChange={e => setLocalText(e.target.value)}
          onFocus={() => { isFocused.current = true; }}
          onBlur={() => { isFocused.current = false; onUpdate(item.id, { text: localText }); }}
        />
      </td>
      <td className="p-3 border-b border-slate-100 dark:border-slate-800">
        <select 
          className="text-xs border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800"
          value={item.category}
          onChange={e => onUpdate(item.id, { category: e.target.value as any })}
        >
          <option value="schedule_date">일정 날짜</option>
          <option value="checklist">체크리스트</option>
        </select>
      </td>
      <td className="p-3 border-b border-slate-100 dark:border-slate-800">
        <select 
          className="text-xs border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800"
          value={item.inputType}
          onChange={e => onUpdate(item.id, { inputType: e.target.value as any })}
        >
          {INPUT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </td>
      <td className="p-3 border-b border-slate-100 dark:border-slate-800">
        <DeptMultiSelect
          departments={departments}
          selectedIds={item.departmentIds || (item.departmentId ? [item.departmentId] : [])}
          onChange={ids => onUpdate(item.id, { departmentIds: ids, departmentId: ids[0] || '' })}
        />
      </td>
      <td className="p-3 border-b border-slate-100 dark:border-slate-800 text-center">
        {item.category === 'schedule_date' && (
          <button 
            onClick={() => onUpdate(item.id, { calendarVisible: !item.calendarVisible })}
            className={`p-1 rounded transition-colors ${item.calendarVisible ? 'text-blue-500' : 'text-slate-300'}`}
          >
            {item.calendarVisible ? <Eye size={16} /> : <EyeOff size={16} />}
          </button>
        )}
      </td>
      <td className="p-3 border-b border-slate-100 dark:border-slate-800 text-right">
        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onToggleArchive(item.id)} className="p-1.5 text-slate-400 hover:text-orange-500">
            {item.isArchived ? <RotateCcw size={14} /> : <Archive size={14} />}
          </button>
          <button onClick={() => onDelete(item.id)} className="p-1.5 text-slate-400 hover:text-rose-500">
            <Trash2 size={14} />
          </button>
        </div>
      </td>
    </tr>
  );
}

export function WorkMasterManager({ brandId, departments }: { brandId: BrandId, departments: Department[] }) {
  const toast = useToast();
  const { confirm } = useConfirm();
  const [masterItems, setMasterItems] = useState<WorkItem[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'schedule_date' | 'checklist'>('all');
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'process_settings', brandId), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as ProcessSettings;
        setMasterItems(data.masterItems || []);
      }
    });
    return () => unsub();
  }, [brandId]);

  const handleUpdate = async (id: string, updates: Partial<WorkItem>) => {
    const newList = masterItems.map(item => item.id === id ? { ...item, ...updates } : item);
    await updateDoc(doc(db, 'process_settings', brandId), { masterItems: scrub(newList) });
  };

  const handleAddItem = async () => {
    const newItem: WorkItem = {
      id: `item_${Date.now()}`,
      text: '새로운 업무 항목',
      category: activeTab === 'all' ? 'checklist' : activeTab,
      inputType: 'normal',
      order: masterItems.length,
      isArchived: false,
      calendarVisible: true
    };
    await updateDoc(doc(db, 'process_settings', brandId), { masterItems: scrub([...masterItems, newItem]) });
    toast.success('새 항목이 추가되었습니다.');
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({ title: '항목 삭제', message: '이 항목을 삭제하시겠습니까?', variant: 'danger' });
    if (!ok) return;
    const newList = masterItems.filter(item => item.id !== id);
    await updateDoc(doc(db, 'process_settings', brandId), { masterItems: scrub(newList) });
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = masterItems.findIndex(i => i.id === active.id);
      const newIndex = masterItems.findIndex(i => i.id === over.id);
      const newList = arrayMove(masterItems, oldIndex, newIndex).map((item, idx) => ({ ...item, order: idx }));
      await updateDoc(doc(db, 'process_settings', brandId), { masterItems: scrub(newList) });
    }
  };

  const filteredItems = masterItems.filter(item => {
    if (item.isArchived && !showArchived) return false;
    if (activeTab !== 'all' && item.category !== activeTab) return false;
    return true;
  });

  const sensors = useSensors(useSensor(PointerSensor));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
          {(['all', 'schedule_date', 'checklist'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${activeTab === tab ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500'}`}
            >
              {tab === 'all' ? '전체' : tab === 'schedule_date' ? '일정 날짜' : '체크리스트'}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setShowArchived(!showArchived)}
            className={`px-3 py-1.5 text-xs font-bold rounded border transition-colors ${showArchived ? 'bg-orange-50 border-orange-200 text-orange-600' : 'bg-white border-slate-200 text-slate-500'}`}
          >
            보관함 보기
          </button>
          <button onClick={handleAddItem} className="flex items-center gap-1 px-4 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded hover:bg-indigo-700 shadow-sm">
            <Plus size={14} /> 항목 추가
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="p-3 w-10"></th>
                <th className="p-3">항목 이름</th>
                <th className="p-3 w-32">카테고리</th>
                <th className="p-3 w-32">입력 타입</th>
                <th className="p-3 w-32">담당 부서</th>
                <th className="p-3 w-20 text-center">캘린더</th>
                <th className="p-3 w-20"></th>
              </tr>
            </thead>
            <tbody>
              <SortableContext items={filteredItems.map(i => i.id)} strategy={verticalListSortingStrategy}>
                {filteredItems.map(item => (
                  <SortableWorkItemRow 
                    key={item.id} 
                    item={item} 
                    departments={departments} 
                    onUpdate={handleUpdate}
                    onDelete={handleDelete}
                    onToggleArchive={(id) => handleUpdate(id, { isArchived: !item.isArchived })}
                  />
                ))}
              </SortableContext>
            </tbody>
          </table>
        </DndContext>
      </div>
    </div>
  );
}