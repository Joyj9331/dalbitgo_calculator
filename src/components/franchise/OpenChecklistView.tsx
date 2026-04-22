import React, { useState, useEffect } from 'react';
import { Store, ArrowLeft, CheckSquare, Search, Printer, Settings, Plus, Trash2, FileText, UploadCloud, GripVertical, Check, Info, CheckCircle2, X, Eye, EyeOff, Lock, Unlock } from 'lucide-react';
import { FranchiseSchedule, FileAttachment } from '../../types';
import { ProcessSettings } from './ProcessMasterModal';
import { useToast } from '../Toast';
import { useConfirm } from '../ConfirmModal';
import { uploadBytes, ref, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage, db } from '../../firebase';
import { doc, getDoc } from 'firebase/firestore';

import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, verticalListSortingStrategy, useSortable, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface Props {
  schedules?: FranchiseSchedule[];
  processSettings?: ProcessSettings;
  onUpdateProgress?: (scheduleId: string, checkId: string, isCustom: boolean, current: boolean) => void;
  onUpdateSchedule?: (scheduleId: string, data: Partial<FranchiseSchedule>) => Promise<void>;
  onUpdateMasterList?: (list: any[]) => Promise<void>;
}

const STATUS_STAGES = [
  { label: '미진행', class: 'bg-rose-100 text-rose-700 border-rose-300 hover:bg-rose-200' },
  { label: '안내완료', class: 'bg-amber-100 text-amber-700 border-amber-300 hover:bg-amber-200' },
  { label: '진행중', class: 'bg-blue-100 text-blue-700 border-blue-300 hover:bg-blue-200' },
  { label: '완료', class: 'bg-emerald-100 text-emerald-700 border-emerald-300 hover:bg-emerald-200 font-bold' }
];

const ITEM_TYPES = [
  {value: 'normal', label: '일반 텍스트'},
  {value: 'date', label: '미니 캘린더'},
  {value: 'file', label: '파일 첨부'},
  {value: 'phone', label: '전화번호'},
  {value: 'hiorder', label: '하이오더(광케이블)'},
  {value: 'showcase', label: '쇼케이스(좌/우/홍시)'},
  {value: 'food_waste', label: '음식물 처리(드롭다운)'},
  {value: 'file_date', label: '파일+날짜(야채발주)'},
  {value: 'staffing', label: '인원 구인'},
  {value: 'password', label: 'ID/비밀번호(보안)'},
  {value: 'email', label: '이메일'},
  {value: 'training_payment', label: '사전교육(입금확인)'}
];

const DEFAULT_MASTER_CHECKLIST = [
  { id: 'item_1', text: '영업신고/사업자등록증 발급', type: 'file' },
  { id: 'item_2', text: '유선 전화번호 발급', type: 'phone' },
  { id: 'item_3', text: '하이오더 설치', type: 'hiorder' },
  { id: 'item_4', text: '애니워터 설치', type: 'date' },
  { id: 'item_5', text: '대기실 정수기 설치', type: 'normal' },
  { id: 'item_6', text: '커피머신 설치', type: 'normal' },
  { id: 'item_7', text: '테이블링 설치', type: 'date' },
  { id: 'item_8', text: '쇼케이스 섭외', type: 'showcase' },
  { id: 'item_9', text: '세스코 설치', type: 'normal' },
  { id: 'item_10', text: '음식물 처리', type: 'food_waste' },
  { id: 'item_11', text: '지역화폐신청', type: 'normal' },
  { id: 'item_12', text: '야채 발주', type: 'file_date' },
  { id: 'item_13', text: '인원 구인', type: 'staffing' }, 
  { id: 'item_14', text: '네이버플레이스 권한 인수', type: 'password' }, 
  { id: 'item_15', text: '세금계산서 발행용 이메일', type: 'email' },
  { id: 'item_16', text: '사전교육 및 일정 조율', type: 'training_payment' },
  { id: 'item_17', text: 'FC다움 가입', type: 'normal' },
  { id: 'item_18', text: '최종 도면 업로드 (PDF)', type: 'file' },
  { id: 'item_19', text: '화덕 발주', type: 'date' },
  { id: 'item_20', text: '대소기물 발주', type: 'date' },
  { id: 'item_21', text: '인터넷 발주', type: 'date' },
  { id: 'item_22', text: '초도 물품 발주', type: 'date' },
  { id: 'item_23', text: '1차 오픈 현수막', type: 'date' },
  { id: 'item_25', text: '2차 오픈 현수막', type: 'date' },
  { id: 'item_24', text: '점주 최종 안내', type: 'date' }
];

function SortableItem({ item, index, onUpdate, onDelete }: any) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <li ref={setNodeRef} style={style} className="flex items-center gap-3 p-3 bg-white border border-slate-200 dark:border-slate-700 dark:bg-slate-800 rounded-lg shadow-sm group">
      <div {...attributes} {...listeners} className="cursor-grab text-slate-300 hover:text-slate-500"><GripVertical size={16} /></div>
      <span className="text-sm text-slate-400 font-mono w-5">{index + 1}</span>
      <input type="text" className="flex-1 text-sm border-none focus:outline-none bg-transparent text-slate-800 dark:text-slate-200" value={item.text} onChange={e => onUpdate(item.id, e.target.value)} />
      <span className="text-[10px] text-slate-500 bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded font-bold border border-slate-200 dark:border-slate-700">
        {ITEM_TYPES.find(t => t.value === item.type)?.label || item.type}
      </span>
      <button onClick={() => onDelete(item.id)} className="text-rose-400 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition"><Trash2 size={16} /></button>
    </li>
  );
}

