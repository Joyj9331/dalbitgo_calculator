import React, { useState } from 'react';
import { X, Plus } from 'lucide-react';
import { salesDb as db } from '../../firebase';
import { collection, addDoc } from 'firebase/firestore';
import { FranchiseSchedule, BrandId, TeamSetting } from '../../types';
import { useToast } from '../Toast';

interface Props {
  brandId: BrandId;
  teams: TeamSetting[];
  onClose: () => void;
  onCreated: (id: string) => void;
}

const COLOR_OPTIONS = [
  { value: 'slate', label: '회색' },
  { value: 'red', label: '빨강' },
  { value: 'orange', label: '주황' },
  { value: 'amber', label: '노랑' },
  { value: 'green', label: '초록' },
  { value: 'teal', label: '청록' },
  { value: 'blue', label: '파랑' },
  { value: 'indigo', label: '남색' },
  { value: 'violet', label: '보라' },
  { value: 'pink', label: '분홍' },
];

export function StoreRegistrationModal({ brandId, teams, onClose, onCreated }: Props) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    storeNumber: '',
    storeName: '',
    team: '',
    supervisor: '',
    colorCode: 'slate',
    constructionType: '더원',
    signageType: '동영',
    kitchenSupplier: '형제',
    gasType: '도시가스',
    notes: '',
  });

  const set = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    if (!form.storeName.trim()) {
      toast.error('매장명을 입력해주세요.');
      return;
    }
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const docRef = await addDoc(collection(db, 'franchise_schedules'), {
        brandId,
        storeNumber: form.storeNumber.trim(),
        storeName: form.storeName.trim(),
        team: form.team,
        supervisor: form.supervisor.trim(),
        colorCode: form.colorCode,
        constructionType: form.constructionType,
        signageType: form.signageType,
        kitchenSupplier: form.kitchenSupplier,
        gasType: form.gasType,
        notes: form.notes.trim(),
        showInCalendar: true,
        archived: false,
        checklistData: {},
        progressCheck: { drawingUpload: false, ovenOrder: false, ownerGuide: false, equipmentOrder: false, internetOrder: false, initialEntry: false },
        constructionStart: '', constructionEnd: '', ovenIn: '', ovenEnd: '', burnerIn: '',
        initialStockIn: '', initialStockEnd: '', preTrainingStart: '', preTrainingEnd: '',
        trainingStart: '', trainingEnd: '', softOpenDate: '', openDate: '',
        ownerGuideStart: '', equipmentIn: '', preTrainingLocation: '', preTrainingDays: 0,
        preTrainingParticipants: 0, preTrainingPayment: '',
        finalDrawingPdfUrl: '', finalDrawingPdfs: [],
        createdAt: now, updatedAt: now,
      });
      toast.success(`${form.storeName} 매장이 등록되었습니다.`);
      onCreated(docRef.id);
    } catch (e) {
      toast.error('저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">신규 매장 등록</h2>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto max-h-[70vh]">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">매장 호수</label>
              <input className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 font-bold focus:outline-none focus:border-indigo-500" placeholder="예: 120호" value={form.storeNumber} onChange={e => set('storeNumber', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">매장명 <span className="text-rose-500">*</span></label>
              <input className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 font-bold focus:outline-none focus:border-indigo-500" placeholder="매장명 입력" value={form.storeName} onChange={e => set('storeName', e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">담당 팀</label>
              <select className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 font-bold focus:outline-none focus:border-indigo-500" value={form.team} onChange={e => set('team', e.target.value)}>
                <option value="">팀 선택</option>
                {teams.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">담당 SV</label>
              <input className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 font-bold focus:outline-none focus:border-indigo-500" placeholder="SV 이름" value={form.supervisor} onChange={e => set('supervisor', e.target.value)} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1.5">매장 고유 색상</label>
            <div className="flex flex-wrap gap-2">
              {COLOR_OPTIONS.map(c => (
                <button key={c.value} onClick={() => set('colorCode', c.value)} className={`w-7 h-7 rounded-full border-2 transition-all bg-${c.value}-500 ${form.colorCode === c.value ? 'border-slate-800 scale-110 shadow-md' : 'border-transparent'}`} title={c.label} />
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">공사 구분</label>
              <select className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 font-bold focus:outline-none focus:border-indigo-500" value={form.constructionType} onChange={e => set('constructionType', e.target.value)}>
                <option>더원</option><option>감리</option><option>직접시공</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">간판 구분</label>
              <select className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 font-bold focus:outline-none focus:border-indigo-500" value={form.signageType} onChange={e => set('signageType', e.target.value)}>
                <option>동영</option><option>직접</option><option>기타</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">주방 업체</label>
              <select className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 font-bold focus:outline-none focus:border-indigo-500" value={form.kitchenSupplier} onChange={e => set('kitchenSupplier', e.target.value)}>
                <option>형제</option><option>신광</option><option>주원</option><option>기타</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">가스 종류</label>
              <select className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 font-bold focus:outline-none focus:border-indigo-500" value={form.gasType} onChange={e => set('gasType', e.target.value)}>
                <option>도시가스</option><option>LPG</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">특이사항</label>
            <textarea rows={3} className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 font-bold focus:outline-none focus:border-indigo-500 resize-none" placeholder="특이사항 메모..." value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>
        </div>

        <div className="flex justify-end gap-2 p-5 border-t border-slate-200 dark:border-slate-700">
          <button onClick={onClose} className="px-4 py-2 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
            취소
          </button>
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-5 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm">
            <Plus size={15} /> {saving ? '등록 중...' : '매장 등록'}
          </button>
        </div>
      </div>
    </div>
  );
}
