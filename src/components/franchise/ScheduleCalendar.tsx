import React from 'react';
import { FranchiseSchedule } from '../../types';

interface Props {
  schedules: FranchiseSchedule[];
  currentMonth: Date; // e.g. new Date(2026, 3, 1) for April 2026
}

export function ScheduleCalendar({ schedules, currentMonth }: Props) {
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
    cells.push({ day: prevMonthDays - firstDay + i + 1, isCurrentMonth: false, fullDate: '' });
  }
  
  // 이번 달
  for (let i = 1; i <= daysInMonth; i++) {
    const fullDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    cells.push({ day: i, isCurrentMonth: true, fullDate });
  }
  
  // 다음 달 빈칸
  const remaining = 42 - cells.length; // 6주 보장
  for (let i = 1; i <= remaining; i++) {
    cells.push({ day: i, isCurrentMonth: false, fullDate: '' });
  }

  const getEventsForDate = (dateStr: string) => {
    if (!dateStr) return [];
    
    // 단순화 구현: 해당 날짜가 '오픈일' 이거나 '공사 시작일', '본교육 시작일' 인 경우만 표시
    const events = [];
    schedules.forEach(s => {
      if (!s.showInCalendar) return;
      
      if (s.openDate === dateStr) events.push({ text: `🎉 ${s.storeName} 오픈!`, color: 'bg-rose-500 text-white' });
      else if (s.constructionStart === dateStr) events.push({ text: `🚧 ${s.storeName} 착공`, color: 'bg-amber-100 text-amber-800' });
      else if (s.trainingStart === dateStr) events.push({ text: `👨‍🏫 ${s.storeName} 교육`, color: 'bg-blue-100 text-blue-800' });
    });
    return events;
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
      <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800">
        {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (
          <div key={d} className={`p-2 text-center text-xs font-bold ${i === 0 ? 'text-rose-500' : i === 6 ? 'text-blue-500' : 'text-slate-500'}`}>
            {d}
          </div>
        ))}
      </div>
      
      <div className="grid grid-cols-7">
        {cells.map((cell, idx) => {
          const events = cell.isCurrentMonth ? getEventsForDate(cell.fullDate) : [];
          return (
            <div 
              key={idx} 
              className={`min-h-[100px] p-2 border-b border-r border-slate-100 dark:border-slate-800 flex flex-col ${!cell.isCurrentMonth ? 'bg-slate-50 dark:bg-slate-800/20 opacity-50' : ''}`}
            >
              <div className="text-right text-xs font-bold text-slate-400 mb-1">{cell.day}</div>
              <div className="flex-1 space-y-1 overflow-y-auto">
                {events.map((ev, i) => (
                  <div key={i} className={`text-[9px] px-1.5 py-0.5 rounded font-bold truncate ${ev.color}`} title={ev.text}>
                    {ev.text}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
