import React, { useState, useRef, useEffect } from 'react';
import { Menu, Ingredient, RecipeItem } from '../types';
import { X, Plus, Trash2, Search, ChevronDown, Check } from 'lucide-react';
import { calculateTotalCost, formatCurrency } from '../utils';

interface Props {
  menu: Menu;
  ingredients: Ingredient[];
  onSave: (menuId: string, recipe: RecipeItem[], notes: string) => void;
  onClose: () => void;
}

export const RecipeModal: React.FC<Props> = ({ menu, ingredients, onSave, onClose }) => {
  const [recipe, setRecipe] = useState<RecipeItem[]>(menu.recipe);
  const [selectedIngredient, setSelectedIngredient] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [notes, setNotes] = useState<string>(menu.notes || '');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selectedIng = ingredients.find(ing => ing.id === selectedIngredient);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset focused index when search query changes or dropdown opens
  useEffect(() => {
    if (isDropdownOpen) {
      setFocusedIndex(0);
    } else {
      setFocusedIndex(-1);
    }
  }, [isDropdownOpen, searchQuery]);

  const addIngredientById = (id: string) => {
    const ing = ingredients.find(i => i.id === id);
    if (!ing) return;

    const existing = recipe.find(item => item.ingredientId === id);
    if (existing) {
      setRecipe(recipe.map(item => 
        item.ingredientId === id 
          ? { ...item, quantity: item.quantity + quantity }
          : item
      ));
    } else {
      setRecipe([...recipe, { ingredientId: id, quantity }]);
    }
    setSelectedIngredient('');
    setQuantity(1);
    setIsDropdownOpen(false);
    setSearchQuery('');
  };

  const handleAdd = () => {
    if (!selectedIngredient || quantity <= 0) return;
    addIngredientById(selectedIngredient);
  };

  const handleRemove = (id: string) => {
    setRecipe(recipe.filter(item => item.ingredientId !== id));
  };

  const handleSave = () => {
    onSave(menu.id, recipe, notes);
    alert('저장이 완료되었습니다.');
    onClose();
  };

  const totalCost = calculateTotalCost(recipe, ingredients);

  const filteredIngredients = ingredients
    .filter(ing => !ing.isArchived)
    .filter(ing => ing.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (!isDropdownOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsDropdownOpen(true);
      }
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      if (focusedIndex >= 0 && focusedIndex < filteredIngredients.length) {
        addIngredientById(filteredIngredients[focusedIndex].id);
      } else if (filteredIngredients.length > 0) {
        addIngredientById(filteredIngredients[0].id);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex(prev => (prev < filteredIngredients.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex(prev => (prev > 0 ? prev - 1 : prev));
    } else if (e.key === 'Escape') {
      setIsDropdownOpen(false);
    }
  };

  // Scroll focused item into view
  useEffect(() => {
    if (focusedIndex >= 0 && listRef.current) {
      const focusedElement = listRef.current.children[focusedIndex] as HTMLElement;
      if (focusedElement) {
        focusedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [focusedIndex]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh] border border-slate-200 dark:border-slate-800">
        <div className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">레시피 관리</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">{menu.name}</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 shrink-0 bg-slate-50 dark:bg-slate-800/30">
          <div className="flex gap-2 items-end">
            <div className="flex-1 relative" ref={dropdownRef}>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">재료 검색 및 선택</label>
              
              <div className="relative">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="text"
                    placeholder={selectedIng ? selectedIng.name : "재료명을 검색하여 선택하세요..."}
                    value={searchQuery}
                    onChange={e => {
                      setSearchQuery(e.target.value);
                      setIsDropdownOpen(true);
                    }}
                    onFocus={() => setIsDropdownOpen(true)}
                    onKeyDown={handleSearchKeyDown}
                    className="w-full pl-10 pr-10 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white transition-all"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    {selectedIng && !searchQuery && (
                      <span className="text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded border border-blue-100 dark:border-blue-800">
                        선택됨
                      </span>
                    )}
                    <ChevronDown 
                      size={16} 
                      className={`text-slate-400 transition-transform cursor-pointer ${isDropdownOpen ? 'rotate-180' : ''}`}
                      onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    />
                  </div>
                </div>

                {isDropdownOpen && (
                  <div className="absolute z-[60] left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md shadow-xl max-h-64 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="py-1" ref={listRef}>
                      {filteredIngredients.length === 0 ? (
                        <div className="px-4 py-6 text-sm text-slate-500 dark:text-slate-400 text-center flex flex-col items-center gap-2">
                          <Search size={24} className="text-slate-300 dark:text-slate-600" />
                          <span>검색 결과가 없습니다.</span>
                        </div>
                      ) : (
                        filteredIngredients.map((ing, index) => (
                          <button
                            key={ing.id}
                            type="button"
                            onClick={() => addIngredientById(ing.id)}
                            onMouseEnter={() => setFocusedIndex(index)}
                            className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex justify-between items-center group
                              ${focusedIndex === index ? 'bg-blue-50 dark:bg-blue-900/30' : ''}
                              ${selectedIngredient === ing.id ? 'text-blue-700 dark:text-blue-400 font-medium' : 'text-slate-700 dark:text-slate-300'}
                            `}
                          >
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2">
                                <span className={`transition-colors ${focusedIndex === index || selectedIngredient === ing.id ? 'text-blue-700 dark:text-blue-400' : ''}`}>
                                  {ing.name}
                                </span>
                                {ing.isSelectedForMenu && (
                                  <span className="text-[8px] bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 px-1 rounded border border-blue-200 dark:border-blue-800">메뉴용</span>
                                )}
                                {selectedIngredient === ing.id && (
                                  <Check size={14} className="text-blue-600 dark:text-blue-400" />
                                )}
                              </div>
                              <span className="text-[10px] text-slate-400 uppercase tracking-wider">단위: {ing.unit}</span>
                            </div>
                            <div className="text-right">
                              <div className="font-semibold">{formatCurrency(ing.unitSalesPrice || 0)}</div>
                              <div className="text-[10px] text-slate-400">1단위당</div>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div className="w-24">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">수량</label>
              <input 
                type="number" 
                min="0.1" 
                step="0.1" 
                value={quantity} 
                onChange={e => setQuantity(parseFloat(e.target.value) || 0)}
                className="w-full border border-slate-300 dark:border-slate-700 rounded-md px-3 py-1.5 text-sm text-right bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
            <button 
              onClick={handleAdd}
              disabled={!selectedIngredient}
              className="px-3 py-1.5 bg-slate-900 dark:bg-blue-600 text-white rounded-md hover:bg-slate-800 dark:hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1 text-sm h-[34px] transition-colors"
            >
              <Plus size={16} /> 추가
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {recipe.length === 0 ? (
            <div className="text-center text-slate-500 dark:text-slate-400 py-8 text-sm">등록된 재료가 없습니다.</div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 dark:text-slate-400 uppercase border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="pb-2">재료명</th>
                  <th className="pb-2 text-right">단가</th>
                  <th className="pb-2 text-right">수량</th>
                  <th className="pb-2 text-right">금액</th>
                  <th className="pb-2 text-center w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {recipe.map(item => {
                  const ing = ingredients.find(i => i.id === item.ingredientId);
                  const cost = ing ? (ing.unitSalesPrice || 0) * item.quantity : 0;
                  return (
                    <tr key={item.ingredientId} className={`hover:bg-blue-50/40 dark:hover:bg-blue-900/20 transition-colors group ${!ing ? 'bg-rose-50/50 dark:bg-rose-900/10' : ''}`}>
                      <td className="py-2 text-slate-900 dark:text-slate-100 group-hover:text-blue-800 dark:group-hover:text-blue-400 transition-colors">
                        <div className="flex items-center gap-2">
                          {ing ? ing.name : '삭제된 식자재'}
                          {!ing && (
                            <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-100 dark:bg-rose-900/30 px-1.5 py-0.5 rounded uppercase tracking-wider">
                              누락됨
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2 text-right text-slate-500 dark:text-slate-400">
                        {ing ? (
                          <>{formatCurrency(ing.unitSalesPrice || 0)}<span className="text-xs">/{ing.unit}</span></>
                        ) : (
                          <span className="text-rose-500">-</span>
                        )}
                      </td>
                      <td className="py-2 text-right">
                        <input 
                          type="number" 
                          min="0.1" 
                          step="0.1"
                          value={item.quantity}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setRecipe(recipe.map(r => r.ingredientId === item.ingredientId ? { ...r, quantity: val } : r));
                          }}
                          className="w-16 border border-slate-300 dark:border-slate-700 rounded px-1 py-0.5 text-right text-sm inline-block bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                        />
                      </td>
                      <td className="py-2 text-right font-medium text-slate-900 dark:text-slate-100">{formatCurrency(cost)}</td>
                      <td className="py-2 text-center">
                        <button onClick={() => handleRemove(item.ingredientId)} className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors">
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          
          <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">레시피 메모 / 캡션</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full border border-slate-300 dark:border-slate-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white min-h-[100px]"
              placeholder="레시피에 대한 추가 설명이나 메모를 입력하세요..."
            />
          </div>
        </div>

        <div className="p-4 border-t border-slate-200 dark:border-slate-800 shrink-0 bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center">
          <div className="text-sm text-slate-700 dark:text-slate-300">
            총 원가: <span className="text-lg font-bold text-blue-600 dark:text-blue-400">{formatCurrency(totalCost)}</span>
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-md transition-colors">
              취소
            </button>
            <button onClick={handleSave} className="px-4 py-2 text-sm text-white bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-700 rounded-md transition-colors">
              저장
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
