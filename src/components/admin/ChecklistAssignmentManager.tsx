import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { salesDb } from '../../firebase';
import { Department, BrandId } from '../../types';
import { DEFAULT_MASTER_CHECKLIST, ChecklistMasterItem } from '../franchise/ProcessMasterModal';
import { useToast } from '../Toast';
import { CheckSquare, Save } from 'lucide-react';

interface Props {
  brandId: BrandId;
  departments: Department[];
}

export function ChecklistAssignmentManager({ brandId, departments }: Props) {
  const toast = useToast();
  const [items, setItems] = useState<ChecklistMasterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const snap = await getDoc(doc(salesDb, 'process_settings', brandId));
        const stored = snap.exists() ? (snap.data().masterChecklist as ChecklistMasterItem[] | undefined) : undefined;
        if (stored && stored.length > 0) {
          // Merge stored departmentId assignments onto the canonical list (preserves order/text)
          const merged = DEFAULT_MASTER_CHECKLIST.map(def => ({
            ...def,
            departmentId: stored.find(s => s.id === def.id)?.departmentId ?? def.departmentId,
          }));
          setItems(merged);
        } else {
          setItems(DEFAULT_MASTER_CHECKLIST.map(i => ({ ...i })));
        }
      } catch (e) {
        console.error(e);
        setItems(DEFAULT_MASTER_CHECKLIST.map(i => ({ ...i })));
      } finally {
        setLoading(false);
      }
    })();
  }, [brandId]);

  const handleAssign = (itemId: string, departmentId: string) => {
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, departmentId: departmentId || undefined } : i));
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await setDoc(
        doc(salesDb, 'process_settings', brandId),
        { masterChecklist: items },
        { merge: true }
      );
      toast.success('체크리스트 부서 배분이 저장되었습니다.');
      setDirty(false);
    } catch (e: any) {
      toast.error(`저장 실패: ${e?.message}`);
    } finally {
      setSaving(false);
    }
  };

  const deptColor = (deptId?: string) => {
    const d = departments.find(d => d.id === deptId);
    return d?.color || '';
  };

  const deptName = (deptId?: string) => {
    const d = departments.find(d => d.id === deptId);
    return d?.name || '';
  };

  const unassignedCount = items.filter(i => !i.departmentId).length;

  if (loading) return <div className="py-8 text-center text-stone-400 text-sm">불러오는 중...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-xs text-stone-500 font-medium">
          총 {items.length}개 항목 중{' '}
          {unassignedCount > 0 ? (
            <span className="text-amber-600 font-bold">{unassignedCount}개 미배분</span>
          ) : (
            <span className="text-emerald-600 font-bold">전체 배분 완료</span>
          )}
        </div>
        <button
          onClick={handleSave}
          disabled={saving || !dirty}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-sm transition-colors shadow-sm"
        >
          <Save size={13} />
          {saving ? '저장 중...' : '변경사항 저장'}
        </button>
      </div>

      {departments.length === 0 && (
        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-xs text-amber-700 dark:text-amber-400 font-medium">
          먼저 부서를 등록하세요. 부서를 등록하면 여기서 각 항목에 부서를 배분할 수 있습니다.
        </div>
      )}

      <div className="divide-y divide-stone-100 dark:divide-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg overflow-hidden">
        {items.map((item, idx) => (
          <div key={item.id} className="flex items-center gap-3 px-3 py-2.5 bg-white dark:bg-stone-900 hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors">
            <span className="text-[10px] text-stone-400 font-mono w-5 shrink-0 text-right">{idx + 1}</span>
            <CheckSquare size={13} className="text-stone-400 shrink-0" />
            <span className="flex-1 text-sm text-stone-800 dark:text-stone-200 font-medium truncate">{item.text}</span>
            {item.departmentId && (
              <span className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-bold text-white ${deptColor(item.departmentId)}`}>
                {deptName(item.departmentId)}
              </span>
            )}
            <select
              value={item.departmentId || ''}
              onChange={e => handleAssign(item.id, e.target.value)}
              className="shrink-0 text-xs px-2 py-1.5 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-sm focus:outline-none focus:ring-1 focus:ring-blue-500 text-stone-700 dark:text-stone-300 max-w-[130px]"
            >
              <option value="">부서 미지정</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}
