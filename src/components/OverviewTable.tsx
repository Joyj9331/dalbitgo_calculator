import React from 'react';
import { Menu, Ingredient, Region } from '../types';
import { calculateTotalCost, formatCurrency, formatPercent, checkMenuAlert, hasMissingIngredients } from '../utils';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

interface Props {
  menus: Menu[];
  ingredients: Ingredient[];
  isAdmin?: boolean;
  onAcknowledgeAlert?: (menuId: string) => void;
  onNavigateToTab: (tab: string) => void;
}

export const OverviewTable: React.FC<Props> = ({ 
  menus, 
  ingredients, 
  isAdmin, 
  onAcknowledgeAlert,
  onNavigateToTab
}) => {
  const regions: Region[] = ['지방권', '광역권', '수도권'];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left text-slate-500 dark:text-slate-400">
        <thead className="text-xs text-slate-700 dark:text-slate-300 uppercase bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
          <tr>
            <th rowSpan={2} className="px-4 py-3 border-r border-slate-200 dark:border-slate-700 align-middle">메뉴명</th>
            <th rowSpan={2} className="px-4 py-3 text-right border-r border-slate-200 dark:border-slate-700 align-middle">원가</th>
            {regions.map(r => (
              <th key={r} colSpan={4} className="px-4 py-2 text-center border-b border-r border-slate-200 dark:border-slate-700 bg-slate-100/50 dark:bg-slate-800">{r}</th>
            ))}
          </tr>
          <tr>
            {regions.map(r => (
              <React.Fragment key={`${r}-sub`}>
                <th className="px-2 py-2 text-right bg-slate-50 dark:bg-slate-800/30">판매가</th>
                <th className="px-2 py-2 text-right bg-slate-50 dark:bg-slate-800/30">마진</th>
                <th className="px-2 py-2 text-right bg-slate-50 dark:bg-slate-800/30">원가율</th>
                <th className="px-2 py-2 text-right border-r border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30">마진율</th>
              </React.Fragment>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
          {menus.map(menu => {
            const cost = calculateTotalCost(menu.recipe, ingredients);
            const hasAlert = checkMenuAlert(menu, ingredients);
            const missing = hasMissingIngredients(menu.recipe, ingredients);

            return (
              <tr key={menu.id} className={`bg-blue-50/30 dark:bg-blue-900/10 hover:bg-blue-100/50 dark:hover:bg-blue-900/30 transition-colors group ${hasAlert ? 'border-l-4 border-l-rose-500' : ''}`}>
                <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100 border-r border-slate-200 dark:border-slate-700 group-hover:text-blue-800 dark:group-hover:text-blue-400 transition-colors">
                  <div className="flex items-center gap-2">
                    {menu.name}
                    {hasAlert && (
                      <button 
                        onClick={() => onNavigateToTab('변동사항')}
                        className="flex items-center gap-1 text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-100 dark:bg-rose-900/30 px-1.5 py-0.5 rounded uppercase tracking-wider hover:bg-rose-200 dark:hover:bg-rose-900/50 transition-colors"
                        title={missing ? '식자재 누락. 클릭하여 확인' : '원가 변동. 클릭하여 확인'}
                      >
                        <AlertCircle size={10} />
                        {missing ? '누락' : '변동'}
                      </button>
                    )}
                    {isAdmin && hasAlert && onAcknowledgeAlert && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onAcknowledgeAlert(menu.id);
                        }}
                        className="p-1 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/40 rounded transition-colors"
                        title="알림 해결"
                      >
                        <CheckCircle2 size={14} />
                      </button>
                    )}
                  </div>
                </td>
                <td className={`px-4 py-3 text-right border-r border-slate-200 dark:border-slate-700 ${hasAlert ? 'text-rose-600 dark:text-rose-400 font-bold' : ''}`}>
                  {formatCurrency(cost)}
                </td>
                
                {regions.map(r => {
                  const price = menu.prices[r] || 0;
                  const margin = price - cost;
                  const costRate = price > 0 ? cost / price : 0;
                  const marginRate = price > 0 ? margin / price : 0;
                  return (
                    <React.Fragment key={`${menu.id}-${r}`}>
                      <td className="px-2 py-3 text-right font-semibold text-blue-600 dark:text-blue-400">{formatCurrency(price)}</td>
                      <td className="px-2 py-3 text-right text-emerald-600 dark:text-emerald-400">{formatCurrency(margin)}</td>
                      <td className="px-2 py-3 text-right font-semibold text-rose-600 dark:text-rose-400">{formatPercent(costRate)}</td>
                      <td className="px-2 py-3 text-right border-r border-slate-200 dark:border-slate-700">{formatPercent(marginRate)}</td>
                    </React.Fragment>
                  );
                })}
              </tr>
            );
          })}
          {menus.length === 0 && (
            <tr>
              <td colSpan={14} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">등록된 메뉴가 없습니다.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};
