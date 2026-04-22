import React from 'react';
import { AlertTriangle, Star, Minus, Trophy, ArrowUp, ArrowDown } from 'lucide-react';

export function KpiCard({ label, value, sub, color, icon }: {
  label: string; value: string | number; sub?: string;
  color?: string; icon?: React.ReactNode;
}) {
  return (
    <div className="bg-[#FDFBF7] dark:bg-stone-900 rounded-sm border border-stone-300 dark:border-stone-700 p-6 shadow-none hover:bg-white dark:hover:bg-stone-800 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-bold text-stone-500 dark:text-stone-400 tracking-widest">{label}</p>
        {icon && <span className="text-stone-400 dark:text-stone-500">{icon}</span>}
      </div>
      <p className={`text-3xl font-black tracking-tighter ${color || 'text-stone-900 dark:text-white'}`}>{value}</p>
      {sub && <p className="text-[11px] font-bold text-stone-400 mt-2 tracking-wide">{sub}</p>}
    </div>
  );
}

export function SentimentBadge({ sentiment }: { sentiment: string }) {
  if (sentiment === '긍정') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800 shrink-0">
      <Star size={9} fill="currentColor" /> 긍정
    </span>
  );
  if (sentiment === '부정') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 border border-rose-100 dark:border-rose-800 shrink-0">
      <AlertTriangle size={9} /> 부정
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 shrink-0">
      <Minus size={9} /> 중립
    </span>
  );
}

export function RankBadge({ rank }: { rank: number }) {
  const r = Number(rank);
  if (r >= 999) return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700">노출 실패</span>;
  if (r <= 3) return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-100 dark:border-amber-800"><Trophy size={9} /> {r}위</span>;
  if (r <= 5) return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800">{r}위</span>;
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 border border-rose-100 dark:border-rose-800">{r}위</span>;
}

export function TrendBadge({ trend }: { trend: string }) {
  if (!trend || trend === '-') return <span className="text-xs text-slate-400">-</span>;
  if (trend.includes('▲') || trend.includes('상승') || trend.includes('진입')) return (
    <span className="inline-flex items-center gap-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
      <ArrowUp size={10} /> {trend.replace('▲', '').trim()}
    </span>
  );
  if (trend.includes('▼') || trend.includes('하락') || trend.includes('이탈')) return (
    <span className="inline-flex items-center gap-0.5 text-xs font-medium text-rose-600 dark:text-rose-400">
      <ArrowDown size={10} /> {trend.replace('▼', '').trim()}
    </span>
  );
  return <span className="text-xs text-slate-400">{trend}</span>;
}

export function EmptyState({ icon, message }: { icon: React.ReactNode; message: string }) {
  return (
    <div className="py-16 text-center">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 mb-3">{icon}</div>
      <p className="text-sm text-slate-500 dark:text-slate-400">{message}</p>
    </div>
  );
}
