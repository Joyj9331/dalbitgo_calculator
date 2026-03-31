import React from 'react';
import { Menu, Ingredient, Region } from '../types';
import { calculateTotalCost, formatCurrency, formatPercent } from '../utils';
import { Edit2, Archive, ChefHat } from 'lucide-react';

interface Props {
  menus: Menu[];
  ingredients: Ingredient[];
  region: Region;
  onEditMenu: (menu: Menu) => void;
  onArchiveMenu: (id: string) => void;
  onEditRecipe: (menu: Menu) => void;
}

export const MenuTable: React.FC<Props> = ({ menus, ingredients, region, onEditMenu, onArchiveMenu, onEditRecipe }) => {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left text-gray-500">
        <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b">
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
        <tbody>
          {menus.map(menu => {
            const price = menu.prices[region] || 0;
            const cost = calculateTotalCost(menu.recipe, ingredients);
            const margin = price - cost;
            const costRate = price > 0 ? cost / price : 0;
            const marginRate = price > 0 ? margin / price : 0;

            return (
              <tr key={menu.id} className="bg-white border-b hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{menu.name}</td>
                <td className="px-4 py-3 text-right font-semibold text-blue-600">{formatCurrency(price)}</td>
                <td className="px-4 py-3 text-right">{formatCurrency(cost)}</td>
                <td className="px-4 py-3 text-right font-semibold text-green-600">{formatCurrency(margin)}</td>
                <td className="px-4 py-3 text-right font-semibold text-red-600">{formatPercent(costRate)}</td>
                <td className="px-4 py-3 text-right">{formatPercent(marginRate)}</td>
                <td className="px-4 py-3 text-center">
                  <button onClick={() => onEditRecipe(menu)} className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors" title="레시피 관리">
                    <ChefHat size={16} />
                  </button>
                </td>
                <td className="px-4 py-3 text-center space-x-1">
                  <button onClick={() => onEditMenu(menu)} className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors" title="메뉴 수정">
                    <Edit2 size={16} />
                  </button>
                </td>
              </tr>
            );
          })}
          {menus.length === 0 && (
            <tr>
              <td colSpan={8} className="px-4 py-8 text-center text-gray-500">등록된 메뉴가 없습니다.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};