export function OpenChecklistView({ schedules, processSettings, onUpdateSchedule, onUpdateMasterList }: Props) {
  if (!schedules || !processSettings || !onUpdateSchedule) {
    return (
      <div className="py-20 text-center text-slate-400 font-bold">오픈 체크리스트 로딩 중...</div>
    );
  }

  const toast = useToast();
  const { confirm } = useConfirm();
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentTab, setCurrentTab] = useState<'active' | 'completed'>('active');
  
  // 마스터 모달 상태
  const [masterModalOpen, setMasterModalOpen] = useState(false);
  const [masterList, setMasterList] = useState<any[]>((processSettings as any).masterChecklist || DEFAULT_MASTER_CHECKLIST);
  const [newItemText, setNewItemText] = useState('');
  const [newItemType, setNewItemType] = useState('normal');
  const [uploadingItem, setUploadingItem] = useState<string | null>(null);
  
  // 💡 네이버 권한 비밀번호 마스킹 해제 관련 상태
  const [unlockedItems, setUnlockedItems] = useState<Record<string, boolean>>({});
  const [unlockAdminId, setUnlockAdminId] = useState<string | null>(null);
  const [adminPwdInput, setAdminPwdInput] = useState('');
  const [actualAdminPwd, setActualAdminPwd] = useState('1234');

  // 💡 관리자 패널에서 설정한 실제 마스터 비밀번호 불러오기
  useEffect(() => {
    const fetchPwd = async () => {
      try {
        const snap = await getDoc(doc(db, 'system_settings', 'security'));
        if (snap.exists() && snap.data().naverPlacePassword) {
          setActualAdminPwd(snap.data().naverPlacePassword);
        }
      } catch (e) {}
    };
    fetchPwd();
  }, []);

  const filteredStores = schedules
    .filter(s => s.storeName.includes(searchQuery) && (currentTab === 'active' ? !s.archived : s.archived))
    .sort((a, b) => {
      const numA = parseInt(a.storeNumber?.replace(/[^0-9]/g, '') || '0', 10);
      const numB = parseInt(b.storeNumber?.replace(/[^0-9]/g, '') || '0', 10);
      return numA - numB;
    });
  const selectedStore = schedules.find(s => s.id === selectedStoreId);
  const activeChecklist = masterList; // 개별 커스텀은 추후 확장 가능하도록 일원화

  const getStoreData = (store: FranchiseSchedule) => (store as any).checklistData || {};

  // 항목 데이터 업데이트 및 캘린더 양방향 동기화
  const handleUpdateItem = (itemId: string, field: string, value: any, itemType: string) => {
    if (!selectedStore) return;
    const currentData = getStoreData(selectedStore);
    const itemData = currentData[itemId] || { status: 0 };
    
    const updates: any = {
      checklistData: { ...currentData, [itemId]: { ...itemData, [field]: value } }
    };

    // 💡 [핵심] 캘린더 양방향 동기화
    if (itemType === 'training') {
       if (field === 'note3') updates.preTrainingStart = value;
       if (field === 'note4') updates.preTrainingEnd = value;
       if (field === 'note1') updates.preTrainingLocation = value;
       if (field === 'note7') updates.preTrainingParticipants = parseInt(value.replace('명','')) || 0;
    } else if (itemId === 'item_19' && field === 'note3') { // 화덕 발주
       updates.ovenIn = value;
       updates.ovenEnd = value;
    } else if (itemId === 'item_20' && field === 'note3') { // 대소기물 발주
       updates.equipmentIn = value;
    } else if (itemId === 'item_22' && field === 'note3') { // 초도물품 발주
       updates.initialStockIn = value;
       updates.initialStockEnd = value;
    } else if (itemId === 'item_24' && field === 'note3') { // 점주 최종 안내
       updates.ownerGuideStart = value;
    }

    onUpdateSchedule(selectedStore.id, updates);
  };

  const cycleStatus = (itemId: string) => {
    if (!selectedStore) return;
    const currentData = getStoreData(selectedStore);
    const currentStatus = currentData[itemId]?.status || 0;
    const nextStatus = (currentStatus + 1) % STATUS_STAGES.length;
    handleUpdateItem(itemId, 'status', nextStatus, 'normal');
  };

  const verifyAdminPwd = (itemId: string) => {
    if (adminPwdInput === actualAdminPwd) {
       setUnlockedItems(p => ({...p, [itemId]: true}));
       setUnlockAdminId(null);
       setAdminPwdInput('');
    } else {
       toast.error('관리자 패널에서 설정한 보안 마스터 암호가 틀렸습니다.');
    }
  };

  // 기존 fileUrl 단일 필드 → files 배열로 하위 호환 변환
  const getItemFiles = (itemData: any): FileAttachment[] => {
    if (itemData?.files?.length) return itemData.files;
    if (itemData?.fileUrl) return [{ url: itemData.fileUrl, name: '첨부파일' }];
    return [];
  };

  const handleFileDelete = async (itemId: string, fileUrl: string) => {
    if (!selectedStore) return;
    try {
      const path = decodeURIComponent(fileUrl.split('/o/')[1].split('?')[0]);
      await deleteObject(ref(storage, path));
    } catch {
      // Storage 삭제 실패해도 Firestore 데이터는 초기화
    }
    const currentData = getStoreData(selectedStore);
    const { fileUrl: _old1, ...restItemData1 } = currentData[itemId] || { status: 0 };
    const newFiles = getItemFiles(currentData[itemId] || {}).filter(f => f.url !== fileUrl);
    const newItemData = { ...restItemData1, files: newFiles, status: newFiles.length === 0 ? 0 : (restItemData1.status ?? 0) };
    onUpdateSchedule(selectedStore.id, {
      checklistData: { ...currentData, [itemId]: newItemData }
    });
    toast.success('파일이 삭제되었습니다.');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, itemId: string) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0 || !selectedStore) return;
    // input 초기화 (같은 파일 재선택 가능하도록)
    e.target.value = '';

    setUploadingItem(itemId);
    toast.success(`${selectedFiles.length}개 파일을 업로드 중입니다...`);
    try {
      const uploadedAttachments: FileAttachment[] = [];
      for (const file of selectedFiles) {
        const fileRef = ref(storage, `checklist_files/${selectedStore.id}_${itemId}_${Date.now()}_${file.name}`);
        await uploadBytes(fileRef, file);
        const url = await getDownloadURL(fileRef);
        uploadedAttachments.push({ url, name: file.name });
      }

      const currentData = getStoreData(selectedStore);
      const { fileUrl: _old2, ...restItemData2 } = currentData[itemId] || { status: 0 };
      const currentFiles = getItemFiles(currentData[itemId] || {});
      const newFiles = [...currentFiles, ...uploadedAttachments];
      const newItemData = { ...restItemData2, files: newFiles, status: 3 };

      const updates: any = { checklistData: { ...currentData, [itemId]: newItemData } };
      // 💡 도면(item_18) 캘린더 동기화
      if (itemId === 'item_18') {
        updates.finalDrawingPdfUrl = uploadedAttachments[0].url;
        updates.progressCheck = { ...(selectedStore.progressCheck || {}), drawingUpload: true };
      }
      onUpdateSchedule(selectedStore.id, updates);
      toast.success('파일이 성공적으로 첨부되었습니다.');
    } catch (err) {
      toast.error('파일 업로드에 실패했습니다.');
    } finally {
      setUploadingItem(null);
    }
  };

  // 마스터 드래그앤드롭 리스트 핸들러
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setMasterList((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  return (
    <div className="h-[calc(100vh-140px)] min-h-[600px] flex gap-6 animate-in fade-in duration-300 relative print:h-auto print:block print:bg-white">
      
      {/* 왼쪽: 매장 리스트 패널 */}
      <div className={`w-full lg:w-64 xl:w-72 flex-shrink-0 flex flex-col bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm print:hidden ${selectedStoreId ? 'hidden lg:flex' : 'flex'}`}>
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-[#FDFBF7] dark:bg-slate-800/50">
          <div className="flex items-center justify-between mb-4">
             <h2 className="font-black text-lg text-slate-900 dark:text-white tracking-tight">관리 매장 목록</h2>
             <button onClick={() => setMasterModalOpen(true)} className="text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold px-2 py-1 rounded shadow-sm hover:bg-slate-300 transition-colors flex items-center gap-1">
               <Settings size={12} /> 마스터 설정
             </button>
          </div>
          <div className="flex bg-slate-200 dark:bg-slate-800 p-1 rounded-lg mb-4">
            <button onClick={() => { setCurrentTab('active'); setSelectedStoreId(null); }} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${currentTab === 'active' ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' : 'text-slate-500'}`}>진행 중</button>
            <button onClick={() => { setCurrentTab('completed'); setSelectedStoreId(null); }} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${currentTab === 'completed' ? 'bg-white dark:bg-slate-700 text-slate-800 shadow-sm' : 'text-slate-500'}`}>오픈 완료</button>
          </div>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" placeholder="매장명 검색..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-9 pr-3 py-2 text-sm font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-blue-500 transition-shadow" />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
          {filteredStores.map(store => (
            <button key={store.id} onClick={() => setSelectedStoreId(store.id)} className={`w-full text-left p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors flex items-center justify-between group ${selectedStoreId === store.id ? 'bg-indigo-50/70 border-l-4 border-indigo-500 dark:bg-indigo-900/20' : 'border-l-4 border-transparent'}`}>
              <div className="flex-1 min-w-0 pr-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="font-black text-sm text-slate-900 dark:text-white truncate">{store.storeName}</span>
                  <span className="text-[10px] font-bold text-slate-500 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 rounded-sm shrink-0">{store.storeNumber || '미정'}</span>
                </div>
                  {(() => {
                    const data = getStoreData(store);
                    const totalItems = activeChecklist.length;
                    const checkedItems = activeChecklist.filter(i => data[i.id]?.status === 3).length; // 3이 오픈완료
                    const progress = totalItems > 0 ? Math.round((checkedItems / totalItems) * 100) : 0;
                    return (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
                        </div>
                        <span className="text-[10px] font-black text-slate-500 w-8 text-right">{progress}%</span>
                      </div>
                    );
                  })()}
              </div>
            </button>
          ))}
          {filteredStores.length === 0 && (
            <div className="p-8 text-center text-sm text-slate-400">검색 결과가 없습니다.</div>
          )}
        </div>
      </div>

      {/* 오른쪽: 체크리스트 상세 패널 */}
      <div className={`flex-1 flex flex-col bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm print:border-none print:shadow-none print:w-full print:block ${!selectedStoreId ? 'hidden lg:flex' : 'flex'}`}>
        {selectedStore ? (
          <>
            {/* 상세 화면 헤더 */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-[#FDFBF7] dark:bg-slate-800/50 flex justify-between items-center flex-wrap gap-3 shrink-0 print:border-none print:bg-transparent print:p-0 print:mb-6">
          <div className="flex items-center gap-3 flex-1 min-w-[200px] print:justify-center print:flex-col print:gap-1">
                <button onClick={() => setSelectedStoreId(null)} className="lg:hidden p-1.5 -ml-2 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors print:hidden">
                  <ArrowLeft size={20} />
                </button>
            <span className={`px-2.5 py-1 text-[10px] font-black rounded uppercase tracking-wider shadow-sm print:hidden ${selectedStore.archived ? 'bg-slate-200 text-slate-700' : 'bg-indigo-600 text-white'}`}>
                  {selectedStore.archived ? '오픈 완료' : '진행 중'}
                </span>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter print:text-4xl print:text-center print:mt-4">
              {selectedStore.storeName} <span className="hidden print:inline-block text-xl text-slate-500 ml-2 font-bold tracking-widest">오픈 체크리스트</span>
                </h2>
              </div>
              <div className="flex items-center gap-2 shrink-0 print:hidden">
                <button onClick={() => window.print()} className="bg-slate-800 hover:bg-slate-700 text-white px-3 py-1.5 rounded shadow text-xs font-bold transition flex items-center gap-1.5">
                  <Printer size={14} /> 리포트 인쇄
                </button>
                <button onClick={() => onUpdateSchedule(selectedStore.id, { archived: !selectedStore.archived })} className={`px-3 py-1.5 rounded shadow text-xs font-bold transition flex items-center gap-1.5 border ${selectedStore.archived ? 'bg-white text-slate-700 hover:bg-slate-50 border-slate-300' : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'}`}>
                   <CheckCircle2 size={14} /> {selectedStore.archived ? '진행 중으로 복구' : '오픈 완료 처리'}
                </button>
              </div>
            </div>

            {/* 체크리스트 테이블 영역 */}
        <div className="flex-1 overflow-y-auto p-0 bg-white dark:bg-slate-900 print:overflow-visible print:h-auto relative print:w-full">
              <table className="w-full text-left border-collapse print:table-fixed block md:table print:table print:text-[10px]">
                <thead className="bg-slate-50 dark:bg-slate-800/80 sticky top-0 shadow-sm z-10 print:static hidden md:table-header-group print:table-header-group">
                  <tr>
                    <th className="py-3 px-3 print:py-1 print:px-1 font-bold text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 w-10 md:w-12 print:w-8 text-center text-xs print:text-[10px]">NO</th>
                    <th className="py-3 px-3 print:py-1 print:px-1 font-bold text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 w-1/4 md:w-1/3 print:w-1/4 text-xs print:text-[10px]">체크리스트 항목</th>
                    <th className="py-3 px-3 print:py-1 print:px-1 font-bold text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 w-24 md:w-28 lg:w-32 print:w-20 text-center text-xs print:text-[10px] whitespace-nowrap">진행 상태</th>
                    <th className="py-3 px-3 print:py-1 print:px-1 font-bold text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 text-xs print:text-[10px]">비고 및 세부작성란</th>
                  </tr>
                </thead>
                <tbody className="divide-y md:divide-y-0 md:divide-slate-100 dark:divide-slate-800 block md:table-row-group print:table-row-group">
                  {activeChecklist.map((item, index) => {
                    const itemData = getStoreData(selectedStore)[item.id] || { status: 0 };
                    const statusObj = STATUS_STAGES[itemData.status];

                    // 시간 드롭다운 생성 헬퍼
                    const timeOptions = (selected: string) => Array.from({length: 14}, (_, i) => {
                      const time = String(i + 9).padStart(2, '0') + ':00';
                      return <option key={time} value={time}>{time}</option>;
                    });

                    let inputHtml;
                    if (item.type === 'file' || item.type === 'email') {
                      const attachedFiles = getItemFiles(itemData);
                      inputHtml = (
                        <div className="flex flex-col gap-1 w-full">
                          <div className="flex items-center gap-2">
                            <input type="text" placeholder={item.type === 'email' ? "이메일 주소 입력" : "메모 입력"} className="flex-1 min-w-0 text-sm border-slate-200 dark:border-slate-700 rounded border px-2 py-2 md:py-1.5 focus:border-blue-500 focus:outline-none dark:bg-slate-800" value={itemData.note1 || ''} onChange={e => handleUpdateItem(item.id, 'note1', e.target.value, item.type)} />
                            {item.type === 'file' && (
                              <>
                                <input type="file" id={`file-${item.id}`} className="hidden" multiple onChange={(e) => handleFileUpload(e, item.id)} />
                                <label htmlFor={`file-${item.id}`} className="shrink-0 p-2 md:p-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded cursor-pointer transition-colors print:hidden" title="파일 첨부 (다중 선택 가능)">
                                  {uploadingItem === item.id ? <span className="animate-spin inline-block text-sm">⏳</span> : <UploadCloud size={16} />}
                                </label>
                              </>
                            )}
                          </div>
                          {attachedFiles.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 print:hidden">
                              {attachedFiles.map((f, i) => (
                                <div key={i} className="flex items-center gap-1 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-md px-2 py-1 max-w-[240px]">
                                  <FileText size={11} className="text-blue-500 shrink-0" />
                                  <a href={f.url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 dark:text-blue-400 truncate hover:underline" title={f.name}>{f.name}</a>
                                  <button onClick={() => handleFileDelete(item.id, f.url)} className="shrink-0 p-0.5 text-rose-400 hover:text-rose-600 ml-0.5" title="삭제">
                                    <X size={11} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                          {/* 인쇄용 파일 목록 */}
                          {attachedFiles.length > 0 && (
                            <div className="hidden print:flex flex-wrap gap-1">
                              {attachedFiles.map((f, i) => (
                                <span key={i} className="text-xs text-blue-700 underline">{f.name}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    } else if (item.type === 'phone') {
                      inputHtml = (
                        <div className="flex flex-col md:flex-row md:items-center gap-2 w-full">
                           <input type="tel" placeholder="000-0000-0000" className="flex-none w-full md:w-[140px] text-sm border-slate-200 dark:border-slate-700 rounded border px-2 py-2 md:py-1.5 focus:border-blue-500 focus:outline-none dark:bg-slate-800" value={itemData.note2 || ''} onChange={e => handleUpdateItem(item.id, 'note2', e.target.value, item.type)} />
                           <input type="text" placeholder="비고 작성란" className="flex-1 min-w-0 text-sm border-slate-200 dark:border-slate-700 rounded border px-2 py-2 md:py-1.5 focus:border-blue-500 focus:outline-none dark:bg-slate-800" value={itemData.note1 || ''} onChange={e => handleUpdateItem(item.id, 'note1', e.target.value, item.type)} />
                        </div>
                      );
                    } else if (item.type === 'date') {
                      inputHtml = (
                        <div className="flex flex-col md:flex-row md:items-center gap-2 w-full">
                           <input type="date" className="flex-none w-full md:w-[130px] text-sm font-bold text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 rounded border px-2 py-2 md:py-1.5 focus:border-blue-500 focus:outline-none dark:bg-slate-800" value={itemData.note3 || ''} onChange={e => handleUpdateItem(item.id, 'note3', e.target.value, item.type)} />
                           <input type="text" placeholder="비고 작성란" className="flex-1 min-w-0 text-sm border-slate-200 dark:border-slate-700 rounded border px-2 py-2 md:py-1.5 focus:border-blue-500 focus:outline-none dark:bg-slate-800" value={itemData.note1 || ''} onChange={e => handleUpdateItem(item.id, 'note1', e.target.value, item.type)} />
                        </div>
                      );
                    } else if (item.type === 'hiorder') {
                      inputHtml = (
                        <div className="flex flex-col md:flex-row md:items-center gap-2 w-full">
                           <input type="date" className="flex-none w-full md:w-[130px] text-sm font-bold text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 rounded border px-2 py-2 md:py-1.5 focus:border-blue-500 focus:outline-none dark:bg-slate-800" value={itemData.note3 || ''} onChange={e => handleUpdateItem(item.id, 'note3', e.target.value, item.type)} />
                           <label className="flex items-center justify-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 shrink-0 bg-slate-50 dark:bg-slate-800 px-3 py-2 md:py-1.5 rounded border border-slate-200 dark:border-slate-700 cursor-pointer">
                             <input type="checkbox" checked={itemData.note4 === 'Y'} onChange={e => handleUpdateItem(item.id, 'note4', e.target.checked ? 'Y' : 'N', item.type)} className="rounded" />
                             광케이블 설치
                           </label>
                           <input type="text" placeholder="비고 작성란" className="flex-1 min-w-0 text-sm border-slate-200 dark:border-slate-700 rounded border px-2 py-2 md:py-1.5 focus:border-blue-500 focus:outline-none dark:bg-slate-800" value={itemData.note1 || ''} onChange={e => handleUpdateItem(item.id, 'note1', e.target.value, item.type)} />
                        </div>
                      );
                    } else if (item.type === 'showcase') {
                      inputHtml = (
                        <div className="flex flex-col md:flex-row md:items-center gap-2 w-full">
                           <div className="flex items-center gap-2 w-full md:w-auto shrink-0">
                             <select className="flex-1 md:w-auto text-xs font-bold border-slate-200 dark:border-slate-700 rounded border px-1.5 py-2 md:py-1.5 focus:border-blue-500 focus:outline-none dark:bg-slate-800" value={itemData.note2 || ''} onChange={e => handleUpdateItem(item.id, 'note2', e.target.value, item.type)}>
                               <option value="">좌도어</option>
                               {[0,1,2,3,4,5].map(n => <option key={n} value={`${n}개`}>{n}개</option>)}
                             </select>
                             <select className="flex-1 md:w-auto text-xs font-bold border-slate-200 dark:border-slate-700 rounded border px-1.5 py-2 md:py-1.5 focus:border-blue-500 focus:outline-none dark:bg-slate-800" value={itemData.note3 || ''} onChange={e => handleUpdateItem(item.id, 'note3', e.target.value, item.type)}>
                               <option value="">우도어</option>
                               {[0,1,2,3,4,5].map(n => <option key={n} value={`${n}개`}>{n}개</option>)}
                             </select>
                             <select className="flex-1 md:w-auto text-xs font-bold border-slate-200 dark:border-slate-700 rounded border px-1.5 py-2 md:py-1.5 focus:border-blue-500 focus:outline-none dark:bg-slate-800" value={itemData.note4 || ''} onChange={e => handleUpdateItem(item.id, 'note4', e.target.value, item.type)}>
                               <option value="">홍시냉장고</option>
                               {[0,1,2,3,4,5].map(n => <option key={n} value={`${n}개`}>{n}개</option>)}
                             </select>
                           </div>
                           <input type="text" placeholder="비고 작성란" className="flex-1 min-w-0 text-sm border-slate-200 dark:border-slate-700 rounded border px-2 py-2 md:py-1.5 focus:border-blue-500 focus:outline-none dark:bg-slate-800" value={itemData.note1 || ''} onChange={e => handleUpdateItem(item.id, 'note1', e.target.value, item.type)} />
                        </div>
                      );
                    } else if (item.type === 'food_waste') {
                      inputHtml = (
                        <div className="flex flex-col md:flex-row md:items-center gap-2 w-full">
                           <select className="flex-none w-full md:w-auto text-sm font-bold border-slate-200 dark:border-slate-700 rounded border px-2 py-2 md:py-1.5 focus:border-blue-500 focus:outline-none dark:bg-slate-800" value={itemData.note2 || ''} onChange={e => handleUpdateItem(item.id, 'note2', e.target.value, item.type)}>
                             <option value="">수거 방식 선택</option>
                             <option value="음식물수거통">음식물수거통</option>
                             <option value="음식물처리기">음식물처리기</option>
                           </select>
                           <input type="text" placeholder="비고 작성란" className="flex-1 min-w-0 text-sm border-slate-200 dark:border-slate-700 rounded border px-2 py-2 md:py-1.5 focus:border-blue-500 focus:outline-none dark:bg-slate-800" value={itemData.note1 || ''} onChange={e => handleUpdateItem(item.id, 'note1', e.target.value, item.type)} />
                        </div>
                      );
                    } else if (item.type === 'file_date') {
                      const attachedFiles = getItemFiles(itemData);
                      inputHtml = (
                        <div className="flex flex-col gap-1 w-full">
                          <div className="flex flex-col md:flex-row md:items-center gap-2">
                            <input type="date" className="flex-none w-full md:w-[130px] text-sm font-bold text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 rounded border px-2 py-2 md:py-1.5 focus:border-blue-500 focus:outline-none dark:bg-slate-800" value={itemData.note3 || ''} onChange={e => handleUpdateItem(item.id, 'note3', e.target.value, item.type)} />
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <input type="text" placeholder="메모 입력" className="flex-1 min-w-0 text-sm border-slate-200 dark:border-slate-700 rounded border px-2 py-2 md:py-1.5 focus:border-blue-500 focus:outline-none dark:bg-slate-800" value={itemData.note1 || ''} onChange={e => handleUpdateItem(item.id, 'note1', e.target.value, item.type)} />
                              <input type="file" id={`file-${item.id}`} className="hidden" multiple onChange={(e) => handleFileUpload(e, item.id)} />
                              <label htmlFor={`file-${item.id}`} className="shrink-0 p-2 md:p-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded cursor-pointer transition-colors print:hidden" title="파일 첨부 (다중 선택 가능)">
                                {uploadingItem === item.id ? <span className="animate-spin inline-block text-sm">⏳</span> : <UploadCloud size={16} />}
                              </label>
                            </div>
                          </div>
                          {attachedFiles.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 print:hidden">
                              {attachedFiles.map((f, i) => (
                                <div key={i} className="flex items-center gap-1 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-md px-2 py-1 max-w-[240px]">
                                  <FileText size={11} className="text-blue-500 shrink-0" />
                                  <a href={f.url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 dark:text-blue-400 truncate hover:underline" title={f.name}>{f.name}</a>
                                  <button onClick={() => handleFileDelete(item.id, f.url)} className="shrink-0 p-0.5 text-rose-400 hover:text-rose-600 ml-0.5" title="삭제">
                                    <X size={11} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                          {attachedFiles.length > 0 && (
                            <div className="hidden print:flex flex-wrap gap-1">
                              {attachedFiles.map((f, i) => (
                                <span key={i} className="text-xs text-blue-700 underline">{f.name}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    } else if (item.type === 'password') {
                      if (!unlockedItems[item.id]) {
                        inputHtml = (
                          <div className="flex flex-col md:flex-row items-start md:items-center gap-2 w-full relative print:hidden">
                            <button onClick={() => { setUnlockAdminId(item.id); setAdminPwdInput(''); }} className="flex-1 w-full py-2 md:py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded border border-slate-200 dark:border-slate-700 text-sm font-bold flex items-center justify-center gap-2 hover:bg-slate-200 transition-colors">
                              <Lock size={14} /> 권한 정보 보기 (관리자 암호 필요)
                            </button>
                            {unlockAdminId === item.id && (
                               <div className="absolute left-0 top-full mt-1 p-2 bg-white dark:bg-slate-800 shadow-xl border border-slate-200 dark:border-slate-700 rounded-lg flex gap-2 z-50 animate-in fade-in zoom-in-95">
                          <input type="password" placeholder="보안 마스터 암호 입력" autoFocus value={adminPwdInput} onChange={e=>setAdminPwdInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter') verifyAdminPwd(item.id);}} className="text-xs border px-2 py-1.5 rounded w-40 dark:bg-slate-900 focus:outline-none focus:border-blue-500" />
                                  <button onClick={() => verifyAdminPwd(item.id)} className="bg-slate-900 text-white text-xs px-3 py-1.5 rounded font-bold hover:bg-slate-800">확인</button>
                               </div>
                            )}
                            <input type="text" placeholder="비고 작성란" className="flex-1 w-full min-w-0 text-sm border-slate-200 dark:border-slate-700 rounded border px-2 py-2 md:py-1.5 focus:border-blue-500 focus:outline-none dark:bg-slate-800" value={itemData.note1 || ''} onChange={e => handleUpdateItem(item.id, 'note1', e.target.value, item.type)} />
                          </div>
                        );
                      } else {
                        inputHtml = (
                          <div className="flex flex-col md:flex-row md:items-center gap-2 w-full animate-in fade-in slide-in-from-top-1">
                             <input type="text" placeholder="접속 아이디" className="flex-1 w-full md:w-32 min-w-0 text-sm border-slate-200 dark:border-slate-700 rounded border px-2 py-2 md:py-1.5 focus:border-blue-500 focus:outline-none dark:bg-slate-800 font-bold" value={itemData.note2 || ''} onChange={e => handleUpdateItem(item.id, 'note2', e.target.value, item.type)} />
                             <div className="relative flex-1 w-full md:w-32 min-w-0">
                                <input type="text" placeholder="비밀번호" className="w-full text-sm font-bold border-slate-200 dark:border-slate-700 rounded border pl-2 pr-8 py-2 md:py-1.5 focus:border-blue-500 focus:outline-none dark:bg-slate-800" value={itemData.note3 || ''} onChange={e => handleUpdateItem(item.id, 'note3', e.target.value, item.type)} />
                                <button onClick={() => setUnlockedItems(p => ({...p, [item.id]: false}))} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 print:hidden">
                                  <Unlock size={14}/>
                                </button>
                             </div>
                             <input type="text" placeholder="비고 작성란" className="flex-1 w-full min-w-0 text-sm border-slate-200 dark:border-slate-700 rounded border px-2 py-2 md:py-1.5 focus:border-blue-500 focus:outline-none dark:bg-slate-800" value={itemData.note1 || ''} onChange={e => handleUpdateItem(item.id, 'note1', e.target.value, item.type)} />
                          </div>
                        );
                      }
                    } else if (item.type === 'staffing') {
                      inputHtml = (
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 w-full">
                          {['홀 직원', '홀 파트', '주방 직원', '주방 파트'].map((label, i) => (
                            <div key={label} className="flex items-center gap-2 border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5 md:py-1 bg-white dark:bg-slate-800 focus-within:border-blue-400 transition">
                               <span className="text-[10px] text-slate-500 font-bold w-8 text-center leading-tight">{label.split(' ')[0]}<br className="hidden md:block"/>{label.split(' ')[1]}</span>
                               <input type="number" placeholder="0명" className="w-full text-sm font-bold focus:outline-none bg-transparent dark:text-white" value={itemData[`note${i+1}`] || ''} onChange={e => handleUpdateItem(item.id, `note${i+1}`, e.target.value, item.type)} />
                            </div>
                          ))}
                        </div>
                      );
                    } else if (item.type === 'training' || item.type === 'training_payment') {
                      // 💡 양방향 동기화 시각적 가이드 추가
                      inputHtml = (
                        <div className="flex flex-col gap-2 w-full">
                          <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3 text-sm">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-500 w-8 shrink-0">장소</span>
                              <select className="flex-1 md:flex-none w-auto border border-slate-200 dark:border-slate-700 rounded px-2 py-2 md:py-1 focus:border-blue-500 dark:bg-slate-800 font-bold text-slate-800 dark:text-slate-200" value={itemData.note1 || ''} onChange={e => handleUpdateItem(item.id, 'note1', e.target.value, item.type)}>
                                <option value="">선택</option>
                                {['예당마을점', '남원점', '청주율량점', '직접입력'].map(opt => <option key={opt} value={opt}>{opt}</option>)}
                              </select>
                              {itemData.note1 === '직접입력' && <input type="text" placeholder="직접입력" className="flex-1 md:w-24 border border-slate-200 dark:border-slate-700 rounded px-2 py-2 md:py-1 dark:bg-slate-800 min-w-0" value={itemData.note2 || ''} onChange={e => handleUpdateItem(item.id, 'note2', e.target.value, item.type)} />}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-500 md:ml-2 w-8 md:w-auto shrink-0">인원</span>
                              <select className="flex-1 md:flex-none border border-slate-200 dark:border-slate-700 rounded px-2 py-2 md:py-1 focus:border-blue-500 dark:bg-slate-800 font-bold text-slate-800 dark:text-slate-200" value={itemData.note7 || ''} onChange={e => handleUpdateItem(item.id, 'note7', e.target.value, item.type)}>
                                <option value="">선택</option>
                                {[1,2,3,4,5].map(n => <option key={n} value={`${n}명`}>{n}명</option>)}
                              </select>
                            </div>
                          </div>
                          <div className="flex flex-col xl:flex-row xl:items-center gap-2 text-sm mt-1 md:mt-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-slate-500 w-8 shrink-0">일시</span>
                              <input type="date" className="flex-1 md:w-[115px] text-xs border border-slate-200 dark:border-slate-700 rounded px-1.5 py-2 md:py-1 font-bold focus:border-blue-500 dark:bg-slate-800 text-slate-800 dark:text-slate-200" value={itemData.note3 || ''} onChange={e => handleUpdateItem(item.id, 'note3', e.target.value, item.type)} />
                              <span className="text-slate-400">~</span>
                              <input type="date" className="flex-1 md:w-[115px] text-xs border border-slate-200 dark:border-slate-700 rounded px-1.5 py-2 md:py-1 font-bold focus:border-blue-500 dark:bg-slate-800 text-slate-800 dark:text-slate-200" value={itemData.note4 || ''} onChange={e => handleUpdateItem(item.id, 'note4', e.target.value, item.type)} />
                            </div>
                            <div className="flex items-center gap-1.5 mt-1 md:mt-0">
                              <span className="text-xs font-bold text-slate-500 w-8 xl:ml-2 shrink-0">시간</span>
                              <select className="flex-1 md:w-[70px] text-sm border border-slate-200 dark:border-slate-700 rounded px-1 py-2 md:py-1 focus:border-blue-500 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold" value={itemData.note5 || ''} onChange={e => handleUpdateItem(item.id, 'note5', e.target.value, item.type)}>
                                 <option value="">시작</option>
                                 {timeOptions(itemData.note5)}
                              </select>
                              <span className="text-slate-400">~</span>
                              <select className="flex-1 md:w-[70px] text-sm border border-slate-200 dark:border-slate-700 rounded px-1 py-2 md:py-1 focus:border-blue-500 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold" value={itemData.note6 || ''} onChange={e => handleUpdateItem(item.id, 'note6', e.target.value, item.type)}>
                                 <option value="">종료</option>
                                 {timeOptions(itemData.note6)}
                              </select>
                            </div>
                          </div>
                          {item.type === 'training_payment' && (
                            <div className="flex items-center gap-2 mt-2 md:mt-0 pt-2 md:pt-0 border-t md:border-none border-slate-100 dark:border-slate-800 w-full md:w-auto">
                              <span className="text-xs font-bold text-slate-500 w-8 md:w-auto shrink-0">교육비</span>
                              <select className={`flex-1 md:flex-none border rounded px-2 py-2 md:py-1.5 font-bold text-sm focus:outline-none focus:border-blue-500 dark:bg-slate-800 ${itemData.note8 === '미입금' ? 'border-rose-300 text-rose-600 bg-rose-50 dark:bg-rose-900/20' : itemData.note8 === '입금' ? 'border-emerald-300 text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20' : 'border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200'}`} value={itemData.note8 || ''} onChange={e => handleUpdateItem(item.id, 'note8', e.target.value, item.type)}>
                                 <option value="">결제 상태</option>
                                 <option value="입금">입금 (완료)</option>
                                 <option value="미입금">미입금 (대기)</option>
                              </select>
                            </div>
                          )}
                          <p className="text-[10px] text-indigo-500 font-bold flex items-center gap-1 mt-1 leading-tight"><Info size={12} className="shrink-0"/> 일정을 변경하면 캘린더/간트차트에 즉시 동기화됩니다.</p>
                        </div>
                      );
                    } else {
                      inputHtml = <input type="text" placeholder="비고 작성란 (선택)" className="w-full text-sm border-slate-200 dark:border-slate-700 rounded border px-2 py-2 md:py-1.5 focus:border-blue-500 focus:outline-none bg-transparent hover:bg-white dark:hover:bg-slate-800 transition" value={itemData.note1 || ''} onChange={e => handleUpdateItem(item.id, 'note1', e.target.value, item.type)} />;
                    }

                    return (
                      <tr key={item.id} className="hover:bg-blue-50/30 dark:hover:bg-slate-800/50 transition-colors group block md:table-row print:table-row border-b border-slate-100 dark:border-slate-800 md:border-b-0 print:border-b p-4 md:p-0 print:p-1 print:break-inside-avoid">
                        <td className="py-3 px-3 print:py-1 print:px-1 text-center text-slate-400 font-mono text-xs hidden md:table-cell print:table-cell">{index + 1}</td>
                        <td className="py-1 md:py-3 px-0 md:px-3 print:py-1 print:px-1 font-bold text-sm text-slate-800 dark:text-slate-200 break-keep leading-snug block md:table-cell print:table-cell mb-2 md:mb-0 print:m-0">
                          <div className="flex items-center gap-2">
                             <span className="md:hidden print:hidden text-xs text-slate-400 font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">{index + 1}</span>
                             {item.text}
                          </div>
                        </td>
                        <td className="py-1 md:py-3 px-0 md:px-3 print:py-1 print:px-1 text-center align-top pt-1 md:pt-3 print:pt-1 block md:table-cell print:table-cell mb-3 md:mb-0 print:m-0">
                           <button onClick={() => cycleStatus(item.id)} className={`w-full py-2.5 md:py-1.5 print:py-0.5 px-2 rounded border text-xs print:text-[10px] font-black tracking-widest transition-all shadow-sm print:border-2 whitespace-nowrap ${statusObj.class}`}>
                              {statusObj.label}
                           </button>
                        </td>
                        <td className="py-1 md:py-3 px-0 md:px-3 print:py-1 print:px-1 align-top pt-1 md:pt-3 print:pt-1 block md:table-cell print:table-cell">
                           {inputHtml}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-6 text-center print:hidden">
            <CheckSquare size={48} className="mb-4 text-slate-300 dark:text-slate-700" strokeWidth={1.5} />
            <h3 className="text-lg font-black text-slate-700 dark:text-slate-300 mb-2 tracking-tight">대시보드 매장을 선택해주세요</h3>
            <p className="text-sm font-medium">왼쪽 목록에서 매장을 선택하면<br/>상세 체크리스트와 파일을 관리할 수 있습니다.</p>
          </div>
        )}
      </div>

      {/* 마스터 체크리스트 편집 모달 (Drag & Drop) */}
      {masterModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4 print:hidden">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-[#FDFBF7] dark:bg-slate-800/50 rounded-t-xl flex justify-between items-center shrink-0">
              <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">체크리스트 마스터 설정</h2>
              <button onClick={() => { setMasterModalOpen(false); setMasterList((processSettings as any).masterChecklist || DEFAULT_MASTER_CHECKLIST); }} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            
            <div className="p-4 border-b bg-indigo-50 dark:bg-indigo-900/20 dark:border-slate-800 shrink-0">
               <p className="text-xs text-indigo-700 dark:text-indigo-400 mb-3 font-bold flex items-start gap-1"><Info size={14} className="shrink-0 mt-0.5"/> 항목을 드래그하여 순서를 변경할 수 있습니다. 여기서 편집된 항목은 모든 매장의 리스트에 즉시 반영됩니다.</p>
               <div className="flex gap-2">
                 <select value={newItemType} onChange={e => setNewItemType(e.target.value)} className="w-32 text-sm border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-2 focus:outline-none focus:border-indigo-500 dark:bg-slate-800 font-bold text-slate-700 dark:text-slate-300">
                   {ITEM_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                 </select>
                 <input type="text" placeholder="새로운 항목 이름 입력..." className="flex-1 text-sm border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500 dark:bg-slate-800 font-bold" value={newItemText} onChange={e => setNewItemText(e.target.value)} onKeyDown={e => { if(e.key==='Enter') { if(newItemText) { setMasterList([...masterList, {id:`item_${Date.now()}`, text:newItemText, type:newItemType}]); setNewItemText(''); } } }} />
                 <button onClick={() => { if(newItemText){ setMasterList([...masterList, {id:`item_${Date.now()}`, text:newItemText, type:newItemType}]); setNewItemText(''); } }} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 font-bold text-sm shadow-sm transition">추가</button>
               </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 bg-slate-50 dark:bg-slate-950/50">
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={masterList} strategy={verticalListSortingStrategy}>
                  <ul className="space-y-2">
                    {masterList.map((item, i) => (
                      <SortableItem key={item.id} item={item} index={i} onUpdate={(id:string, val:string) => setMasterList(prev => prev.map(m => m.id === id ? {...m, text: val} : m))} onDelete={(id:string) => setMasterList(prev => prev.filter(m => m.id !== id))} />
                    ))}
                  </ul>
                </SortableContext>
              </DndContext>
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2 shrink-0">
              <button onClick={() => { setMasterModalOpen(false); setMasterList((processSettings as any).masterChecklist || DEFAULT_MASTER_CHECKLIST); }} className="px-4 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg font-bold text-sm">취소</button>
              <button onClick={async () => { await onUpdateMasterList(masterList); toast.success('마스터 설정이 저장되었습니다.'); setMasterModalOpen(false); }} className="px-6 py-2 text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg font-bold text-sm shadow-md">저장 및 동기화</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}