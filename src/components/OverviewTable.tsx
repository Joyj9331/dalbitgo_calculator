import React from 'react';
import { Menu, Ingredient, Region } from '../types';
import { calculateTotalCost, formatCurrency, formatPercent } from '../utils';

interface Props {
  menus: Menu[];
  ingredients: Ingredient[];
}

export const OverviewTable: React.FC<Props> = ({ menus, ingredients }) => {
  const regions: Region[] = ['지방권', '광역권', '수도권'];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left text-gray-500">
        <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b">
          <tr>
            <th rowSpan={2} className="px-4 py-3 border-r align-middle">메뉴명</th>
            <th rowSpan={2} className="px-4 py-3 text-right border-r align-middle">원가</th>
            {regions.map(r => (
              <th key={r} colSpan={4} className="px-4 py-2 text-center border-b border-r bg-gray-100">{r}</th>
            ))}
          </tr>
          <tr>
            {regions.map(r => (
              <React.Fragment key={`${r}-sub`}>
                <th className="px-2 py-2 text-right bg-gray-50">판매가</th>
                <th className="px-2 py-2 text-right bg-gray-50">마진</th>
                <th className="px-2 py-2 text-right bg-gray-50">원가율</th>
                <th className="px-2 py-2 text-right border-r bg-gray-50">마진율</th>
              </React.Fragment>
            ))}
          </tr>
        </thead>
        <tbody>
          {menus.map(menu => {
            const cost = calculateTotalCost(menu.recipe, ingredients);

            return (
              <tr key={menu.id} className="bg-white border-b hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900 border-r">{menu.name}</td>
                <td className="px-4 py-3 text-right border-r">{formatCurrency(cost)}</td>
                
                {regions.map(r => {
                  const price = menu.prices[r] || 0;
                  const margin = price - cost;
                  const costRate = price > 0 ? cost / price : 0;
                  const marginRate = price > 0 ? margin / price : 0;
                  return (
                    <React.Fragment key={`${menu.id}-${r}`}>
                      <td className="px-2 py-3 text-right font-semibold text-blue-600">{formatCurrency(price)}</td>
                      <td className="px-2 py-3 text-right text-green-600">{formatCurrency(margin)}</td>
                      <td className="px-2 py-3 text-right font-semibold text-red-600">{formatPercent(costRate)}</td>
                      <td className="px-2 py-3 text-right border-r">{formatPercent(marginRate)}</td>
                    </React.Fragment>
                  );
                })}
              </tr>
            );
          })}
          {menus.length === 0 && (
            <tr>
              <td colSpan={14} className="px-4 py-8 text-center text-gray-500">등록된 메뉴가 없습니다.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};
