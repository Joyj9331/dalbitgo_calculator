import React, { useState } from 'react';
import { MarketingGenerator } from './MarketingGenerator';
import { MarketingScheduleView } from './MarketingScheduleView';
import { Bot, CalendarDays } from 'lucide-react';

export function MarketingDashboard({ activeBrand }: { activeBrand: string | null }) {
  const [tab, setTab] = useState<'generate' | 'schedule'>('generate');

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span className="bg-gradient-to-r from-blue-600 to-indigo-600 text-transparent bg-clip-text">마케팅 프리패스</span>
            <span className="text-xs bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 px-2 py-0.5 rounded-full mt-1 border border-indigo-200 dark:border-indigo-800">
              AI 자동화
            </span>
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            리뷰 사진을 첨부하면 Gemini AI가 네이버, 인스타, 당근 맞춤형 원고를 자동 생성합니다.
          </p>
        </div>
        
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          <button
            onClick={() => setTab('generate')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === 'generate' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Bot size={16} /> 원고 생성
          </button>
          <button
            onClick={() => setTab('schedule')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === 'schedule' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <CalendarDays size={16} /> 스케줄러 보관함
          </button>
        </div>
      </div>

      <div className={tab === 'generate' ? 'block' : 'hidden'}>
        <MarketingGenerator activeBrand={activeBrand} />
      </div>
      <div className={tab === 'schedule' ? 'block' : 'hidden'}>
        <MarketingScheduleView activeBrand={activeBrand} />
      </div>
    </div>
  );
}
