import React from 'react';
import { Menu, Ingredient } from '../types';
import { calculateTotalCost, formatCurrency } from '../utils';
import { RotateCcw, Trash2 } from 'lucide-react';

interface Props {
  menus: Menu[];
  ingredients: Ingredient[];
  onRestoreMenu: (id: string) => void;
  onDeleteMenu: (id: string) => void;
}

export const ArchiveView: React.FC<Props> = ({ menus, ingredients, onRestoreMenu, onDeleteMenu }) => {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left text-gray-500">
        <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b">
          <tr>
            <th className="px-4 py-3">메뉴명</th>
            <th className="px-4 py-3 text-right">원가</th>
            <th className="px-4 py-3 text-center">관리</th>
          </tr>
        </thead>
        <tbody>
          {menus.map(menu => {
            const cost = calculateTotalCost(menu.recipe, ingredients);

            return (
              <tr key={menu.id} className="bg-white border-b hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{menu.name}</td>
                <td className="px-4 py-3 text-right">{formatCurrency(cost)}</td>
                <td className="px-4 py-3 text-center space-x-2">
                  <button onClick={() => onRestoreMenu(menu.id)} className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-md transition-colors" title="복구">
                    <RotateCcw size={16} />
                  </button>
                  <button onClick={() => {
                    if (window.confirm('정말로 이 메뉴를 영구 삭제하시겠습니까?')) {
                      onDeleteMenu(menu.id);
                    }
                  }} className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors" title="영구 삭제">
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            );
          })}
          {menus.length === 0 && (
            <tr>
              <td colSpan={3} className="px-4 py-8 text-center text-gray-500">보관된 메뉴가 없습니다.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};
