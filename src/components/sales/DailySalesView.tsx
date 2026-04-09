import React, { useEffect, useState, useMemo } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { DailySalesRecord, MonthlySalesRecord } from '../../types';
import { formatShortMoney } from '../../utils';
import { Loader2, Filter, Info } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export function DailySalesView({ activeBrand }: { activeBrand: string | null }) {
  const [dailyData, setDailyData] = useState<DailySalesRecord[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlySalesRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters State
  const [months, setMonths] = useState<string[]>([]);
  const [weeks, setWeeks] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [stores, setStores] = useState<string[]>([]);

  const [citiesMultiMode, setCitiesMultiMode] = useState(false);
  const [storesMultiMode, setStoresMultiMode] = useState(false);

  useEffect(() => {
    if (!activeBrand) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const [dailySnap, monthlySnap] = await Promise.all([
          getDocs(query(collection(db, 'daily_sales'), where('brandId', '==', activeBrand))),
          getDocs(query(collection(db, 'monthly_sales'), where('brandId', '==', activeBrand)))
        ]);
        
        setDailyData(dailySnap.docs.map(d => d.data() as DailySalesRecord));
        setMonthlyData(monthlySnap.docs.map(d => d.data() as MonthlySalesRecord));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [activeBrand]);

  // City Lookup Map from monthly data
  const storeCityMap = useMemo(() => {
    const map = new Map<string, string>();
    monthlyData.forEach(m => {
      if (!map.has(m.storeName)) map.set(m.storeName, m.city);
    });
    return map;
  }, [monthlyData]);

  // Data processing: Add yearMonth, week, city to daily data
  const processedDaily = useMemo(() => {
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    return dailyData.map(d => {
      // Fix: Use local date parsing to avoid timezone offset bug (UTC parsing shifts day by -1 in KST)
      const parts = d.date.split('-').map(Number); // [YYYY, MM, DD]
      const dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
      const yearMonth = `${parts[0]}-${String(parts[1]).padStart(2, '0')}`;
      
      // Calculate week of month - same algorithm as Python's get_week_of_month
      const firstDay = new Date(parts[0], parts[1] - 1, 1);
      // Python uses weekday() where Monday=0, Sunday=6
      // JS uses getDay() where Sunday=0, Monday=1, ..., Saturday=6
      // Convert JS weekday to Python weekday: (jsDay + 6) % 7
      const firstDayWeekday = (firstDay.getDay() + 6) % 7; // Mon=0..Sun=6
      const adjustedDom = dateObj.getDate() + firstDayWeekday - 1;
      const weekNum = Math.floor(adjustedDom / 7) + 1;
      const weekStr = `${weekNum}주차`;

      const dayOfWeek = days[dateObj.getDay()];

      return {
        ...d,
        yearMonth,
        weekStr,
        dayOfWeek,
        dateObj,
        city: storeCityMap.get(d.storeName) || '미분류'
      };
    });
  }, [dailyData, storeCityMap]);


  // Derived unique lists for filters
  const allMonths = useMemo(() => Array.from(new Set(processedDaily.map(d => d.yearMonth))).sort((a: string, b: string) => b.localeCompare(a)), [processedDaily]);
  
  const filteredByMonth = useMemo(() => months.length > 0 ? processedDaily.filter(d => months.includes(d.yearMonth)) : processedDaily, [processedDaily, months]);
  const allWeeks = useMemo(() => Array.from(new Set(filteredByMonth.map(d => d.weekStr))).sort(), [filteredByMonth]);

  const filteredByWeek = useMemo(() => weeks.length > 0 ? filteredByMonth.filter(d => weeks.includes(d.weekStr)) : filteredByMonth, [filteredByMonth, weeks]);
  const allCities = useMemo(() => Array.from(new Set(filteredByWeek.map(d => d.city))).sort(), [filteredByWeek]);

  const filteredByCity = useMemo(() => cities.length > 0 ? filteredByWeek.filter(d => cities.includes(d.city)) : filteredByWeek, [filteredByWeek, cities]);
  const allStores = useMemo(() => Array.from(new Set(filteredByCity.map(d => d.storeName))).sort(), [filteredByCity]);

  // Final Filtered Data
  const finalData = useMemo(() => {
    if (stores.length > 0) return filteredByCity.filter(d => stores.includes(d.storeName));
    return filteredByCity;
  }, [filteredByCity, stores]);

  const toggleFilter = (setFn: React.Dispatch<React.SetStateAction<string[]>>, val: string, multi: boolean = true) => {
    setFn(prev => {
      if (!multi) return prev.includes(val) ? [] : [val];
      return prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val];
    });
  };

  // Chart Data Preparation
  const chartData = useMemo(() => {
    if (finalData.length === 0) return [];
    
    const map = new Map<string, any>();
    finalData.forEach(d => {
      if (!map.has(d.date)) map.set(d.date, { date: d.date, dateLabel: `${(d.dateObj.getMonth()+1).toString().padStart(2,'0')}/${d.dateObj.getDate().toString().padStart(2,'0')}` });
      const obj = map.get(d.date);
      obj[d.storeName] = (obj[d.storeName] || 0) + d.totalSales;
    });

    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [finalData]);

  // Pivot Table Preparation
  const pivotTable = useMemo(() => {
    if (finalData.length === 0) return { columns: [] as string[], rows: [] as { storeName: string; totals: Record<string, number>; rowSum: number }[], maxVal: 0, grandTotals: {} as Record<string, number>, superGrandTotal: 0 };

    // Format Headers: MM/DD(요일)
    const storeMap = new Map<string, Record<string, number>>();
    const allHeadersSet = new Set<string>();

    finalData.forEach(d => {
      const headerObj = {
        dateStr: d.date,
        label: `${(d.dateObj.getMonth()+1).toString().padStart(2,'0')}/${d.dateObj.getDate().toString().padStart(2,'0')}(${d.dayOfWeek})`
      };
      
      const headerLabel = headerObj.label;
      allHeadersSet.add(headerLabel);

      if (!storeMap.has(d.storeName)) storeMap.set(d.storeName, {});
      const sMap = storeMap.get(d.storeName)!;
      sMap[headerLabel] = (sMap[headerLabel] || 0) + d.totalSales;
    });

    // Sort headers chronologically
    const extractDateNum = (l: string) => {
       const m = l.match(/(\d+)\/(\d+)/); 
       if (!m) return 0;
       return parseInt(m[1])*100 + parseInt(m[2]);
    };
    const columns = Array.from(allHeadersSet).sort((a,b) => extractDateNum(a) - extractDateNum(b));

    const rows: { storeName: string; totals: Record<string, number>; rowSum: number }[] = [];
    let maxVal = 0;

    storeMap.forEach((totals, storeName) => {
      let rowSum = 0;
      columns.forEach(c => {
        const val = totals[c] || 0;
        rowSum += val;
        if (val > maxVal) maxVal = val;
      });
      rows.push({ storeName, totals, rowSum });
    });

    // Sort by rowSum DESC
    rows.sort((a,b) => b.rowSum - a.rowSum);

    // Calculate Grand Total Row
    const grandTotals: Record<string, number> = {};
    let superGrandTotal = 0;
    columns.forEach(c => {
       grandTotals[c] = rows.reduce((acc, r) => acc + (r.totals[c] || 0), 0);
       superGrandTotal += grandTotals[c];
    });

    return { columns, rows, maxVal, grandTotals, superGrandTotal };
  }, [finalData]);

  const getColColorStyle = (colName: string) => {
    if (colName.includes('(일)')) return 'text-red-500 font-semibold';
    if (colName.includes('(토)')) return 'text-blue-500 font-semibold';
    
    // 2026 Holidays handling... (simple logic as requested)
    const holidays = ['01/01', '02/16', '02/17', '02/18', '03/01', '03/02', '05/05', '05/24', '05/25', '06/06', '08/15', '09/24', '09/25', '09/26', '10/03', '10/09', '12/25'];
    if (holidays.some(h => colName.startsWith(h))) return 'text-red-500 font-semibold';

    return 'text-slate-600 dark:text-slate-300';
  };
  
  const getColHeaderIcon = (colName: string) => {
    if (colName.includes('(일)')) return '🔴 ';
    if (colName.includes('(토)')) return '🔵 ';
    
    // 2026 Holidays
    const holidays = ['01/01', '02/16', '02/17', '02/18', '03/01', '03/02', '05/05', '05/24', '05/25', '06/06', '08/15', '09/24', '09/25', '09/26', '10/03', '10/09', '12/25'];
    if (holidays.some(h => colName.startsWith(h))) return '🔴 ';

    return '';
  };


  if (loading) return <div className="p-8 text-center"><Loader2 className="animate-spin mx-auto text-emerald-500" /></div>;
  if (dailyData.length === 0) return <div className="p-8 text-center text-slate-500">업로드된 일일 매출 데이터가 없습니다.</div>;

  return (
    <div className="space-y-6">
      
      {/* Filters (4 Columns) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
          <div className="flex justify-between items-center mb-3">
             <span className="text-sm font-bold flex items-center gap-1"><Filter size={14}/> 조회 월</span>
             <button onClick={() => setMonths([])} className="text-xs text-slate-500 hover:text-emerald-500">초기화</button>
          </div>
          <div className="flex flex-wrap gap-2">
            {allMonths.map(m => (
              <button key={m} onClick={() => toggleFilter(setMonths, m)} className={`px-2 py-1 rounded-md text-xs font-medium transition-colors ${months.includes(m) ? 'bg-emerald-500 text-white' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600'}`}>{m}</button>
            ))}
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
          <div className="flex justify-between items-center mb-3">
             <span className="text-sm font-bold flex items-center gap-1"><Filter size={14}/> 주차</span>
             <button onClick={() => setWeeks([])} className="text-xs text-slate-500 hover:text-emerald-500">초기화</button>
          </div>
          <div className="flex flex-wrap gap-2">
            {allWeeks.map(w => (
              <button key={w} onClick={() => toggleFilter(setWeeks, w)} className={`px-2 py-1 rounded-md text-xs font-medium transition-colors ${weeks.includes(w) ? 'bg-blue-500 text-white' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600'}`}>{w}</button>
            ))}
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col">
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm font-bold flex items-center gap-1"><Filter size={14}/> 도시</span>
            <div className="flex gap-2">
              <label className="text-xs flex items-center gap-1 cursor-pointer select-none">
                <input type="checkbox" checked={citiesMultiMode} onChange={e => {setCitiesMultiMode(e.target.checked); setCities([]);}} /> 중복선택
              </label>
              <button onClick={() => setCities([])} className="text-xs text-slate-500 hover:text-emerald-500">초기화</button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 flex-1 items-start content-start overflow-y-auto max-h-24 pb-1">
            {allCities.map(c => (
              <button key={c} onClick={() => toggleFilter(setCities, c, citiesMultiMode)} className={`px-2 py-1 rounded-md text-xs font-medium transition-colors ${cities.includes(c) ? 'bg-indigo-500 text-white' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600'}`}>{c}</button>
            ))}
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col">
          <div className="flex justify-between items-center mb-3">
             <span className="text-sm font-bold flex items-center gap-1"><Filter size={14}/> 매장 요약</span>
             <div className="flex gap-2">
              <label className="text-xs flex items-center gap-1 cursor-pointer select-none">
                <input type="checkbox" checked={storesMultiMode} onChange={e => {setStoresMultiMode(e.target.checked); setStores([]);}} /> 중복선택
              </label>
              <button onClick={() => setStores([])} className="text-xs text-slate-500 hover:text-emerald-500">초기화</button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 flex-1 items-start content-start overflow-y-auto max-h-24 pb-1">
            {allStores.map(s => (
              <button key={s} onClick={() => toggleFilter(setStores, s, storesMultiMode)} className={`px-2 py-1 rounded-md text-xs font-medium transition-colors ${stores.includes(s) ? 'bg-amber-500 text-white' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600'}`}>{s}</button>
            ))}
          </div>
        </div>
      </div>

      {finalData.length > 0 ? (
        <>
          {/* Trend Chart */}
          <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
             <h3 className="text-base font-bold mb-6 pl-2 border-l-4 border-emerald-500">일일 매출 추이</h3>
             <div className="h-[300px] w-full">
               <ResponsiveContainer width="100%" height="100%">
                 <LineChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 5 }}>
                   <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                   <XAxis dataKey="dateLabel" tick={{fontSize: 11}} tickMargin={10} stroke="#94a3b8" />
                   <YAxis tickFormatter={(val) => formatShortMoney(val)} tick={{fontSize: 11}} stroke="#94a3b8" width={80} />
                   <Tooltip formatter={(value: number) => formatShortMoney(value)} labelStyle={{color: 'black'}} />
                   <Legend wrapperStyle={{fontSize: '12px'}} />
                   {allStores.filter(s => (stores.length === 0 || stores.includes(s))).map((store, idx) => (
                      <Line key={store} type="monotone" dataKey={store} stroke={`hsl(${(idx * 137.5) % 360}, 60%, 50%)`} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                   ))}
                 </LineChart>
               </ResponsiveContainer>
             </div>
          </div>

          {/* Pivot Table with Inline Bars */}
          <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
             <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold pl-2 border-l-4 border-emerald-500">가맹점별 일간 상세 매출 표 (단위: 천원)</h3>
                <div className="flex items-center gap-1 text-xs text-slate-500"><Info size={14}/> 주말, 공휴일은 자동으로 표시됩니다.</div>
             </div>
             
             <div className="overflow-x-auto w-full pb-4">
                <table className="w-full text-sm text-left whitespace-nowrap min-w-max border-collapse">
                   <thead className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/50 border-y border-slate-200 dark:border-slate-700 sticky top-0">
                     <tr>
                        <th className="px-4 py-3 bg-slate-50 dark:bg-slate-900/50 sticky left-0 z-10 font-bold border-r border-slate-200 dark:border-slate-700 shadow-[1px_0_0_0_#e2e8f0] dark:shadow-[1px_0_0_0_#334155]">가맹점</th>
                        {pivotTable.columns.map(c => (
                           <th key={c} className={`px-4 py-3 text-right whitespace-nowrap font-medium font-mono ${getColColorStyle(c)}`}>
                              {getColHeaderIcon(c)}{c}
                           </th>
                        ))}
                        <th className="px-4 py-3 text-right bg-slate-50 dark:bg-slate-900/50 font-bold">총합계</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                     {/* Data Rows */}
                     {pivotTable.rows.map(row => (
                        <tr key={row.storeName} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 group">
                           <td className="px-4 py-2 font-medium bg-white group-hover:bg-slate-50/80 dark:bg-slate-800 dark:group-hover:bg-slate-800/50 sticky left-0 z-10 border-r border-slate-200 dark:border-slate-700 shadow-[1px_0_0_0_#f1f5f9] dark:shadow-[1px_0_0_0_#1e293b]">
                              {row.storeName}
                           </td>
                           {pivotTable.columns.map(c => {
                              const val = Math.floor((row.totals[c] || 0) / 1000);
                              const maxValInThousands = Math.floor(pivotTable.maxVal / 1000);
                              const widthPct = maxValInThousands > 0 ? (val / maxValInThousands) * 100 : 0;
                              
                              return (
                                 <td key={c} className="px-4 py-2 text-right relative">
                                    <div className="absolute inset-y-1 right-1 left-1 bg-emerald-100/50 dark:bg-emerald-900/20 rounded z-0 flex justify-end">
                                      <div className="bg-emerald-200 dark:bg-emerald-800/40 rounded h-full" style={{ width: `${widthPct}%` }} />
                                    </div>
                                    <span className={`relative z-10 font-mono ${getColColorStyle(c)} drop-shadow-sm`}>
                                       {val.toLocaleString()}
                                    </span>
                                 </td>
                              );
                           })}
                           <td className="px-4 py-2 text-right font-bold text-slate-800 dark:text-slate-100 bg-slate-50 dark:bg-slate-900/30">
                              {Math.floor(row.rowSum / 1000).toLocaleString()}
                           </td>
                        </tr>
                     ))}
                     
                     {/* Grand Total Row */}
                     <tr className="bg-slate-100 dark:bg-slate-900 font-bold border-t-2 border-slate-300 dark:border-slate-600">
                         <td className="px-4 py-3 bg-slate-100 dark:bg-slate-900 sticky left-0 z-10 border-r border-slate-300 dark:border-slate-600 shadow-[1px_0_0_0_#cbd5e1] dark:shadow-[1px_0_0_0_#475569]">
                           전체 합계
                         </td>
                         {pivotTable.columns.map(c => (
                             <td key={c} className="px-4 py-3 text-right font-mono">
                               {Math.floor((pivotTable.grandTotals[c] || 0) / 1000).toLocaleString()}
                             </td>
                         ))}
                         <td className="px-4 py-3 text-right font-mono text-emerald-600 dark:text-emerald-400">
                            {Math.floor(pivotTable.superGrandTotal / 1000).toLocaleString()}
                         </td>
                     </tr>

                   </tbody>
                </table>
             </div>
          </div>
        </>
      ) : (
        <div className="p-12 text-center text-slate-500 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
          조건에 일치하는 일일 매출 데이터가 없습니다.
        </div>
      )}

    </div>
  );
}
