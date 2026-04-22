import React, { useState, useMemo, useEffect } from 'react';
import { Search, Activity, Clock, Star, AlertTriangle, TrendingUp, Store } from 'lucide-react';
import { Review, getMonthRange } from './types';
import { KpiCard, SentimentBadge, EmptyState } from './SharedComponents';

export function StoreTab({ reviews }: { reviews: Review[] }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStore, setSelectedStore] = useState('');
  const [viewMode, setViewMode] = useState<'detail' | 'trend'>('detail');
  const [timeFilter, setTimeFilter] = useState('all');
  const [companionFilter, setCompanionFilter] = useState('all');

  const allStores = useMemo(() => [...new Set(reviews.map(r => r.매장명))].sort(), [reviews]);
  const filteredStores = searchQuery ? allStores.filter(s => s.replace(/ /g, '').includes(searchQuery.replace(/ /g, ''))) : allStores;

  useEffect(() => {
    if (filteredStores.length > 0 && !filteredStores.includes(selectedStore)) setSelectedStore(filteredStores[0]);
  }, [filteredStores]);

  const storeReviews = useMemo(() =>
    reviews.filter(r => r.매장명 === selectedStore).sort((a, b) => b.작성일.localeCompare(a.작성일)),
    [reviews, selectedStore]
  );

  const uniqueDays = new Set(storeReviews.map(r => r.작성일)).size;
  const dailyAvg = uniqueDays > 0 ? (storeReviews.length / uniqueDays).toFixed(1) : '0';
  const posCount = storeReviews.filter(r => r.감정분석 === '긍정').length;
  const negCount = storeReviews.filter(r => r.감정분석 === '부정').length;

  const trendData = useMemo(() => {
    const map: Record<string, { 긍정: number; 부정: number; 중립: number }> = {};
    storeReviews.forEach(r => {
      if (!map[r.작성일]) map[r.작성일] = { 긍정: 0, 부정: 0, 중립: 0 };
      map[r.작성일][r.감정분석 as '긍정' | '부정' | '중립']++;
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).slice(-14);
  }, [storeReviews]);

  const maxCount = Math.max(...trendData.map(([, v]) => v.긍정 + v.부정 + v.중립), 1);

  const storeTopReactions = storeReviews.length > 0 ? storeReviews[0].매장_TOP인기반응 : '';

  const monthlyTrend = useMemo(() => {
    const thisMonth = getMonthRange(0);
    const lastMonth = getMonthRange(-1);
    const twoMonthsAgo = getMonthRange(-2);

    const allStoreList = [...new Set(reviews.map(r => r.매장명))].sort();

    return allStoreList.map(store => {
      const storeRevs = reviews.filter(r => r.매장명 === store);
      const thisCount = storeRevs.filter(r => r.작성일 >= thisMonth.start && r.작성일 <= thisMonth.end).length;
      const lastCount = storeRevs.filter(r => r.작성일 >= lastMonth.start && r.작성일 <= lastMonth.end).length;
      const twoCount = storeRevs.filter(r => r.작성일 >= twoMonthsAgo.start && r.작성일 <= twoMonthsAgo.end).length;

      const diff = thisCount - lastCount;
      const diffRate = lastCount > 0 ? Math.round((diff / lastCount) * 100) : 0;
      const isWarning = lastCount > 0 && diffRate <= -30;
      const isGood = diffRate >= 30;

      return { 매장명: store, 이번달: thisCount, 지난달: lastCount, 전전달: twoCount, 증감수: diff, 증감률: diffRate, isWarning, isGood };
    });
  }, [reviews]);

  const thisMonthLabel = getMonthRange(0).label;
  const lastMonthLabel = getMonthRange(-1).label;
  const twoMonthsLabel = getMonthRange(-2).label;

  const warningStores = monthlyTrend.filter(s => s.isWarning);
  const goodStores = monthlyTrend.filter(s => s.isGood);

  const displayedReviews = useMemo(() => {
    return storeReviews.filter(r => {
      const matchTime = timeFilter === 'all' || (r.방문시간 && r.방문시간.includes(timeFilter));
      const matchCompanion = companionFilter === 'all' || (r.동반자 && r.동반자.includes(companionFilter));
      return matchTime && matchCompanion;
    });
  }, [storeReviews, timeFilter, companionFilter]);

  const timeOptions = useMemo(() => {
    const times = new Set<string>();
    storeReviews.forEach(r => { if (r.방문시간) r.방문시간.split(',').forEach(t => { const v = t.trim(); if (v && v.toLowerCase() !== 'nan') times.add(v); }); });
    return ['all', ...Array.from(times).filter(Boolean)];
  }, [storeReviews]);

  const companionOptions = useMemo(() => {
    const companions = new Set<string>();
    storeReviews.forEach(r => { if (r.동반자) r.동반자.split(',').forEach(c => { const v = c.trim(); if (v && v.toLowerCase() !== 'nan') companions.add(v); }); });
    return ['all', ...Array.from(companions).filter(Boolean)];
  }, [storeReviews]);

  const companionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    storeReviews.forEach(r => {
      if (r.동반자) r.동반자.split(',').forEach(c => { const t = c.trim(); if (t && t.toLowerCase() !== 'nan') counts[t] = (counts[t] || 0) + 1; });
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 3);
  }, [storeReviews]);

  const reactionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    storeReviews.forEach(r => {
      if (r.고객반응_포인트) r.고객반응_포인트.split(',').forEach(p => {
        const t = p.trim();
        if (t && t.toLowerCase() !== 'num' && t.toLowerCase() !== 'nan' && isNaN(Number(t))) counts[t] = (counts[t] || 0) + 1;
      });
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [storeReviews]);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <button onClick={() => setViewMode('detail')}
          className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${viewMode === 'detail' ? 'bg-slate-900 dark:bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>
          개별 매장 분석
        </button>
        <button onClick={() => setViewMode('trend')}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${viewMode === 'trend' ? 'bg-slate-900 dark:bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>
          월간 증감 추적
          {warningStores.length > 0 && (
            <span className="w-4 h-4 flex items-center justify-center bg-rose-500 text-white text-[10px] font-bold rounded-full">
              {warningStores.length}
            </span>
          )}
        </button>
      </div>

      {viewMode === 'detail' && (
        <>
          <div className="flex gap-3">
            <div className="relative flex-1 max-w-xs">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="매장명 검색"
                className="w-full pl-9 pr-4 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-blue-500 text-slate-900 dark:text-white placeholder-slate-400" />
            </div>
            <select value={selectedStore} onChange={e => setSelectedStore(e.target.value)}
              className="flex-1 py-2 px-3 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none text-slate-900 dark:text-white">
              {filteredStores.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {selectedStore && storeReviews.length > 0 ? (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard label="누적 수집 리뷰" value={`${storeReviews.length}건`} icon={<Activity size={16} />} />
                <KpiCard label="일평균 작성량" value={`${dailyAvg}건`} sub={`${uniqueDays}일치 데이터`} icon={<Clock size={16} />} />
                <KpiCard label="긍정 평가" value={`${posCount}건`} icon={<Star size={16} />} color="text-emerald-600 dark:text-emerald-400" />
                <KpiCard label="부정 평가" value={`${negCount}건`} icon={<AlertTriangle size={16} />} color={negCount > 0 ? 'text-rose-600 dark:text-rose-400' : undefined} />
              </div>

              {storeTopReactions && storeTopReactions !== '없음' && (
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border border-blue-100 dark:border-blue-800/50 p-4">
                  <h3 className="text-xs font-semibold text-blue-800 dark:text-blue-300 mb-2 flex items-center gap-1.5">
                    <Star size={14} className="text-blue-500" /> 매장 TOP 인기 반응 (네이버 AI 요약)
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {storeTopReactions.split(',').map((reaction, idx) => (
                      reaction.trim() && <span key={idx} className="px-2.5 py-1 bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-400 text-[11px] font-bold rounded-full shadow-sm border border-blue-100 dark:border-blue-700/50">{reaction.trim()}</span>
                    ))}
                  </div>
                </div>
              )}

              {(companionCounts.length > 0 || reactionCounts.length > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-4">
                    <h3 className="font-semibold text-xs text-slate-500 dark:text-slate-400 mb-3">👥 주요 동반자 유형 (TOP 3)</h3>
                    <div className="flex gap-2">
                      {companionCounts.map(([name, count]) => (
                        <div key={name} className="flex-1 bg-slate-50 dark:bg-slate-800/50 rounded-lg p-2 text-center border border-slate-100 dark:border-slate-800">
                          <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{name}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{count}건</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-4">
                    <h3 className="font-semibold text-xs text-slate-500 dark:text-slate-400 mb-3">💬 주요 고객 반응 포인트 (TOP 5)</h3>
                    <div className="flex flex-wrap gap-1.5">
                      {reactionCounts.map(([name, count]) => (
                        <span key={name} className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] font-medium rounded-md border border-slate-200 dark:border-slate-700">#{name} <span className="text-slate-400 ml-0.5">{count}</span></span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
                <h3 className="font-semibold text-sm text-slate-900 dark:text-white mb-4">일자별 리뷰 감정 추이 (최근 14일)</h3>
                <div className="flex items-end gap-1 h-28">
                  {trendData.map(([date, counts]) => {
                    const total = counts.긍정 + counts.부정 + counts.중립;
                    const heightPct = Math.round((total / maxCount) * 100);
                    return (
                      <div key={date} className="flex-1 flex flex-col items-center gap-1 group relative">
                        <div className="absolute bottom-5 mb-1 hidden group-hover:block z-10 pointer-events-none">
                          <div className="bg-slate-900 dark:bg-slate-700 text-white text-[10px] rounded px-2 py-1 whitespace-nowrap shadow-lg">
                            {date} | 긍{counts.긍정} 부{counts.부정} 중{counts.중립}
                          </div>
                        </div>
                        <div className="w-full flex flex-col justify-end" style={{ height: '100px' }}>
                          <div className="w-full flex flex-col rounded-t overflow-hidden" style={{ height: `${heightPct}%` }}>
                            {counts.부정 > 0 && <div className="w-full bg-rose-400 dark:bg-rose-500" style={{ flex: counts.부정 }} />}
                            {counts.중립 > 0 && <div className="w-full bg-slate-200 dark:bg-slate-600" style={{ flex: counts.중립 }} />}
                            {counts.긍정 > 0 && <div className="w-full bg-emerald-400 dark:bg-emerald-500" style={{ flex: counts.긍정 }} />}
                          </div>
                        </div>
                        <span className="text-[9px] text-slate-400">{date.slice(5)}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                  {[['bg-emerald-400', '긍정'], ['bg-slate-200 dark:bg-slate-600', '중립'], ['bg-rose-400', '부정']].map(([cls, label]) => (
                    <span key={label} className="flex items-center gap-1.5 text-xs text-slate-500">
                      <span className={`w-3 h-3 rounded-sm ${cls} inline-block`} />{label}
                    </span>
                  ))}
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <h3 className="font-semibold text-sm text-slate-900 dark:text-white">수집된 리뷰 목록 <span className="text-xs font-normal text-slate-400">({displayedReviews.length}건)</span></h3>
                  <div className="flex items-center gap-2">
                    <select value={timeFilter} onChange={e => setTimeFilter(e.target.value)} className="py-1.5 px-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none text-slate-700 dark:text-slate-300 cursor-pointer">
                      <option value="all">방문시간 전체</option>
                      {timeOptions.filter(t => t !== 'all').map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <select value={companionFilter} onChange={e => setCompanionFilter(e.target.value)} className="py-1.5 px-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none text-slate-700 dark:text-slate-300 cursor-pointer">
                      <option value="all">동반자 전체</option>
                      {companionOptions.filter(c => c !== 'all').map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-96 overflow-y-auto">
                  {displayedReviews.map(review => (
                    <div key={review.id} className="px-5 py-3 flex items-start gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <SentimentBadge sentiment={review.감정분석} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <p className="text-xs text-slate-400">{review.작성일}</p>
                          {review.방문시간 && review.방문시간.toLowerCase() !== 'nan' && <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 text-[10px] font-medium rounded">{review.방문시간}</span>}
                          {review.동반자 && review.동반자.toLowerCase() !== 'nan' && <span className="px-1.5 py-0.5 bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400 text-[10px] font-medium rounded">{review.동반자}</span>}
                        </div>
                        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{review.리뷰내용}</p>
                        {review.고객반응_포인트 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {review.고객반응_포인트.split(',').map((pt, i) => {
                              const t = pt.trim();
                              return t && t.toLowerCase() !== 'num' && isNaN(Number(t)) ? (
                                <span key={i} className="px-1.5 py-0.5 bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 text-[10px] rounded-full border border-slate-200 dark:border-slate-700">#{t}</span>
                              ) : null;
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <EmptyState icon={<Store size={20} className="text-slate-400" />} message={selectedStore ? '수집된 리뷰가 없습니다.' : '매장을 선택해 주세요.'} />
          )}
        </>
      )}

      {viewMode === 'trend' && (
        <div className="space-y-5">
          {warningStores.length > 0 && (
            <div className="bg-rose-50 dark:bg-rose-900/10 border border-rose-200 dark:border-rose-800 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle size={15} className="text-rose-500" />
                <h3 className="font-semibold text-sm text-rose-700 dark:text-rose-400">리뷰 급감 경고 매장</h3>
                <span className="text-xs text-rose-500">전월 대비 30% 이상 감소</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {warningStores.map(s => (
                  <div key={s.매장명} className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-800 rounded-lg px-3 py-2">
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">{s.매장명}</span>
                    <span className="text-xs font-bold text-rose-600 dark:text-rose-400">{s.증감률}%</span>
                    <span className="text-xs text-slate-400">({s.지난달}→{s.이번달}건)</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {goodStores.length > 0 && (
            <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp size={15} className="text-emerald-500" />
                <h3 className="font-semibold text-sm text-emerald-700 dark:text-emerald-400">리뷰 급증 우수 매장</h3>
                <span className="text-xs text-emerald-500">전월 대비 30% 이상 증가</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {goodStores.map(s => (
                  <div key={s.매장명} className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800 rounded-lg px-3 py-2">
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">{s.매장명}</span>
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">+{s.증감률}%</span>
                    <span className="text-xs text-slate-400">({s.지난달}→{s.이번달}건)</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
              <h3 className="font-semibold text-sm text-slate-900 dark:text-white">전체 매장 월간 리뷰 증감 현황</h3>
              <p className="text-xs text-slate-400 mt-0.5">증감률 기준 정렬 · 빨간색은 경고 매장</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400">매장명</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 dark:text-slate-400">{twoMonthsLabel}</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 dark:text-slate-400">{lastMonthLabel}</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 dark:text-slate-400">{thisMonthLabel}</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 dark:text-slate-400">전월 대비</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 dark:text-slate-400">추이</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {[...monthlyTrend]
                    .sort((a, b) => a.증감률 - b.증감률)
                    .map(s => {
                      const barWidth = Math.min(Math.abs(s.증감률), 100);
                      return (
                        <tr key={s.매장명} className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${s.isWarning ? 'bg-rose-50/50 dark:bg-rose-900/5' : ''}`}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {s.isWarning && <AlertTriangle size={12} className="text-rose-500 shrink-0" />}
                              {s.isGood && <TrendingUp size={12} className="text-emerald-500 shrink-0" />}
                              <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{s.매장명}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center text-xs text-slate-400">{s.전전달}건</td>
                          <td className="px-4 py-3 text-center text-xs text-slate-500 dark:text-slate-400 font-medium">{s.지난달}건</td>
                          <td className="px-4 py-3 text-center text-xs font-bold text-slate-800 dark:text-slate-200">{s.이번달}건</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`text-xs font-bold ${s.증감수 > 0 ? 'text-emerald-600 dark:text-emerald-400' : s.증감수 < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'}`}>
                              {s.증감수 > 0 ? '+' : ''}{s.증감수}건 ({s.증감률 > 0 ? '+' : ''}{s.증감률}%)
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center gap-1">
                              <div className="w-16 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${s.증감률 >= 0 ? 'bg-emerald-400' : 'bg-rose-400'}`}
                                  style={{ width: `${barWidth}%`, marginLeft: s.증감률 >= 0 ? '50%' : `${50 - barWidth / 2}%` }}
                                />
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
