import React from 'react';
import { Menu, Ingredient, Region } from '../types';
import { calculateTotalCost, formatCurrency, formatPercent, checkMenuAlert, hasMissingIngredients } from '../utils';
import { Edit2, Archive, ChefHat, AlertCircle, CheckCircle2 } from 'lucide-react';

interface Props {
  menus: Menu[];
  ingredients: Ingredient[];
  region: Region;
  isAdmin: boolean;
  onEditMenu: (menu: Menu) => void;
  onArchiveMenu: (id: string) => void;
  onEditRecipe: (menu: Menu) => void;
  onAcknowledgeAlert: (id: string) => void;
  onNavigateToTab: (tab: string) => void;
}

export const MenuTable: React.FC<Props> = ({ 
  menus, 
  ingredients, 
  region, 
  isAdmin, 
  onEditMenu, 
  onArchiveMenu, 
  onEditRecipe, 
  onAcknowledgeAlert,
  onNavigateToTab
}) => {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left text-slate-500 dark:text-slate-400">
        <thead className="text-xs text-slate-700 dark:text-slate-300 uppercase bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
          <tr>
            <th className="px-4 py-3">메뉴명</th>
            <th className="px-4 py-3 text-right">판매가</th>
            <th className="px-4 py-3 text-right">원가</th>
            <th className="px-4 py-3 text-right">마진</th>
            <th className="px-4 py-3 text-right">원가율</th>
            <th className="px-4 py-3 text-right">마진율</th>
            <th className="px-4 py-3 text-center">레시피</th>
            <th className="px-4 py-3 text-center">관리</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
          {menus.map(menu => {
            const price = menu.prices[region] || 0;
            const cost = calculateTotalCost(menu.recipe, ingredients);
            const margin = price - cost;
            const costRate = price > 0 ? cost / price : 0;
            const marginRate = price > 0 ? margin / price : 0;
            const hasAlert = checkMenuAlert(menu, ingredients);
            const missing = hasMissingIngredients(menu.recipe, ingredients);

            return (
              <tr key={menu.id} className={`bg-blue-50/30 dark:bg-blue-900/10 hover:bg-blue-100/50 dark:hover:bg-blue-900/30 transition-colors group ${hasAlert ? 'border-l-4 border-l-rose-500' : ''}`}>
                <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100 group-hover:text-blue-800 dark:group-hover:text-blue-400 transition-colors">
                  <div className="flex items-center gap-2">
                    {menu.name}
                    {hasAlert && (
                      <button 
                        onClick={() => onNavigateToTab('변동사항')}
                        className="flex items-center gap-1 text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-100 dark:bg-rose-900/30 px-1.5 py-0.5 rounded uppercase tracking-wider hover:bg-rose-200 dark:hover:bg-rose-900/50 transition-colors"
                        title={missing ? '식자재가 데이터베이스에서 삭제되었습니다. 클릭하여 확인' : '식자재 원가가 변동되었습니다. 클릭하여 확인'}
                      >
                        <AlertCircle size={10} />
                        {missing ? '식자재 누락' : '원가 변동'}
                      </button>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-right font-semibold text-blue-600 dark:text-blue-400">{formatCurrency(price)}</td>
                <td className={`px-4 py-3 text-right ${hasAlert ? 'text-rose-600 dark:text-rose-400 font-bold' : ''}`}>
                  {formatCurrency(cost)}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(margin)}</td>
                <td className="px-4 py-3 text-right font-semibold text-rose-600 dark:text-rose-400">{formatPercent(costRate)}</td>
                <td className="px-4 py-3 text-right">{formatPercent(marginRate)}</td>
                <td className="px-4 py-3 text-center">
                  <button onClick={() => onEditRecipe(menu)} className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md transition-colors" title="레시피 관리">
                    <ChefHat size={16} />
                  </button>
                </td>
                <td className="px-4 py-3 text-center space-x-1">
                  {hasAlert && isAdmin && (
                    <button 
                      onClick={() => onAcknowledgeAlert(menu.id)} 
                      className="p-1.5 text-rose-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-md transition-colors" 
                      title="알림 해결 (관리자)"
                    >
                      <CheckCircle2 size={16} />
                    </button>
                  )}
                  <button onClick={() => onEditMenu(menu)} className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md transition-colors" title="메뉴 수정">
                    <Edit2 size={16} />
                  </button>
                </td>
              </tr>
            );
          })}
          {menus.length === 0 && (
            <tr>
              <td colSpan={8} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">등록된 메뉴가 없습니다.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};
