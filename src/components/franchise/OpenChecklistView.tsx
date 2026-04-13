import React, { useState, useEffect, useMemo } from 'react';
import { salesDb, db as mainDb } from '../../firebase';
import { collection, doc, onSnapshot, updateDoc, setDoc, getDoc } from 'firebase/firestore';
import { BrandId, FranchiseSchedule, ChecklistItem, ChecklistItemData, ChecklistItemType } from '../../types';
import { useToast } from '../Toast';
import { useConfirm } from '../ConfirmModal';
import { 
  CheckSquare, Store, Printer, Settings, CheckCircle2, 
  GripVertical, Trash2, Plus, X, Search,
  FileText, UploadCloud, Loader2, Lock, Unlock
} from 'lucide-react';
import { 
  DndContext, closestCenter, KeyboardSensor, PointerSensor, 
  useSensor, useSensors, DragEndEvent 
} from '@dnd-kit/core';
import { 
  arrayMove, SortableContext, sortableKeyboardCoordinates, 
  verticalListSortingStrategy, useSortable 
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../firebase';

// 진행 상태 정의
const STATUS_STAGES = [
  { label: '미진행', class: 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-800/50' },
  { label: '안내완료', class: 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800/50' },
  { label: '진행중', class: 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/50' },
  { label: '완료', class: 'bg-blue-600 text-white border-blue-600 dark:bg-blue-600 dark:border-blue-600 font-bold shadow-sm' }
];

// 기본 마스터 템플릿
const DEFAULT_MASTER_CHECKLIST: ChecklistItem[] = [
  { id: 'item_1', text: '사업자등록증 발급', type: 'pdf' },
  { id: 'item_2', text: '유선 전화번호 발급', type: 'normal' },
  { id: 'item_3', text: '하이오더 설치', type: 'date' },
  { id: 'item_4', text: '애니워터 설치', type: 'date' },
  { id: 'item_5', text: '대기실 정수기 설치', type: 'date' },
  { id: 'item_6', text: '커피머신 설치', type: 'normal' },
  { id: 'item_7', text: '테이블링 설치', type: 'normal' },
  { id: 'item_8', text: '세스코 설치', type: 'date' },
  { id: 'item_9', text: '쇼케이스 섭외', type: 'showcase' },
  { id: 'item_10', text: '음식물 처리', type: 'food_waste' },
  { id: 'item_11', text: '지역화폐신청', type: 'normal' },
  { id: 'item_12', text: '야채 발주', type: 'normal' },
  { id: 'item_13', text: '인원 구인', type: 'staffing' },
  { id: 'item_14', text: '네이버플레이스 권한 인수인계', type: 'secure_account' },
  { id: 'item_15', text: '세금계산서 발행용 이메일', type: 'email' },
  { id: 'item_16', text: '사전교육', type: 'training' },
  { id: 'item_17', text: 'FC다움 가입', type: 'normal' }
];

// DnD 아이템 컴포넌트
function SortableItem({ item, index, onUpdate, onDelete }: any) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <li ref={setNodeRef} style={style} className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm group relative z-50">
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 dark:hover:text-slate-400 p-1">
        <GripVertical size={18} />
      </div>
      <span className="text-xs font-bold text-slate-400 w-5">{index + 1}</span>
      <input
        className="flex-1 bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-blue-500 rounded px-2 py-1 text-sm font-bold text-slate-800 dark:text-slate-200"
        value={item.text}
        onChange={e => onUpdate(item.id, e.target.value)}
      />
      <span className="text-[10px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-2 py-1 rounded-md tracking-wider whitespace-nowrap">
        {item.type === 'normal' ? '일반' : item.type === 'staffing' ? '구인' : item.type === 'training' ? '교육' : item.type === 'email' ? '이메일' : item.type === 'pdf' ? 'PDF' : item.type === 'date' ? '일정' : item.type === 'showcase' ? '쇼케이스' : item.type === 'food_waste' ? '음식물' : item.type === 'secure_account' ? '보안계정' : '기타'}
      </span>
      <button onClick={() => onDelete(item.id)} className="text-rose-400 hover:text-rose-600 dark:hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity p-1">
        <Trash2 size={16} />
      </button>
    </li>
  );
}

export function OpenChecklistView({ brandId }: { brandId: BrandId }) {
  const toast = useToast();
  const { confirm } = useConfirm();
  
  const [masterList, setMasterList] = useState<ChecklistItem[]>([]);
  const [schedules, setSchedules] = useState<FranchiseSchedule[]>([]);
  const [activeTab, setActiveTab] = useState<'active'|'completed'>('active');
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [isMasterModalOpen, setIsMasterModalOpen] = useState(false);
  const [newItemText, setNewItemText] = useState('');
  const [newItemType, setNewItemType] = useState<ChecklistItemType>('normal');
  const [uploadingPdfId, setUploadingPdfId] = useState<string | null>(null);
  const [masterPassword, setMasterPassword] = useState('');
  const [unlockedItems, setUnlockedItems] = useState<Record<string, boolean>>({});
  const [passwordInputs, setPasswordInputs] = useState<Record<string, string>>({});
  
  // 센서 설정 (DnD 용)
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // 데이터 페칭
  useEffect(() => {
    // 💡 보안 마스터 비밀번호 페칭
    const fetchSecurity = async () => {
      try {
        const snap = await getDoc(doc(mainDb, 'system_settings', 'security'));
        if (snap.exists()) setMasterPassword(snap.data().naverPlacePassword || '');
      } catch(e) {}
    };
    fetchSecurity();

    const unsubMaster = onSnapshot(doc(salesDb, 'master_checklists', brandId), (snap) => {
      if (snap.exists() && snap.data().items) {
        // 💡 구버전(normal) 데이터를 새 다이나믹 폼 타입으로 스마트 자동 마이그레이션
        let items = snap.data().items as ChecklistItem[];
        items = items.map(item => {
          if (item.type === 'normal') {
            if (item.text.includes('사업자등록증') || item.text.includes('영업신고증')) return { ...item, type: 'pdf' };
            if (item.text.includes('하이오더') || item.text.includes('애니워터') || item.text.includes('대기실 정수기') || item.text.includes('세스코')) return { ...item, type: 'date' };
            if (item.text.includes('쇼케이스')) return { ...item, type: 'showcase' };
            if (item.text.includes('음식물 처리')) return { ...item, type: 'food_waste' };
            if (item.text.includes('네이버플레이스')) return { ...item, type: 'secure_account' };
          }
          return item;
        });
        setMasterList(items);
      } else {
        setMasterList(DEFAULT_MASTER_CHECKLIST);
      }
    });

    const unsubSchedules = onSnapshot(collection(salesDb, 'franchise_schedules'), (snap) => {
      const data: FranchiseSchedule[] = [];
      snap.forEach(d => {
        const item = d.data() as FranchiseSchedule;
        if (item.brandId === brandId) data.push({ ...item, id: d.id });
      });
      // 정렬 (진행중 매장은 오픈일 순, 완료 매장은 역순)
      data.sort((a,b) => (a.openDate || '').localeCompare(b.openDate || ''));
      setSchedules(data);
    });

    return () => { unsubMaster(); unsubSchedules(); };
  }, [brandId]);

  // 선택 매장 자동화 (탭 전환 시)
  useEffect(() => {
    const filtered = schedules.filter(s => activeTab === 'active' ? !s.archived : s.archived);
    if (!filtered.find(s => s.id === selectedStoreId)) {
      setSelectedStoreId(filtered.length > 0 ? filtered[0].id : null);
    }
  }, [activeTab, schedules]);

  const filteredStores = useMemo(() => {
    return schedules.filter(s => activeTab === 'active' ? !s.archived : s.archived);
  }, [schedules, activeTab]);

  const currentStore = useMemo(() => {
    return schedules.find(s => s.id === selectedStoreId) || null;
  }, [selectedStoreId, schedules]);

  // 데이터 업데이트 핸들러
  const updateStoreItem = async (itemId: string, field: keyof ChecklistItemData, value: any) => {
    if (!currentStore) return;
    const currentData = currentStore.checklistData?.[itemId] || { status: 0 };
    await updateDoc(doc(salesDb, 'franchise_schedules', currentStore.id), {
      [`checklistData.${itemId}`]: { ...currentData, [field]: value }
    });
  };

  const cycleStatus = async (itemId: string) => {
    if (!currentStore) return;
    const currentData = currentStore.checklistData?.[itemId] || { status: 0 };
    const newStatus = (currentData.status + 1) % 4;
    await updateDoc(doc(salesDb, 'franchise_schedules', currentStore.id), {
      [`checklistData.${itemId}.status`]: newStatus
    });
  };

  // 마스터 리스트 업데이트 핸들러
  const saveMasterList = async (newList: ChecklistItem[]) => {
    await setDoc(doc(salesDb, 'master_checklists', brandId), { items: newList }, { merge: true });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = masterList.findIndex(i => i.id === active.id);
      const newIndex = masterList.findIndex(i => i.id === over.id);
      const newItems = arrayMove(masterList, oldIndex, newIndex);
      saveMasterList(newItems);
    }
  };

  const addMasterItem = () => {
    if (!newItemText.trim()) return;
    const newItems = [...masterList, { id: `item_${Date.now()}`, text: newItemText.trim(), type: newItemType }];
    saveMasterList(newItems);
    setNewItemText('');
  };

  // 특수 폼 렌더링 함수
  const renderCustomInput = (item: ChecklistItem, data: ChecklistItemData) => {
    const inputClass = "w-full text-sm bg-transparent focus:outline-none border-b border-transparent hover:border-slate-300 focus:border-blue-500 transition-colors py-1 dark:text-slate-200 placeholder:text-slate-300 dark:placeholder:text-slate-600";
    
    if (item.type === 'email') {
      return <input type="email" placeholder="이메일 주소 입력" className={inputClass} value={data.note1 || ''} onChange={e => updateStoreItem(item.id, 'note1', e.target.value)} />;
    }

    if (item.type === 'pdf') {
      const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !currentStore) return;
        setUploadingPdfId(item.id);
        try {
          const fileRef = ref(storage, `checklists/${currentStore.id}/${item.id}_${Date.now()}_${file.name}`);
          await uploadBytes(fileRef, file);
          const url = await getDownloadURL(fileRef);
          await updateStoreItem(item.id, 'note1', url);
          toast.success('파일이 성공적으로 업로드되었습니다.');
        } catch (err) {
          toast.error('업로드에 실패했습니다.');
        } finally {
          setUploadingPdfId(null);
        }
      };

      return (
        <div className="flex items-center gap-3">
          <input type="file" accept=".pdf" id={`pdf-${item.id}`} className="hidden" onChange={handleUpload} disabled={uploadingPdfId === item.id} />
          <label htmlFor={`pdf-${item.id}`} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg cursor-pointer text-xs font-bold transition-colors shadow-sm">
            {uploadingPdfId === item.id ? <Loader2 size={14} className="animate-spin text-blue-500" /> : <UploadCloud size={14} className="text-blue-500" />}
            {data.note1 ? '다시 올리기' : 'PDF 첨부'}
          </label>
          {data.note1 && (
            <a href={data.note1} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 underline underline-offset-4">
              <FileText size={14} /> 열람하기
            </a>
          )}
        </div>
      );
    }

    if (item.type === 'date') {
      return <input type="date" className="text-sm bg-transparent border-b border-slate-300 dark:border-slate-700 hover:border-slate-400 focus:border-blue-500 focus:outline-none dark:text-slate-200 py-1" value={data.note1 || ''} onChange={e => updateStoreItem(item.id, 'note1', e.target.value)} />;
    }

    if (item.type === 'showcase') {
      return (
        <div className="flex flex-wrap items-center gap-3">
          {['좌도어', '우도어', '소주냉동고'].map((label, i) => {
            const field = `note${i+1}` as keyof ChecklistItemData;
            return (
              <div key={label} className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/50 px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400">{label}</span>
                <input type="number" min="0" placeholder="0" className="w-10 text-xs font-bold bg-transparent outline-none focus:border-blue-500 dark:text-white text-center" value={(data[field] as string) || ''} onChange={e => updateStoreItem(item.id, field, e.target.value)} />
                <span className="text-[10px] text-slate-500">대</span>
              </div>
            );
          })}
        </div>
      );
    }

    if (item.type === 'food_waste') {
      return (
        <select className="text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1.5 outline-none focus:border-blue-500 dark:text-white cursor-pointer" value={data.note1 || ''} onChange={e => updateStoreItem(item.id, 'note1', e.target.value)}>
          <option value="">방식 선택</option>
          <option value="음식물수거통">음식물수거통</option>
          <option value="음식물처리기">음식물처리기</option>
        </select>
      );
    }

    if (item.type === 'secure_account') {
      const isUnlocked = unlockedItems[item.id] || false;

      const handleUnlock = () => {
        if (passwordInputs[item.id] === masterPassword) {
          setUnlockedItems(prev => ({ ...prev, [item.id]: true }));
          toast.success('보안 계정 열람이 승인되었습니다.');
        } else {
          toast.error('비밀번호가 일치하지 않습니다.');
        }
      };

      if (!isUnlocked) {
        return (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5">
              <Lock size={14} className="text-rose-500" />
              <input 
                type="password" 
                placeholder="열람용 마스터 암호" 
                className="w-32 text-xs bg-transparent outline-none dark:text-white"
                value={passwordInputs[item.id] || ''}
                onChange={e => setPasswordInputs(prev => ({ ...prev, [item.id]: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && handleUnlock()}
              />
            </div>
            <button onClick={handleUnlock} className="px-3 py-1.5 bg-slate-800 dark:bg-slate-700 text-white text-xs font-bold rounded-lg hover:bg-slate-700 transition-colors shadow-sm">열람</button>
          </div>
        );
      }

      return (
        <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 duration-300">
          <Unlock size={16} className="text-emerald-500 mr-1" />
          <input type="text" placeholder="아이디 입력" className="w-36 text-xs font-bold bg-white dark:bg-slate-800 border border-emerald-200 dark:border-emerald-800/50 focus:border-emerald-400 rounded-lg px-3 py-1.5 outline-none dark:text-white shadow-sm" value={data.note1 || ''} onChange={e => updateStoreItem(item.id, 'note1', e.target.value)} />
          <input type="text" placeholder="비밀번호 입력" className="w-36 text-xs font-bold bg-white dark:bg-slate-800 border border-emerald-200 dark:border-emerald-800/50 focus:border-emerald-400 rounded-lg px-3 py-1.5 outline-none dark:text-white shadow-sm" value={data.note2 || ''} onChange={e => updateStoreItem(item.id, 'note2', e.target.value)} />
        </div>
      );
    }
    
    if (item.type === 'staffing') {
      return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          {['홀 직원', '홀 파트', '주방 직원', '주방 파트'].map((label, i) => {
            const field = `note${i+1}` as keyof ChecklistItemData;
            return (
              <div key={label} className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/50 px-2 py-1.5 rounded border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] font-bold text-slate-500 w-10 shrink-0 leading-tight">{label}</span>
                <input type="number" placeholder="0명" className="w-full text-xs font-bold bg-transparent outline-none dark:text-white" value={(data[field] as string) || ''} onChange={e => updateStoreItem(item.id, field, e.target.value)} />
              </div>
            );
          })}
        </div>
      );
    }

    if (item.type === 'training') {
      const timeOptions = Array.from({length: 14}, (_, i) => `${String(i + 9).padStart(2, '0')}:00`);
      return (
        <div className="flex flex-col gap-2 p-2 bg-slate-50 dark:bg-slate-800/30 rounded-lg border border-slate-100 dark:border-slate-800/50">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-500 w-8">장소</span>
            <select className="text-xs border border-slate-200 dark:border-slate-700 rounded px-1 py-1 outline-none bg-white dark:bg-slate-800 dark:text-white w-24" value={data.note1 || ''} onChange={e => updateStoreItem(item.id, 'note1', e.target.value)}>
              <option value="">선택</option><option value="예당마을점">예당마을점</option><option value="남원점">남원점</option><option value="청주율량점">청주율량점</option><option value="직접입력">직접입력</option>
            </select>
            {data.note1 === '직접입력' && <input type="text" placeholder="직접입력" className="w-20 text-xs border border-slate-200 dark:border-slate-700 rounded px-1 py-1 outline-none bg-white dark:bg-slate-800 dark:text-white" value={data.note2 || ''} onChange={e => updateStoreItem(item.id, 'note2', e.target.value)} />}
            <span className="text-xs font-bold text-slate-500 ml-1">인원</span>
            <select className="text-xs border border-slate-200 dark:border-slate-700 rounded px-1 py-1 outline-none bg-white dark:bg-slate-800 dark:text-white w-14" value={data.note7 || ''} onChange={e => updateStoreItem(item.id, 'note7', e.target.value)}>
              <option value="">-</option>{[1,2,3,4,5].map(n => <option key={n} value={`${n}명`}>{n}명</option>)}
            </select>
            <span className="text-xs font-bold text-slate-500 ml-1">담당</span>
            <input type="text" placeholder="이름" className="w-16 text-xs border border-slate-200 dark:border-slate-700 rounded px-1 py-1 outline-none bg-white dark:bg-slate-800 dark:text-white" value={data.note8 || ''} onChange={e => updateStoreItem(item.id, 'note8', e.target.value)} />
            <span className="text-xs font-bold text-slate-500 ml-1">교육비</span>
            <select className="text-xs border border-slate-200 dark:border-slate-700 rounded px-1 py-1 outline-none bg-white dark:bg-slate-800 dark:text-white w-20 cursor-pointer" value={data.note9 || ''} onChange={e => updateStoreItem(item.id, 'note9', e.target.value)}>
              <option value="">상태 선택</option>
              <option value="입금 대기">입금 대기</option>
              <option value="입금 완료">입금 완료</option>
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-500 w-8">일시</span>
            <input type="date" className="text-[10px] sm:text-xs border border-slate-200 dark:border-slate-700 rounded px-1 py-1 outline-none bg-white dark:bg-slate-800 dark:text-white" value={data.note3 || ''} onChange={e => updateStoreItem(item.id, 'note3', e.target.value)} />
            <span className="text-slate-400 text-xs">~</span>
            <input type="date" className="text-[10px] sm:text-xs border border-slate-200 dark:border-slate-700 rounded px-1 py-1 outline-none bg-white dark:bg-slate-800 dark:text-white" value={data.note4 || ''} onChange={e => updateStoreItem(item.id, 'note4', e.target.value)} />
            <span className="text-xs font-bold text-slate-500 ml-1 hidden sm:inline">시간</span>
            <select className="text-xs border border-slate-200 dark:border-slate-700 rounded px-1 py-1 outline-none bg-white dark:bg-slate-800 dark:text-white" value={data.note5 || ''} onChange={e => updateStoreItem(item.id, 'note5', e.target.value)}>
              <option value="">시작</option>{timeOptions.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <span className="text-slate-400 text-xs">~</span>
            <select className="text-xs border border-slate-200 dark:border-slate-700 rounded px-1 py-1 outline-none bg-white dark:bg-slate-800 dark:text-white" value={data.note6 || ''} onChange={e => updateStoreItem(item.id, 'note6', e.target.value)}>
              <option value="">종료</option>{timeOptions.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
      );
    }

    return <input type="text" placeholder="비고 및 세부사항 작성란..." className={inputClass} value={data.note1 || ''} onChange={e => updateStoreItem(item.id, 'note1', e.target.value)} />;
  };

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-140px)] gap-6 animate-in fade-in duration-300">
      
      {/* 좌측 패널: 매장 목록 */}
      <aside className="w-full md:w-64 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden shrink-0 print:hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <h2 className="font-black text-slate-900 dark:text-white tracking-tight">관리 매장 목록</h2>
        </div>
        <div className="flex text-sm font-bold text-slate-500 border-b border-slate-200 dark:border-slate-800 shrink-0 bg-slate-50 dark:bg-slate-800/50">
          <button onClick={() => setActiveTab('active')} className={`flex-1 py-2.5 transition-colors ${activeTab === 'active' ? 'text-blue-600 border-b-2 border-blue-600 bg-white dark:bg-slate-900' : 'hover:text-slate-800 dark:hover:text-slate-300'}`}>진행 중</button>
          <button onClick={() => setActiveTab('completed')} className={`flex-1 py-2.5 transition-colors ${activeTab === 'completed' ? 'text-blue-600 border-b-2 border-blue-600 bg-white dark:bg-slate-900' : 'hover:text-slate-800 dark:hover:text-slate-300'}`}>오픈 완료</button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1 bg-slate-50/50 dark:bg-slate-900/50">
          {filteredStores.length === 0 ? (
            <div className="text-center text-xs font-bold text-slate-400 py-10">해당하는 매장이 없습니다.</div>
          ) : (
            filteredStores.map(store => {
              const isActive = store.id === selectedStoreId;
              return (
                <button
                  key={store.id}
                  onClick={() => setSelectedStoreId(store.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-bold transition flex items-center justify-between group ${isActive ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent'}`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <Store size={15} className={isActive ? 'text-blue-500' : 'text-slate-400'} />
                    <span className="truncate">{store.storeName}</span>
                  </div>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-sm border shrink-0 ${isActive ? 'border-blue-300 bg-blue-100/50' : 'border-slate-200 dark:border-slate-700'}`}>{store.storeNumber || ''}</span>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* 우측 패널: 체크리스트 메인 영역 */}
      <section className="flex-1 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden relative print:border-none print:shadow-none print:bg-white">
        {!currentStore ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 print:hidden">
            <CheckSquare size={48} className="mb-4 text-slate-200 dark:text-slate-700" strokeWidth={1} />
            <p className="text-base font-bold text-slate-500">선택된 매장이 없습니다.</p>
            <p className="text-xs mt-1 font-medium">좌측 목록에서 매장을 선택해주세요.</p>
          </div>
        ) : (
          <>
            {/* 헤더 */}
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 flex flex-wrap items-center justify-between gap-4 shrink-0 print:hidden">
              <div className="flex items-center gap-3">
                <span className={`px-2.5 py-1 text-[10px] font-black tracking-widest rounded-sm ${currentStore.archived ? 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300' : 'bg-blue-600 text-white shadow-sm'}`}>
                  {currentStore.archived ? '오픈 완료' : '진행 중'}
                </span>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                  {currentStore.storeName}
                  <span className="text-sm font-bold text-slate-500 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded-md">{currentStore.storeNumber || '호수미정'}</span>
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setIsMasterModalOpen(true)} className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 px-3 py-2 rounded-lg text-sm font-bold transition-colors flex items-center gap-1.5 shadow-sm">
                  <Settings size={16} /> 마스터 설정
                </button>
                <button onClick={() => window.print()} className="bg-stone-800 hover:bg-stone-700 dark:bg-stone-200 dark:hover:bg-white dark:text-stone-900 text-white px-3 py-2 rounded-lg text-sm font-bold transition-colors flex items-center gap-1.5 shadow-sm">
                  <Printer size={16} /> 일일 보고(인쇄)
                </button>
              </div>
            </div>

            {/* 인쇄용 전용 헤더 (화면엔 안보임) */}
            <div className="hidden print:block text-center mb-6 pb-4 border-b-2 border-stone-800">
              <h1 className="text-3xl font-black text-stone-900 tracking-tight">[{currentStore.storeName}] 오픈 체크리스트 보고서</h1>
              <p className="text-sm font-bold text-stone-500 mt-2">출력일시: {new Date().toLocaleString('ko-KR')}</p>
            </div>

            {/* 테이블 */}
            <div className="flex-1 overflow-y-auto print:overflow-visible">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-800/80 sticky top-0 shadow-sm z-10 print:static print:bg-stone-100">
                  <tr>
                    <th className="py-3 px-4 font-black text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 w-12 text-center text-xs tracking-widest">NO</th>
                    <th className="py-3 px-4 font-black text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 w-1/4 min-w-[150px] text-xs tracking-widest">체크리스트 항목</th>
                    <th className="py-3 px-4 font-black text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 w-32 text-center text-xs tracking-widest">진행 상태</th>
                    <th className="py-3 px-4 font-black text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 text-xs tracking-widest">비고 및 세부작성란</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 print:divide-stone-200">
                  {(currentStore.checklist || masterList).map((item, idx) => {
                    const data = currentStore.checklistData?.[item.id] || { status: 0 };
                    const statusInfo = STATUS_STAGES[data.status];
                    
                    return (
                      <tr key={item.id} className="hover:bg-blue-50/30 dark:hover:bg-slate-800/50 transition-colors print:break-inside-avoid">
                        <td className="py-2.5 px-4 text-center text-slate-400 font-bold text-xs">{idx + 1}</td>
                        <td className="py-2.5 px-4 font-bold text-slate-700 dark:text-slate-200 text-sm break-keep">{item.text}</td>
                        <td className="py-2.5 px-4 text-center">
                          <button 
                            onClick={() => cycleStatus(item.id)}
                            className={`w-full py-1.5 px-2 rounded border text-xs cursor-pointer font-black transition-colors ${statusInfo.class} print:border-none print:shadow-none`}
                          >
                            {statusInfo.label}
                          </button>
                        </td>
                        <td className="py-2.5 px-4">
                          {renderCustomInput(item, data)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {/* 마스터 체크리스트 설정 모달 */}
      {isMasterModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 print:hidden">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 shrink-0">
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white">마스터 체크리스트 설정</h2>
                <p className="text-xs font-bold text-blue-600 dark:text-blue-400 mt-1 flex items-center gap-1"><CheckCircle2 size={14}/> 신규 매장에 기본으로 배포되는 템플릿입니다.</p>
              </div>
              <button onClick={() => setIsMasterModalOpen(false)} className="p-1.5 rounded-md text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 flex gap-2">
              <select value={newItemType} onChange={e => setNewItemType(e.target.value as ChecklistItemType)} className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 text-sm font-bold outline-none dark:text-white cursor-pointer shadow-sm">
                <option value="normal">일반</option>
                <option value="pdf">PDF 첨부</option>
                <option value="date">일정(달력)</option>
                <option value="showcase">쇼케이스</option>
                <option value="food_waste">음식물</option>
                <option value="secure_account">보안계정</option>
                <option value="staffing">구인</option>
                <option value="training">교육</option>
                <option value="email">이메일</option>
              </select>
              <input 
                type="text" 
                placeholder="새로운 항목을 입력하세요 (엔터로 추가)" 
                className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 rounded-lg px-4 py-2.5 text-sm font-bold outline-none transition-colors dark:text-white shadow-sm"
                value={newItemText}
                onChange={e => setNewItemText(e.target.value)}
                onKeyDown={e => { if(e.key === 'Enter') addMasterItem(); }}
              />
              <button onClick={addMasterItem} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg text-sm font-bold transition-colors shadow-sm whitespace-nowrap flex items-center gap-1">
                <Plus size={16} /> 추가
              </button>
            </div>

            <div className="p-4 flex-1 overflow-y-auto bg-slate-50/50 dark:bg-slate-950">
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={masterList.map(i => i.id)} strategy={verticalListSortingStrategy}>
                  <ul className="space-y-2">
                    {masterList.map((item, index) => (
                      <SortableItem 
                        key={item.id} 
                        item={item} 
                        index={index} 
                        onUpdate={(id: string, text: string) => {
                          const newItems = masterList.map(i => i.id === id ? { ...i, text } : i);
                          saveMasterList(newItems);
                        }}
                        onDelete={(id: string) => {
                          const newItems = masterList.filter(i => i.id !== id);
                          saveMasterList(newItems);
                        }}
                      />
                    ))}
                  </ul>
                </SortableContext>
              </DndContext>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}