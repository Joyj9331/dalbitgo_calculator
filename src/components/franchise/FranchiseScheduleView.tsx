import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../firebase';
import { collection, getDocs, setDoc, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { FranchiseSchedule, TeamSetting, ScheduleStatus, BrandId } from '../../types';
import { Plus, Download, Search, FileDown, Settings, Calendar as CalendarIcon, AlignLeft, Printer } from 'lucide-react';
import { useToast } from '../Toast';
import { useConfirm } from '../ConfirmModal';
import Papa from 'papaparse';

// Subcomponents
import { ScheduleTimeline } from './ScheduleTimeline';
import { ScheduleCalendar } from './ScheduleCalendar';
import { ScheduleFormModal } from './ScheduleFormModal';
import { TeamSettingsModal } from './TeamSettingsModal';

interface Props {
  brandId: BrandId;
}

export function FranchiseScheduleView({ brandId }: Props) {
  const toast = useToast();
  const { confirm } = useConfirm();

  // Data states
  const [schedules, setSchedules] = useState<FranchiseSchedule[]>([]);
  const [teams, setTeams] = useState<TeamSetting[]>([]);
  const [loading, setLoading] = useState(true);

  // View states
  const [viewMode, setViewMode] = useState<'timeline' | 'calendar'>('timeline');
  const [search, setSearch] = useState('');
  const [filterTeam, setFilterTeam] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>(''); // empty means all
  
  // Date states for views
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Modal states
  const [showForm, setShowForm] = useState(false);
  const [editingData, setEditingData] = useState<Partial<FranchiseSchedule> | null>(null);
  const [showTeamSettings, setShowTeamSettings] = useState(false);

  useEffect(() => {
    fetchData();
  }, [brandId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [schSnap, teamSnap] = await Promise.all([
        getDocs(collection(db, 'franchise_schedules')),
        getDocs(collection(db, 'team_settings'))
      ]);

      const schData: FranchiseSchedule[] = [];
      schSnap.forEach(d => {
        const item = d.data() as FranchiseSchedule;
        if (item.brandId === brandId) schData.push(item);
      });
      setSchedules(schData);

      const teamData: TeamSetting[] = [];
      teamSnap.forEach(d => {
        const item = d.data() as TeamSetting;
        if (item.brandId === brandId) teamData.push(item);
      });
      setTeams(teamData);

    } catch (err) {
      toast.error('일정 데이터를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSchedule = async (data: Partial<FranchiseSchedule>) => {
    try {
      const isNew = !data.id;
      const id = isNew ? `sch_${Date.now()}` : data.id!;
      const fullData = {
        ...data,
        id,
        brandId,
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await setDoc(doc(db, 'franchise_schedules', id), fullData);
      toast.success(`일정이 ${isNew ? '등록' : '수정'}되었습니다.`);
      setShowForm(false);
      setEditingData(null);
      fetchData();
    } catch (err) {
      toast.error('일정 저장에 실패했습니다.');
      throw err; // Form 모달의 saving 상태 해제를 위해
    }
  };

  const handleDeleteSchedule = async (id: string) => {
    const ok = await confirm({ title: '일정 삭제', message: '정말 삭제하시겠습니까?', confirmLabel: '삭제', variant: 'danger' });
    if (!ok) return;
    try {
      await deleteDoc(doc(db, 'franchise_schedules', id));
      toast.success('일정이 삭제되었습니다.');
      fetchData();
    } catch (err) {
      toast.error('삭제 실패');
    }
  };

  const handleExportCsv = () => {
    if (filteredSchedules.length === 0) {
      toast.error('내보낼 데이터가 없습니다.');
      return;
    }
    const data = filteredSchedules.map(s => ({
      '매장명': s.storeName,
      '호수': s.storeNumber,
      '담당팀': s.team,
      'SV': s.supervisor,
      '진행상태': s.status,
      '구분': s.constructionType,
      '공사시작일': s.constructionStart,
      '공사종료일': s.constructionEnd,
      '오픈예정일': s.openDate,
      '특이사항': s.notes
    }));
    const csv = Papa.unparse(data);
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `가맹점일정_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  // 필터링 적용
  const filteredSchedules = useMemo(() => {
    return schedules.filter(s => {
      if (search && !s.storeName.includes(search)) return false;
      if (filterTeam && s.team !== filterTeam) return false;
      if (filterStatus && s.status !== filterStatus) return false;
      return true;
    }).sort((a, b) => {
       // 오픈일 순 정렬
       if (!a.openDate && !b.openDate) return 0;
       if (!a.openDate) return 1;
       if (!b.openDate) return -1;
       return a.openDate.localeCompare(b.openDate);
    });
  }, [schedules, search, filterTeam, filterStatus]);

  // 타임라인 날짜 범위: currentMonth 기준 전월 ~ 다담월 말
  // → 타임라인과 달력이 동일한 currentMonth 상태를 공유하므로 충 연동됨
  const timelineDates = useMemo(() => {
    const y = currentMonth.getFullYear();
    const m = currentMonth.getMonth();
    const start = new Date(y, m - 1, 1); // 전달 1일
    const end   = new Date(y, m + 2, 0); // 다담월 말일
    return {
      start: start.toISOString().split('T')[0],
      end:   end.toISOString().split('T')[0],
    };
  }, [currentMonth]);

  return (
    <div className="space-y-6">
       {/* 헤더 및 컨트롤 패널 */}
       <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
         <div>
           <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
             오픈 일정 관리
             <span className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-xs px-2 py-0.5 rounded-full font-bold">New</span>
           </h1>
           <p className="text-sm text-slate-500 mt-1">공사부터 오픈까지의 프로세스를 추적합니다.</p>
         </div>

         <div className="flex flex-wrap items-center gap-2">
           <button onClick={() => setShowTeamSettings(true)} className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 text-sm font-semibold rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
              <Settings size={15} /> 팀/권역 설정
           </button>
           <button onClick={handleExportCsv} className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 text-sm font-semibold rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
              <FileDown size={15} /> 엑셀 다운로드
           </button>
           <button onClick={() => { setEditingData({}); setShowForm(true); }} className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
              <Plus size={15} /> 일정 등록
           </button>
         </div>
       </div>

       {/* 상단 필터 바 */}
       <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
         <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
              <button 
                onClick={() => setViewMode('timeline')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'timeline' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
              ><AlignLeft size={14}/> 타임라인</button>
              <button 
                onClick={() => setViewMode('calendar')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'calendar' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
              ><CalendarIcon size={14}/> 월간달력</button>
            </div>
            
            {/* 월 이동 컨트롤 — 타임라인과 달력 모두에서 항상 표시 (currentMonth 공유) */}
            <div className="flex items-center gap-1 font-bold text-slate-700 dark:text-slate-300 ml-4">
               <button
                 className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition-colors text-slate-600 dark:text-slate-400"
                 onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
               >&lt;</button>
               <span className="tabular-nums text-sm px-1">{currentMonth.getFullYear()}년 {currentMonth.getMonth() + 1}월</span>
               <button
                 className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition-colors text-slate-600 dark:text-slate-400"
                 onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
               >&gt;</button>
               <button
                 className="ml-1 px-2 py-0.5 text-[10px] bg-red-50 text-red-500 dark:bg-red-900/20 dark:text-red-400 rounded font-bold hover:bg-red-100 transition-colors"
                 onClick={() => setCurrentMonth(new Date())}
               >오늘</button>
            </div>
         </div>

         <div className="flex flex-1 items-center gap-2 justify-end w-full md:w-auto">
            <select className="px-3 py-1.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg max-w-[120px] outline-none" value={filterTeam} onChange={e => setFilterTeam(e.target.value)}>
              <option value="">전체 팀</option>
              {teams.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
            </select>
            <select className="px-3 py-1.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg max-w-[120px] outline-none" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="">전체 상태</option>
              <option value="공사중">공사중</option>
              <option value="사전교육">사전교육</option>
              <option value="본교육">본교육</option>
              <option value="오픈완료">오픈완료</option>
            </select>
            <div className="relative flex-1 max-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="매장명 검색..." 
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-sm rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-blue-500"
              />
            </div>
         </div>
       </div>

       {/* 메인 뷰 */}
       {loading ? (
          <div className="py-20 text-center text-slate-400 font-bold">데이터를 불러오는 중입니다...</div>
       ) : (
          <div>
            {viewMode === 'timeline' ? (
              <div className="print-timeline">
                <ScheduleTimeline 
                   schedules={filteredSchedules} 
                   viewStartDate={timelineDates.start} 
                   viewEndDate={timelineDates.end} 
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
                {/* 1번 달력 (기준 달) */}
                <div>
                  <h3 className="text-center font-bold text-slate-800 dark:text-slate-200 mb-3 text-sm">
                    {currentMonth.getFullYear()}년 {currentMonth.getMonth() + 1}월
                  </h3>
                  <ScheduleCalendar 
                     schedules={filteredSchedules}
                     currentMonth={currentMonth}
                  />
                </div>
                {/* 2번 달력 (다음 달) */}
                <div>
                  <h3 className="text-center font-bold text-slate-800 dark:text-slate-200 mb-3 text-sm">
                    {new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1).getFullYear()}년 {new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1).getMonth() + 1}월
                  </h3>
                  <ScheduleCalendar 
                     schedules={filteredSchedules}
                     currentMonth={new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1)}
                  />
                </div>
              </div>
            )}
            
            {/* 리스트 (빠른 수정/삭제용 하단 테이블) */}
            {viewMode === 'timeline' && (
              <div className="mt-8">
                 <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-3 ml-1">진행중인 매장 목록 ({filteredSchedules.length}건)</h3>
                 <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 shadow-sm">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                      <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 text-xs">
                        <tr>
                          <th className="p-3">상호명</th>
                          <th className="p-3">상태</th>
                          <th className="p-3">담당</th>
                          <th className="p-3">오픈예정</th>
                          <th className="p-3">특이사항</th>
                          <th className="p-3 w-20">관리</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {filteredSchedules.map(sch => (
                          <tr key={sch.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                            <td className="p-3 font-bold text-slate-800 dark:text-slate-200">
                              <button onClick={() => { setEditingData(sch); setShowForm(true); }} className="hover:underline hover:text-blue-600">
                                {sch.storeName}
                              </button>
                            </td>
                            <td className="p-3">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                {sch.status}
                              </span>
                            </td>
                            <td className="p-3 text-xs text-slate-500">{sch.team} {sch.supervisor}</td>
                            <td className="p-3 text-xs font-semibold text-rose-500">{sch.openDate}</td>
                            <td className="p-3 text-xs text-slate-500 truncate max-w-[200px]">{sch.notes}</td>
                            <td className="p-3 text-xs">
                              <button onClick={() => handleDeleteSchedule(sch.id)} className="text-red-500 hover:underline">삭제</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                 </div>
              </div>
            )}
          </div>
       )}

       {/* 모달 */}
       {showForm && (
         <ScheduleFormModal 
           initial={editingData || {}} 
           teams={teams}
           onSave={handleSaveSchedule} 
           onClose={() => { setShowForm(false); setEditingData(null); }} 
         />
       )}

       {showTeamSettings && (
         <TeamSettingsModal 
            brandId={brandId}
            onClose={() => setShowTeamSettings(false)}
         />
       )}
    </div>
  );
}
