import React, { useState, useMemo } from 'react';
import { ShieldAlert, TrendingUp, TrendingDown, ChevronDown, ChevronUp, CheckCircle, Star, Activity, Store } from 'lucide-react';
import { Review, ReviewState, getYesterday } from './types';
import { KpiCard, SentimentBadge, EmptyState } from './SharedComponents';

export function OverviewTab({ reviews, reviewState, onResolve, onOverride }: {
  reviews: Review[];
  reviewState: ReviewState;
  onResolve: (id: string) => void;
  onOverride: (id: string) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const yesterdayStr = getYesterday();

  const activeNegative = reviews
    .filter(r => r.감정분석 === '부정' && !reviewState.resolved.includes(r.id) && !reviewState.overridden.includes(r.id))
    .sort((a, b) => b.작성일.localeCompare(a.작성일));

  const positiveCount = reviews.filter(r => r.감정분석 === '긍정').length;
  const positiveRate = reviews.length > 0 ? Math.round(positiveCount / reviews.length * 100) : 0;

  const storeRanking = useMemo(() => {
    const allStores = [...new Set(reviews.map(r => r.매장명))];
    const yesterdayReviews = reviews.filter(r => r.작성일 === yesterdayStr);
    return allStores
      .map(store => ({ store, count: yesterdayReviews.filter(r => r.매장명 === store).length }))
      .sort((a, b) => b.count - a.count);
  }, [reviews, yesterdayStr]);

  const brandStats = useMemo(() => {
    const companions: Record<string, number> = {};
    const times: Record<string, number> = {};
    const reactions: Record<string, number> = {};

    reviews.forEach(r => {
      if (r.동반자) r.동반자.split(',').forEach(c => { const t = c.trim(); if (t && t.toLowerCase() !== 'nan') companions[t] = (companions[t] || 0) + 1; });
      if (r.방문시간) r.방문시간.split(',').forEach(t => { const v = t.trim(); if (v && v.toLowerCase() !== 'nan') times[v] = (times[v] || 0) + 1; });
      if (r.고객반응_포인트) r.고객반응_포인트.split(',').forEach(p => {
        const t = p.trim();
        if (t && t.toLowerCase() !== 'num' && t.toLowerCase() !== 'nan' && isNaN(Number(t))) reactions[t] = (reactions[t] || 0) + 1;
      });
    });

    return {
      topCompanions: Object.entries(companions).sort((a, b) => b[1] - a[1]).slice(0, 3),
      topTimes: Object.entries(times).sort((a, b) => b[1] - a[1]).slice(0, 3),
      topReactions: Object.entries(reactions).sort((a, b) => b[1] - a[1]).slice(0, 8),
    };
  }, [reviews]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="누적 수집 리뷰" value={`${reviews.length.toLocaleString()}건`} sub="전체 가맹점 합산" icon={<Activity size={16} />} />
        <KpiCard label="미조치 부정 리뷰" value={`${activeNegative.length}건`} sub="즉각 조치 필요" icon={<ShieldAlert size={16} />}
          color={activeNegative.length > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'} />
        <KpiCard label="긍정 리뷰 비율" value={`${positiveRate}%`} sub={`${positiveCount.toLocaleString()}건 긍정`} icon={<Star size={16} />}
          color={positiveRate >= 70 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'} />
        <KpiCard label="모니터링 매장 수" value={`${new Set(reviews.map(r => r.매장명)).size}개`} sub="전국 가맹점" icon={<Store size={16} />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 lg:col-span-1">
          <h3 className="font-semibold text-sm text-slate-900 dark:text-white mb-4 flex items-center gap-2">👥 브랜드 주 고객층 (페르소나)</h3>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-slate-500 mb-1.5">주요 동반자</p>
              <div className="flex flex-wrap gap-1.5">
                {brandStats.topCompanions.map(([name, count], idx) => (
                  <span key={name} className={`px-2.5 py-1 text-[11px] font-bold rounded-lg ${idx === 0 ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border border-purple-200 dark:border-purple-800' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
                    {name} <span className="opacity-60 font-normal">{count}</span>
                  </span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1.5">주요 방문 시간대</p>
              <div className="flex flex-wrap gap-1.5">
                {brandStats.topTimes.map(([name, count], idx) => (
                  <span key={name} className={`px-2.5 py-1 text-[11px] font-bold rounded-lg ${idx === 0 ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
                    {name} <span className="opacity-60 font-normal">{count}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 lg:col-span-2">
          <h3 className="font-semibold text-sm text-slate-900 dark:text-white mb-4 flex items-center gap-2">💬 전국 매장 공통 반응 포인트 (Brand Core Value)</h3>
          <div className="flex flex-wrap gap-2 mt-2">
            {brandStats.topReactions.map(([name, count], idx) => (
              <div key={name} className={`flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-slate-800 rounded-full shadow-sm border ${idx < 3 ? 'border-emerald-200 dark:border-emerald-800/50' : 'border-slate-200 dark:border-slate-700'}`}>
                <span className={`text-xs font-bold ${idx < 3 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-300'}`}>#{name}</span>
                <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-900 px-1.5 py-0.5 rounded-md">{count}건</span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-slate-400 mt-4">※ 수집된 전체 리뷰 데이터를 기반으로 고객이 직접 선택한 키워드를 집계합니다.</p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
          <ShieldAlert size={15} className="text-rose-500" />
          <h3 className="font-semibold text-sm text-slate-900 dark:text-white">즉각 조치 요망</h3>
          <span className={`ml-auto text-xs font-semibold px-2 py-0.5 rounded-full border ${activeNegative.length > 0
            ? 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20 border-rose-100 dark:border-rose-800'
            : 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800'}`}>
            {activeNegative.length > 0 ? `${activeNegative.length}건 미조치` : '전체 조치 완료'}
          </span>
        </div>
        {activeNegative.length === 0 ? (
          <EmptyState icon={<CheckCircle size={20} className="text-emerald-400" />} message="미조치 부정 리뷰가 없습니다." />
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-96 overflow-y-auto">
            {activeNegative.map(review => (
              <div key={review.id} className="px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                <button className="w-full text-left" onClick={() => setExpandedId(expandedId === review.id ? null : review.id)}>
                  <div className="flex items-center gap-2">
                    <SentimentBadge sentiment={review.감정분석} />
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">{review.매장명}</span>
                    <span className="text-xs text-slate-400 shrink-0">{review.작성일}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 truncate flex-1">{review.리뷰내용.slice(0, 45)}...</span>
                    <span className="shrink-0 text-slate-300 dark:text-slate-600">
                      {expandedId === review.id ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </span>
                  </div>
                </button>
                {expandedId === review.id && (
                  <div className="mt-3 space-y-3">
                    <div className="bg-rose-50 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-800 rounded-lg p-3">
                      <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{review.리뷰내용}</p>
                    </div>
                    {(review.방문시간 && review.방문시간.toLowerCase() !== 'nan' || review.동반자 && review.동반자.toLowerCase() !== 'nan' || review.고객반응_포인트) && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {review.방문시간 && review.방문시간.toLowerCase() !== 'nan' && <span className="px-2 py-0.5 bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 text-[10px] font-medium rounded">{review.방문시간}</span>}
                        {review.동반자 && review.동반자.toLowerCase() !== 'nan' && <span className="px-2 py-0.5 bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400 text-[10px] font-medium rounded">{review.동반자}</span>}
                        {review.고객반응_포인트 && review.고객반응_포인트.split(',').map((pt, i) => {
                          const t = pt.trim();
                          return t && t.toLowerCase() !== 'num' && t.toLowerCase() !== 'nan' && isNaN(Number(t)) ? (
                            <span key={i} className="px-2 py-0.5 bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 text-[10px] font-medium rounded border border-slate-200 dark:border-slate-700">#{t}</span>
                          ) : null;
                        })}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button onClick={() => onResolve(review.id)} className="flex-1 py-2 text-xs font-semibold bg-slate-900 dark:bg-blue-600 text-white rounded-lg hover:bg-slate-700 dark:hover:bg-blue-700 transition-colors">
                        해피콜 조치 완료
                      </button>
                      <button onClick={() => onOverride(review.id)} className="flex-1 py-2 text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors border border-slate-200 dark:border-slate-700">
                        긍정 예외 처리
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[
          { title: '리뷰 활성화 우수 매장', icon: <TrendingUp size={15} className="text-emerald-500" />, stores: storeRanking.slice(0, 5), type: 'top' },
          { title: '리뷰 관리 필요 매장', icon: <TrendingDown size={15} className="text-amber-500" />, stores: [...storeRanking].reverse().slice(0, 5), type: 'bottom' },
        ].map(({ title, icon, stores, type }) => (
          <div key={title} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
              {icon}
              <h3 className="font-semibold text-sm text-slate-900 dark:text-white">{title}</h3>
              <span className="ml-auto text-xs text-slate-400">기준: {yesterdayStr}</span>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {stores.length === 0 ? (
                <div className="px-5 py-8 text-center text-xs text-slate-400">전일 데이터 없음</div>
              ) : stores.map((item, idx) => (
                <div key={item.store} className="px-5 py-3 flex items-center gap-3">
                  <span className={`w-5 h-5 flex items-center justify-center rounded-full text-xs font-bold shrink-0 ${type === 'top'
                    ? idx === 0 ? 'bg-amber-400 text-white' : idx === 1 ? 'bg-slate-300 dark:bg-slate-600 text-slate-700 dark:text-white' : idx === 2 ? 'bg-amber-700 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                    : 'bg-rose-50 dark:bg-rose-900/20 text-rose-500 border border-rose-100 dark:border-rose-800'}`}>
                    {type === 'top' ? idx + 1 : '!'}
                  </span>
                  <span className="text-sm text-slate-700 dark:text-slate-300 flex-1 truncate">{item.store}</span>
                  <span className={`text-sm font-bold shrink-0 ${item.count > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>{item.count}건</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
