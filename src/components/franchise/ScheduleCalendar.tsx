import React from 'react';
import { FranchiseSchedule, TeamSetting } from '../../types';
import { isDateInRange, addDays } from '../../utils';

interface Props {
  schedules: FranchiseSchedule[];
  currentMonth: Date; // e.g. new Date(2026, 3, 1) for April 2026
  teams: TeamSetting[];
  onScheduleUpdate: (id: string, updates: Partial<FranchiseSchedule>) => Promise<void>;
}

const PRESET_COLORS = [
  { id: 'blue', bgClass: 'bg-blue-500' },
  { id: 'rose', bgClass: 'bg-rose-500' },
  { id: 'emerald', bgClass: 'bg-emerald-500' },
  { id: 'amber', bgClass: 'bg-amber-500' },
  { id: 'purple', bgClass: 'bg-purple-500' },
  { id: 'cyan', bgClass: 'bg-cyan-500' },
  { id: 'pink', bgClass: 'bg-pink-500' },
  { id: 'slate', bgClass: 'bg-slate-500' },
];

export function ScheduleCalendar({ schedules, currentMonth, teams, onScheduleUpdate }: Props) {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  
  // 첫 날의 요일 (0 = 일요일)
  const firstDay = new Date(year, month, 1).getDay();
  // 이번 달의 총 일수
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  
  // 이전 달의 뒷부분 채우기용
  const prevMonthDays = new Date(year, month, 0).getDate();
  
  const cells = [];
  
  // 지난 달
  for (let i = 0; i < firstDay; i++) {
    const fullDate = `${year}-${String(month).padStart(2, '0')}-${String(prevMonthDays - firstDay + i + 1).padStart(2, '0')}`;
    // 만약 month가 0(1월)이면 이전년도 12월 처리 (단순화를 위해 여기서는 이번달 위주)
    // 좀 더 정확히 하려면 Date 의존
    const prevD = new Date(year, month, 0); // 전달 말일
    const pYear = prevD.getFullYear();
    const pMonth = prevD.getMonth() + 1; // 1~12
    const prDate = `${pYear}-${String(pMonth).padStart(2, '0')}-${String(prevMonthDays - firstDay + i + 1).padStart(2, '0')}`;
    cells.push({ day: prevMonthDays - firstDay + i + 1, isCurrentMonth: false, fullDate: prDate });
  }
  
  // 이번 달
  for (let i = 1; i <= daysInMonth; i++) {
    const fullDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    cells.push({ day: i, isCurrentMonth: true, fullDate });
  }
  
  // 다음 달 빈칸
  const remaining = 42 - cells.length; // 6주 보장
  for (let i = 1; i <= remaining; i++) {
    const nextD = new Date(year, month + 1, 1);
    const nYear = nextD.getFullYear();
    const nMonth = nextD.getMonth() + 1;
    const neDate = `${nYear}-${String(nMonth).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    cells.push({ day: i, isCurrentMonth: false, fullDate: neDate });
  }

  const getTeamColor = (teamName: string) => {
    const t = teams.find(t => t.name === teamName);
    const colorId = t?.color || 'slate';
    return PRESET_COLORS.find(c => c.id === colorId)?.bgClass || 'bg-slate-500';
  };

  const getEventsForDate = (dateStr: string) => {
    if (!dateStr) return [];
    
    const events: any[] = [];
    schedules.forEach(s => {
      if (s.showInCalendar === false) return;
      const teamBg = getTeamColor(s.team);

      // 공사 일정은 시작일, 마감일만 단일 블록으로 표시
      if (dateStr === s.constructionStart) {
        events.push({ scheduleId: s.id, phaseId: 'constructionStart', text: `🚧 ${s.storeName}-착공`, color: teamBg, isStart: true, isEnd: true });
      }
      if (dateStr === s.constructionEnd) {
        events.push({ scheduleId: s.id, phaseId: 'constructionEnd', text: `✅ ${s.storeName}-공사마감`, color: teamBg, isStart: true, isEnd: true });
      }

      const checkRange = (phaseId: string, textPrefix: string, start: string, end: string) => {
        if (isDateInRange(dateStr, start, end)) {
          events.push({
            scheduleId: s.id, phaseId, text: `${textPrefix} ${s.storeName}`, color: teamBg,
            isStart: dateStr === start, isEnd: dateStr === end
          });
        }
      };

      checkRange('oven', '🔥', s.ovenIn, s.ovenEnd);
      checkRange('initialStock', '📦', s.initialStockIn, s.initialStockEnd);
      checkRange('preTraining', '📝', s.preTrainingStart, s.preTrainingEnd);
      checkRange('training', '👨‍🏫', s.trainingStart, s.trainingEnd);

      if (s.openDate === dateStr) {
         events.push({ scheduleId: s.id, phaseId: 'open', text: `🎉 ${s.storeName}-오픈!`, color: teamBg, isStart: true, isEnd: true });
      }
    });

    return events;
  };

  const handleDragStart = (e: React.DragEvent, scheduleId: string, phaseId: string, draggedDate: string) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({ scheduleId, phaseId, draggedDate }));
  };

  const handleDrop = async (e: React.DragEvent, droppedDate: string) => {
    e.preventDefault();
    if (!droppedDate) return;
    
    const dragData = e.dataTransfer.getData('text/plain');
    if (!dragData) return;
    
    let parsed: any;
    try {
      parsed = JSON.parse(dragData);
    } catch(err) { return; }

    const { scheduleId, phaseId, draggedDate } = parsed;
    if (draggedDate === droppedDate) return;

    // 일수 차이 계산
    const diffTime = new Date(droppedDate).getTime() - new Date(draggedDate).getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    
    const schedule = schedules.find(s => s.id === scheduleId);
    if (!schedule) return;

    let updates: Partial<FranchiseSchedule> = {};

    if (phaseId === 'constructionStart') {
      updates.constructionStart = addDays(schedule.constructionStart, diffDays);
    } else if (phaseId === 'constructionEnd') {
      updates.constructionEnd = addDays(schedule.constructionEnd, diffDays);
    } else if (phaseId === 'oven') {
      updates.ovenIn = addDays(schedule.ovenIn, diffDays);
      updates.ovenEnd = addDays(schedule.ovenEnd, diffDays);
    } else if (phaseId === 'initialStock') {
      updates.initialStockIn = addDays(schedule.initialStockIn, diffDays);
      updates.initialStockEnd = addDays(schedule.initialStockEnd, diffDays);
    } else if (phaseId === 'preTraining') {
      updates.preTrainingStart = addDays(schedule.preTrainingStart, diffDays);
      updates.preTrainingEnd = addDays(schedule.preTrainingEnd, diffDays);
    } else if (phaseId === 'training') {
      updates.trainingStart = addDays(schedule.trainingStart, diffDays);
      updates.trainingEnd = addDays(schedule.trainingEnd, diffDays);
    } else if (phaseId === 'open') {
      updates.openDate = addDays(schedule.openDate, diffDays);
    }

    if (Object.keys(updates).length > 0) {
      await onScheduleUpdate(scheduleId, updates);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
      <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800">
        {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (
          <div key={d} className={`p-3 text-center text-sm font-bold ${i === 0 ? 'text-rose-500' : i === 6 ? 'text-blue-500' : 'text-slate-600 dark:text-slate-300'}`}>
            {d}
          </div>
        ))}
      </div>
      
      <div className="grid grid-cols-7">
        {cells.map((cell, idx) => {
          const events = getEventsForDate(cell.fullDate);
          return (
            <div 
              key={idx} 
              className={`min-h-[120px] py-1.5 border-b border-r border-slate-100 dark:border-slate-800 flex flex-col ${!cell.isCurrentMonth ? 'bg-slate-50 dark:bg-slate-800/20 opacity-50' : ''}`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDrop(e, cell.fullDate)}
            >
              <div className={`text-right px-2 text-sm font-bold mb-1.5 ${cell.isCurrentMonth ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400'}`}>{cell.day}</div>
              <div className="flex-1 space-y-1 overflow-y-auto min-h-[60px] pb-2">
                {events.map((ev, i) => {
                  const roundedCls = ev.isStart && ev.isEnd ? 'rounded' : ev.isStart ? 'rounded-l rounded-r-none' : ev.isEnd ? 'rounded-r rounded-l-none' : 'rounded-none';
                  const ml = ev.isStart ? 'ml-1' : 'ml-0';
                  const mr = ev.isEnd ? 'mr-1' : 'mr-0';
                  const pl = ev.isStart ? 'pl-2' : 'pl-1';

                  return (
                    <div 
                      key={i} 
                      className={`text-[11px] py-1 font-bold truncate text-white cursor-move hover:opacity-90 shadow-sm ${ev.color} ${roundedCls} ${ml} ${mr} ${pl}`} 
                      title={ev.text}
                      draggable
                      onDragStart={(e) => handleDragStart(e, ev.scheduleId, ev.phaseId, cell.fullDate)}
                    >
                      {ev.text}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
