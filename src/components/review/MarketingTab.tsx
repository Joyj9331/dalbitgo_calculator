import React, { useState, useMemo, useEffect } from 'react';
import { Search, Store, Trophy, AlertCircle, Target, Activity } from 'lucide-react';
import { RankData, RoiData, parseRate } from './types';
import { KpiCard, RankBadge, TrendBadge } from './SharedComponents';

export function MarketingTab({ rankData, roiData }: { rankData: RankData[]; roiData: RoiData[] }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStore, setSelectedStore] = useState('');

  const allStores = useMemo(() => [...new Set(roiData.map(r => r.매장명))].sort(), [roiData]);
  const filteredStores = searchQuery ? allStores.filter(s => s.replace(/ /g, '').includes(searchQuery.replace(/ /g, ''))) : allStores;

  useEffect(() => {
    if (filteredStores.length > 0 && !filteredStores.includes(selectedStore)) setSelectedStore(filteredStores[0]);
  }, [filteredStores]);

  const latestDate = useMemo(() => { const dates = rankData.map(r => r.수집일자).sort(); return dates[dates.length - 1] || ''; }, [rankData]);
  const latestRankData = useMemo(() => rankData.filter(r => r.수집일자 === latestDate), [rankData, latestDate]);
  const top5Count = latestRankData.filter(r => Number(r.현재순위) <= 5).length;
  const failCount = latestRankData.filter(r => Number(r.현재순위) >= 999).length;
  const noKeywordCount = roiData.filter(r => r.세팅된_키워드 === '키워드 미설정').length;
  const storeRoi = roiData.find(r => r.매장명 === selectedStore);
  const storeRanks = latestRankData.filter(r => r.매장명 === selectedStore);
  const sortedRoi = useMemo(() => [...roiData].sort((a, b) => parseRate(b.키워드_적중률) - parseRate(a.키워드_적중률)), [roiData]);

  const getMarketingAction = (rate: number, searchVolumeStr: string, isNoKeyword: boolean) => {
    if (isNoKeyword) return { text: "키워드 긴급 세팅 필요", color: "text-rose-600 dark:text-rose-400", bg: "bg-rose-50 dark:bg-rose-900/10 border-rose-200" };
    const vol = parseInt(searchVolumeStr.replace(/[^0-9]/g, '')) || 0;
    if (rate >= 40 && vol >= 1000) return { text: "마케팅 우수 (현행 유지)", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200" };
    if (rate >= 40 && vol < 1000) return { text: "상권 키워드 확장 필요", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-900/10 border-amber-200" };
    if (rate < 40 && vol >= 1000) return { text: "리뷰 내 키워드 삽입 유도", color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-900/10 border-blue-200" };
    return { text: "키워드 전면 재검토", color: "text-slate-600 dark:text-slate-400", bg: "bg-slate-50 dark:bg-slate-800/50 border-slate-200" };
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="분석 완료 가맹점" value={`${roiData.length}개`} icon={<Store size={16} />} />
        <KpiCard label="1페이지 방어 성공" value={`${top5Count}개`} icon={<Trophy size={16} />} color="text-emerald-600 dark:text-emerald-400" />
        <KpiCard label="노출 실패 경고" value={`${failCount}건`} icon={<AlertCircle size={16} />} color={failCount > 0 ? 'text-rose-600 dark:text-rose-400' : undefined} />
        <KpiCard label="키워드 미설정 매장" value={`${noKeywordCount}개`} icon={<Target size={16} />} color={noKeywordCount > 0 ? 'text-amber-600 dark:text-amber-400' : undefined} />
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <h3 className="font-semibold text-sm text-slate-900 dark:text-white mb-3">가맹점 정밀 진단</h3>
          <div className="flex gap-3">
            <div className="relative flex-1 max-w-xs">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="매장명 검색"
                className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none text-slate-900 dark:text-white placeholder-slate-400" />
            </div>
            <select value={selectedStore} onChange={e => setSelectedStore(e.target.value)}
              className="flex-1 py-2 px-3 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none text-slate-900 dark:text-white">
              {filteredStores.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        {storeRoi && (
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: '설정된 키워드', value: storeRoi.세팅된_키워드 === '키워드 미설정' ? '미설정' : `${storeRoi.세팅된_키워드.split(',').length}개 세팅`, warn: storeRoi.세팅된_키워드 === '키워드 미설정' },
                { label: '리뷰 적중률 (ROI)', value: storeRoi.키워드_적중률, warn: false },
                { label: '월간 총검색량', value: storeRoi.네이버_월간_총검색량, warn: false },
              ].map(({ label, value, warn }) => (
                <div key={label} className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{label}</p>
                  <p className={`text-sm font-semibold ${warn ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'}`}>{value}</p>
                </div>
              ))}
            </div>
            {storeRoi.추천_키워드 && storeRoi.추천_키워드 !== '-' && (
              <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg p-4 space-y-2">
                <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">추천 키워드 (교체 후보)</p>
                <div className="flex flex-wrap gap-2">
                  {storeRoi.추천_키워드.split(',').map(kw => kw.trim()).filter(Boolean).map(kw => (
                    <span key={kw} className="px-2.5 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-xs font-medium rounded-full">{kw}</span>
                  ))}
                </div>
                {storeRoi.추천_근거 && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    <span className="font-semibold text-slate-600 dark:text-slate-300">근거: </span>{storeRoi.추천_근거}
                  </p>
                )}
              </div>
            )}
            {storeRanks.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">키워드별 네이버 플레이스 순위</p>
                {storeRanks.map((rank, idx) => (
                  <div key={idx} className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                    <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800 flex items-center gap-2 flex-wrap">
                      <Target size={12} className="text-slate-400 shrink-0" />
                      <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex-1">[{rank.타겟키워드}]</span>
                      <RankBadge rank={Number(rank.현재순위)} />
                      <TrendBadge trend={rank.등락폭} />
                    </div>
                    {rank.AI_인사이트 && (
                      <div className={`px-4 py-2 border-t border-slate-100 dark:border-slate-700 ${Number(rank.현재순위) >= 999 ? 'bg-rose-50 dark:bg-rose-900/10' : Number(rank.현재순위) <= 5 ? 'bg-emerald-50 dark:bg-emerald-900/10' : 'bg-amber-50 dark:bg-amber-900/10'}`}>
                        <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                          <span className="font-semibold">본사 권고: </span>{rank.AI_인사이트}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <h3 className="font-semibold text-sm text-slate-900 dark:text-white">전체 가맹점 마케팅 성적표</h3>
          <p className="text-xs text-slate-400 mt-0.5">키워드 적중률 높은 순 · 클릭하면 위 진단 화면으로 이동</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                {['매장명', '키워드 적중률', '월간 검색량', '세팅된 키워드', '본사 지도 액션'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {sortedRoi.map(roi => {
                const rate = parseRate(roi.키워드_적중률);
                const isNoKeyword = roi.세팅된_키워드 === '키워드 미설정';
                const action = getMarketingAction(rate, roi.네이버_월간_총검색량, isNoKeyword);
                return (
                  <tr key={roi.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer ${selectedStore === roi.매장명 ? 'bg-blue-50 dark:bg-blue-900/10' : ''}`} onClick={() => setSelectedStore(roi.매장명)}>
                    <td className="px-4 py-3 text-sm font-medium text-slate-800 dark:text-slate-200">{roi.매장명}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${rate >= 70 ? 'bg-emerald-400' : rate >= 40 ? 'bg-amber-400' : 'bg-rose-400'}`} style={{ width: `${Math.min(rate, 100)}%` }} />
                        </div>
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{roi.키워드_적중률}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">{roi.네이버_월간_총검색량}</td>
                    <td className="px-4 py-3">
                      {isNoKeyword ? <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">미설정</span>
                        : <span className="text-xs text-slate-500 dark:text-slate-400 truncate block max-w-xs">{roi.세팅된_키워드}</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-1 text-[11px] font-bold rounded-md border ${action.color} ${action.bg}`}>
                        {action.text}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
