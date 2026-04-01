import React, { useState } from 'react';
import { IngredientChange, User, Ingredient } from '../types';
import { formatCurrency } from '../utils';
import { Trash2, TrendingUp, TrendingDown, PlusCircle, MinusCircle, Calendar, Search } from 'lucide-react';
import { PriceHistoryGraph } from './PriceHistoryGraph';

interface Props {
  changes: IngredientChange[];
  ingredients: Ingredient[];
  currentUser: User;
  onDeleteChange: (id: string) => void;
}

export const IngredientChangeView: React.FC<Props> = ({ changes, ingredients, currentUser, onDeleteChange }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [hoverPosition, setHoverPosition] = useState({ x: 0, y: 0 });
  
  const isAdmin = currentUser.role === 'admin';

  const handleMouseMove = (e: React.MouseEvent) => {
    setHoverPosition({ x: e.clientX + 15, y: e.clientY + 15 });
  };

  // Filter changes by search query
  const filteredChanges = changes.filter(change => 
    change.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Sort changes by timestamp descending
  const sortedChanges = [...filteredChanges].sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  const formatPriceChange = (prev?: number, curr?: number) => {
    if (prev === undefined || curr === undefined) return null;
    const diff = curr - prev;
    if (diff === 0) return null;

    return (
      <div className={`flex items-center gap-1 font-medium ${diff > 0 ? 'text-rose-600' : 'text-blue-600'}`}>
        {diff > 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
        <span>{diff > 0 ? '+' : ''}{formatCurrency(diff)}</span>
      </div>
    );
  };

  const getChangeLabel = (change: IngredientChange) => {
    switch (change.type) {
      case 'new':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">
            <PlusCircle size={12} /> 신규등록
          </span>
        );
      case 'deleted':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
            <MinusCircle size={12} /> 삭제품목
          </span>
        );
      case 'price_change':
        const pDiff = (change.currPurchasePrice || 0) - (change.prevPurchasePrice || 0);
        const sDiff = (change.currSalesPrice || 0) - (change.prevSalesPrice || 0);
        
        if (pDiff !== 0 && sDiff !== 0) return <span className="text-xs font-bold text-purple-600">매입/매출가 변동</span>;
        if (pDiff !== 0) return <span className="text-xs font-bold text-rose-600">매입가 변동</span>;
        if (sDiff !== 0) return <span className="text-xs font-bold text-blue-600">매출가 변동</span>;
        return <span className="text-xs font-bold text-slate-500">정보 수정</span>;
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Calendar size={20} className="text-blue-600" />
            식자재 변동 내역
          </h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="품명 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-1.5 text-sm border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-white w-64"
            />
          </div>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          가격 변동 및 신규/삭제 품목을 관리합니다.
        </p>
      </div>

      <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-slate-700 dark:text-slate-300 uppercase bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th className="px-4 py-3">일시</th>
              <th className="px-4 py-3">품명</th>
              <th className="px-4 py-3">규격</th>
              <th className="px-4 py-3 text-right">매입가</th>
              <th className="px-4 py-3 text-right">매출가</th>
              <th className="px-4 py-3">변동사항</th>
              {isAdmin && <th className="px-4 py-3 text-center">관리</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {sortedChanges.map((change) => {
              const currentIng = ingredients.find(i => i.id === change.ingredientId);
              return (
                <tr 
                  key={change.id} 
                  className="bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group"
                  onMouseEnter={(e) => { setHoveredId(change.ingredientId); handleMouseMove(e); }}
                  onMouseMove={handleMouseMove}
                  onMouseLeave={() => setHoveredId(null)}
                >
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                    {new Date(change.timestamp).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-900 dark:text-white">{change.name}</span>
                      {currentIng?.isSelectedForMenu && (
                        <span className="text-[8px] bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 px-1 rounded border border-blue-200 dark:border-blue-800">메뉴용</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                    {change.spec || '-'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex flex-col items-end">
                      <span className="text-slate-900 dark:text-white font-semibold">
                        {formatCurrency(change.currPurchasePrice || 0)}
                      </span>
                      {formatPriceChange(change.prevPurchasePrice, change.currPurchasePrice)}
                      {currentIng && currentIng.unitCost !== change.currPurchasePrice && (
                        <span className="text-[10px] text-slate-400 mt-1">
                          현재: {formatCurrency(currentIng.unitCost)}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex flex-col items-end">
                      <span className="text-slate-900 dark:text-white font-semibold">
                        {formatCurrency(change.currSalesPrice || 0)}
                      </span>
                      {formatPriceChange(change.prevSalesPrice, change.currSalesPrice)}
                      {currentIng && currentIng.salesPrice !== change.currSalesPrice && (
                        <span className="text-[10px] text-slate-400 mt-1">
                          현재: {formatCurrency(currentIng.salesPrice || 0)}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {getChangeLabel(change)}
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => onDeleteChange(change.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-md transition-colors"
                        title="내역 삭제"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
            {sortedChanges.length === 0 && (
              <tr>
                <td colSpan={isAdmin ? 7 : 6} className="px-4 py-12 text-center text-slate-500 dark:text-slate-400">
                  {searchQuery ? '검색 결과가 없습니다.' : '변동 내역이 없습니다.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Hover Graph */}
      {hoveredId && (
        <div 
          className="fixed z-[100] pointer-events-none"
          style={{ left: hoverPosition.x, top: hoverPosition.y }}
        >
          <PriceHistoryGraph ingredientId={hoveredId} changes={changes} />
        </div>
      )}
    </div>
  );
};
