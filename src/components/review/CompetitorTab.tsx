import React, { useMemo } from 'react';
import { Store, Activity, ArrowUp, ArrowDown } from 'lucide-react';
import { CompetitorData } from './types';
import { KpiCard } from './SharedComponents';

export function CompetitorTab({ competitorData }: { competitorData: CompetitorData[] }) {
  const TARGET_BRANDS = ['산으로간고등어', '화덕으로간고등어', '부산에뜬고등어', '북극해고등어'];
  const latestDate = useMemo(() => { const dates = [...new Set(competitorData.map(c => c.수집일자))].sort(); return dates[dates.length - 1] || ''; }, [competitorData]);
  const prevDate = useMemo(() => { const dates = [...new Set(competitorData.map(c => c.수집일자))].sort(); return dates.length >= 2 ? dates[dates.length - 2] : ''; }, [competitorData]);
  const latestData = competitorData.filter(c => c.수집일자 === latestDate);
  const prevData = competitorData.filter(c => c.수집일자 === prevDate);

  function parseMenuString(menuStr: string): { name: string; price: string }[] {
    if (!menuStr || menuStr === '수집 실패') return [];
    const normalizedStr = menuStr.replace(/\n/g, '|');
    const items = normalizedStr.split('|').map(s => s.trim()).filter(Boolean);
    const result: { name: string; price: string }[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.includes(':')) {
        const [name, ...priceArr] = item.split(':');
        result.push({ name: name.trim(), price: priceArr.join(':').trim() });
      } else {
        if (i + 1 < items.length && /[0-9,]+\s*원/.test(items[i + 1])) {
          result.push({ name: item, price: items[i + 1] });
          i++;
        } else {
          const match = item.match(/([0-9]{1,2}(?:,[0-9]{3})+|[0-9]{4,5})\s*원?/);
          if (match) {
            const price = match[0];
            const name = item.replace(price, '').trim();
            result.push({ name, price });
          } else {
            result.push({ name: item, price: '' });
          }
        }
      }
    }
    return result;
  }

  function getMackerelPrice(menuStr: string): number {
    const parsed = parseMenuString(menuStr);
    for (const { name, price } of parsed) {
      if (name.includes('고등어')) {
        const numStr = price.replace(/[^0-9]/g, '');
        const v = parseInt(numStr, 10);
        if (!isNaN(v) && v >= 3000 && v <= 25000) return v;
      }
    }
    return 0;
  }

  function getPriceRange(brand: string, data: CompetitorData[]) {
    const prices = data.filter(d => d.경쟁브랜드명_엑셀.includes(brand)).map(d => getMackerelPrice(d.메뉴_및_가격)).filter(p => p > 0);
    if (!prices.length) return { min: 0, max: 0 };
    return { min: Math.min(...prices), max: Math.max(...prices) };
  }

  const marketStats = useMemo(() => {
    const allPrices = latestData.map(d => getMackerelPrice(d.메뉴_및_가격)).filter(p => p > 0);
    if (allPrices.length === 0) return null;
    const avg = Math.round(allPrices.reduce((a, b) => a + b, 0) / allPrices.length);
    const min = Math.min(...allPrices);
    const max = Math.max(...allPrices);
    return { avg, min, max, count: allPrices.length };
  }, [latestData]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          데이터 기준일: <span className="font-medium text-slate-700 dark:text-slate-300">{latestDate || '수집 전'}</span>
          <span className="ml-2 text-slate-400">· 매일 자동 수집되며 4대 핵심 경쟁사 메뉴 및 가격 변동을 감지합니다.</span>
        </p>
      </div>

      {marketStats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
          <KpiCard label="경쟁 4사 평균 고등어구이 단가" value={`${marketStats.avg.toLocaleString()}원`} sub={`총 ${marketStats.count}개 매장 표본 기준`} icon={<Activity size={16} />} color="text-indigo-600 dark:text-indigo-400" />
          <KpiCard label="시장 최저가 (경쟁 하한선)" value={`${marketStats.min.toLocaleString()}원`} sub="가성비 전략 매장 기준" icon={<ArrowDown size={16} />} color="text-blue-600 dark:text-blue-400" />
          <KpiCard label="시장 최고가 (프리미엄 상한선)" value={`${marketStats.max.toLocaleString()}원`} sub="프리미엄/반상 전략 매장" icon={<ArrowUp size={16} />} color="text-rose-600 dark:text-rose-400" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {TARGET_BRANDS.map(brand => {
          const brandData = latestData.filter(d => d.경쟁브랜드명_엑셀.includes(brand));
          const latestRange = getPriceRange(brand, latestData);
          const prevRange = getPriceRange(brand, prevData);

          const priceDisplay = latestRange.min > 0
            ? latestRange.min === latestRange.max
              ? `${latestRange.min.toLocaleString()}원`
              : `${latestRange.min.toLocaleString()} ~ ${latestRange.max.toLocaleString()}원`
            : '확인 불가';

          let trendEl = null;
          if (latestRange.min > 0 && prevRange.min > 0) {
            const diff = latestRange.min - prevRange.min;
            if (diff > 0) trendEl = <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20 px-2 py-0.5 rounded-full border border-rose-100 dark:border-rose-800"><ArrowUp size={9} /> {diff.toLocaleString()}원 인상 감지</span>;
            else if (diff < 0) trendEl = <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-full border border-blue-100 dark:border-blue-800"><ArrowDown size={9} /> {Math.abs(diff).toLocaleString()}원 인하 감지</span>;
            else trendEl = <span className="text-xs text-slate-400">변동 없음</span>;
          }

          return (
            <div key={brand} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">{brand}</h3>
                    <p className="text-xs text-slate-400 mt-0.5">대표 고등어구이 가격대</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-slate-900 dark:text-white">{priceDisplay}</p>
                    {trendEl && <div className="mt-1">{trendEl}</div>}
                  </div>
                </div>
              </div>
              {brandData.length === 0 ? (
                <div className="px-5 py-8 text-center text-xs text-slate-400">수집된 데이터가 없습니다.</div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {brandData.slice(0, 3).map((store, idx) => {
                    const menuItems = parseMenuString(store.메뉴_및_가격).slice(0, 5);
                    return (
                      <div key={idx} className="px-5 py-3">
                        <div className="flex items-center gap-2 mb-2">
                          <Store size={11} className="text-stone-400 shrink-0" />
                          <p className="text-xs font-bold text-stone-700 dark:text-stone-300 truncate">{store.실제_플레이스_업체명}</p>
                        </div>
                        {menuItems.length > 0 ? (
                          <div className="space-y-1">
                            {menuItems.map((item, i) => {
                              const isHighlight = item.name.includes('고등어');
                              return (
                                <div key={i} className={`flex justify-between text-xs ${isHighlight ? 'font-black text-stone-900 dark:text-white' : 'font-medium text-stone-500 dark:text-stone-400'}`}>
                                  <span className="truncate flex-1 mr-2">{item.name}</span>
                                  <span className="shrink-0 font-bold">{item.price}</span>
                                </div>
                              );
                            })}
                          </div>
                        ) : <p className="text-xs font-bold text-stone-400">메뉴 수집 실패</p>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
