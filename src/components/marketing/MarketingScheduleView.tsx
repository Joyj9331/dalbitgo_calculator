import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy, where, updateDoc, doc } from 'firebase/firestore';
import { reviewDb } from '../../firebase';
import { MarketingSchedule } from '../../types';
import { useToast } from '../Toast';
import { Copy, Clock, CheckCircle } from 'lucide-react';

// ✅ Vercel 에러 방지: 기존 타입에 status 속성 추가 인정해주기
interface ExtendedSchedule extends MarketingSchedule {
  status?: string;
}

export function MarketingScheduleView({ activeBrand }: { activeBrand: string | null }) {
  const [schedules, setSchedules] = useState<ExtendedSchedule[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const toast = useToast();

  useEffect(() => {
    let q = query(collection(reviewDb, 'marketing_schedules'), orderBy('createdAt', 'desc'));
    if (activeBrand) {
      q = query(collection(reviewDb, 'marketing_schedules'), where('brandId', '==', activeBrand), orderBy('createdAt', 'desc'));
    }

    const unsub = onSnapshot(q, (snap) => {
      const data: ExtendedSchedule[] = [];
      snap.forEach(doc => {
        data.push({ id: doc.id, ...doc.data() } as ExtendedSchedule);
      });
      setSchedules(data);
      if (data.length > 0 && !selectedId) {
        setSelectedId(data[0].id);
      }
    });

    return () => unsub();
  }, [activeBrand]);

  const selectedItem = schedules.find(s => s.id === selectedId);

  const copyToClipboard = (text: string, platform: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${platform} 텍스트가 클립보드에 복사되었습니다.`);
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      await updateDoc(doc(reviewDb, 'marketing_schedules', id), { status: newStatus });
      toast.success('상태가 변경되었습니다.');
    } catch (error) {
      toast.error('상태 변경에 실패했습니다.');
    }
  };

  const filteredSchedules = schedules.filter(s => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'pending') return s.status === 'pending' || !s.status;
    return s.status === statusFilter;
  });

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col lg:flex-row min-h-[600px]">
      
      {/* 리스트 패널 */}
      <div className="w-full lg:w-1/3 border-r border-slate-200 dark:border-slate-800 flex flex-col bg-slate-50 dark:bg-slate-900">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <Clock size={16} className="text-blue-500" /> 보관된 원고 ({filteredSchedules.length}건)
            </h3>
          </div>
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
            {(['all', 'pending', 'completed'] as const).map(f => (
              <button key={f} onClick={() => setStatusFilter(f)} className={`flex-1 text-xs font-semibold py-1.5 rounded-md transition-colors ${statusFilter === f ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                {f === 'all' ? '전체' : f === 'pending' ? '대기중' : '발행완료'}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filteredSchedules.length === 0 ? (
             <div className="p-6 text-center text-sm text-slate-500">저장된 스케줄이 없습니다.</div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredSchedules.map(item => {
                const isPending = item.status === 'pending' || !item.status;
                return (
                <button
                  key={item.id}
                  onClick={() => setSelectedId(item.id)}
                  className={`w-full text-left p-4 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 ${selectedId === item.id ? 'bg-blue-50 dark:bg-blue-900/20 border-l-2 border-blue-500' : 'border-l-2 border-transparent'}`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-semibold text-sm text-slate-800 dark:text-slate-200">{item.storeName}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${isPending ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'}`}>
                      {isPending ? '대기중' : '발행완료'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {new Date(item.createdAt).toLocaleString('ko-KR')}
                  </div>
                </button>
              )})}
            </div>
          )}
        </div>
      </div>

      {/* 디테일 뷰어 패널 */}
      <div className="w-full lg:w-2/3 p-6 flex flex-col bg-white dark:bg-slate-900">
        {selectedItem ? (
          <div className="flex-1 flex flex-col space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-xl font-bold text-slate-800 dark:text-white">
                {selectedItem.storeName} 마케팅 원고
              </h2>
              <div className="flex gap-2">
                {(selectedItem.status === 'pending' || !selectedItem.status) ? (
                  <button onClick={() => handleStatusChange(selectedItem.id, 'completed')} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 rounded-lg transition-colors"><CheckCircle size={14}/> 발행 완료로 변경</button>
                ) : (
                  <button onClick={() => handleStatusChange(selectedItem.id, 'pending')} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-amber-50 text-amber-600 hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-400 border border-amber-200 dark:border-amber-800 rounded-lg transition-colors"><Clock size={14}/> 대기중으로 변경</button>
                )}
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 flex-1">
              {/* Naver */}
              <div className="flex flex-col bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="p-3 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                  <span className="font-bold text-sm text-green-600">네이버 블로그</span>
                  <button onClick={() => copyToClipboard(selectedItem.naverText, '네이버')} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white"><Copy size={14}/></button>
                </div>
                <div className="p-4 flex-1 overflow-y-auto">
                   <pre className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap font-sans leading-relaxed">{selectedItem.naverText}</pre>
                </div>
              </div>

               {/* Insta */}
               <div className="flex flex-col bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="p-3 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                  <span className="font-bold text-sm text-pink-500">인스타그램</span>
                  <button onClick={() => copyToClipboard(selectedItem.instaText, '인스타그램')} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white"><Copy size={14}/></button>
                </div>
                <div className="p-4 flex-1 overflow-y-auto">
                   <pre className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap font-sans leading-relaxed">{selectedItem.instaText}</pre>
                </div>
              </div>

               {/* Daangn */}
               <div className="flex flex-col bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="p-3 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                  <span className="font-bold text-sm text-orange-500">당근마켓</span>
                  <button onClick={() => copyToClipboard(selectedItem.daangnText, '당근마켓')} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white"><Copy size={14}/></button>
                </div>
                <div className="p-4 flex-1 overflow-y-auto">
                   <pre className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap font-sans leading-relaxed">{selectedItem.daangnText}</pre>
                </div>
              </div>
            </div>
            
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-400 dark:text-slate-600">
             스케줄을 선택하면 내용을 확인할 수 있습니다.
          </div>
        )}
      </div>
    </div>
  );
}
