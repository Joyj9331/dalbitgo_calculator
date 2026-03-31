import React, { useState, useRef, useEffect } from 'react';
import { Menu, Ingredient, RecipeItem } from '../types';
import { X, Plus, Trash2, Search, ChevronDown } from 'lucide-react';
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
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  const handleAdd = () => {
    if (!selectedIngredient || quantity <= 0) return;
    
    const existing = recipe.find(item => item.ingredientId === selectedIngredient);
    if (existing) {
      setRecipe(recipe.map(item => 
        item.ingredientId === selectedIngredient 
          ? { ...item, quantity: item.quantity + quantity }
          : item
      ));
    } else {
      setRecipe([...recipe, { ingredientId: selectedIngredient, quantity }]);
    }
    setSelectedIngredient('');
    setQuantity(1);
  };

  const handleRemove = (id: string) => {
    setRecipe(recipe.filter(item => item.ingredientId !== id));
  };

  const handleSave = () => {
    onSave(menu.id, recipe, notes);
  };

  const totalCost = calculateTotalCost(recipe, ingredients);

  const filteredIngredients = ingredients
    .filter(ing => !ing.isArchived)
    .filter(ing => ing.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredIngredients.length > 0) {
        setSelectedIngredient(filteredIngredients[0].id);
        setIsDropdownOpen(false);
        setSearchQuery('');
      }
    } else if (e.key === 'Escape') {
      setIsDropdownOpen(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-4 border-b shrink-0">
          <div>
            <h2 className="text-lg font-semibold">레시피 관리</h2>
            <p className="text-sm text-gray-500">{menu.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-4 border-b shrink-0 bg-gray-50">
          <div className="flex gap-2 items-end">
            <div className="flex-1 relative" ref={dropdownRef}>
              <label className="block text-xs font-medium text-gray-700 mb-1">재료 검색 및 선택</label>
              
              <div className="relative">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
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
                    className="w-full pl-10 pr-10 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white transition-all"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    {selectedIng && !searchQuery && (
                      <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                        선택됨
                      </span>
                    )}
                    <ChevronDown 
                      size={16} 
                      className={`text-gray-400 transition-transform cursor-pointer ${isDropdownOpen ? 'rotate-180' : ''}`}
                      onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    />
                  </div>
                </div>

                {isDropdownOpen && (
                  <div className="absolute z-[60] left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-xl max-h-64 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="py-1">
                      {filteredIngredients.length === 0 ? (
                        <div className="px-4 py-6 text-sm text-gray-500 text-center flex flex-col items-center gap-2">
                          <Search size={24} className="text-gray-300" />
                          <span>검색 결과가 없습니다.</span>
                        </div>
                      ) : (
                        filteredIngredients.map((ing, index) => (
                          <button
                            key={ing.id}
                            type="button"
                            onClick={() => {
                              setSelectedIngredient(ing.id);
                              setIsDropdownOpen(false);
                              setSearchQuery('');
                            }}
                            className={`w-full text-left px-4 py-2.5 text-sm hover:bg-blue-50 transition-colors flex justify-between items-center group ${selectedIngredient === ing.id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700'}`}
                          >
                            <div className="flex flex-col">
                              <span className="group-hover:text-blue-700">{ing.name}</span>
                              <span className="text-[10px] text-gray-400 uppercase tracking-wider">단위: {ing.unit}</span>
                            </div>
                            <div className="text-right">
                              <div className="font-semibold">{formatCurrency(ing.unitCost)}</div>
                              <div className="text-[10px] text-gray-400">1단위당</div>
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
              <label className="block text-xs font-medium text-gray-700 mb-1">수량</label>
              <input 
                type="number" 
                min="0.1" 
                step="0.1" 
                value={quantity} 
                onChange={e => setQuantity(parseFloat(e.target.value) || 0)}
                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm text-right"
              />
            </div>
            <button 
              onClick={handleAdd}
              disabled={!selectedIngredient}
              className="px-3 py-1.5 bg-slate-900 text-white rounded-md hover:bg-slate-800 disabled:opacity-50 flex items-center gap-1 text-sm h-[34px]"
            >
              <Plus size={16} /> 추가
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {recipe.length === 0 ? (
            <div className="text-center text-gray-500 py-8 text-sm">등록된 재료가 없습니다.</div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-500 uppercase border-b">
                <tr>
                  <th className="pb-2">재료명</th>
                  <th className="pb-2 text-right">단가</th>
                  <th className="pb-2 text-right">수량</th>
                  <th className="pb-2 text-right">금액</th>
                  <th className="pb-2 text-center w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {recipe.map(item => {
                  const ing = ingredients.find(i => i.id === item.ingredientId);
                  if (!ing) return null;
                  const cost = ing.unitCost * item.quantity;
                  return (
                    <tr key={item.ingredientId}>
                      <td className="py-2">{ing.name}</td>
                      <td className="py-2 text-right text-gray-500">{formatCurrency(ing.unitCost)}<span className="text-xs">/{ing.unit}</span></td>
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
                          className="w-16 border rounded px-1 py-0.5 text-right text-sm inline-block"
                        />
                      </td>
                      <td className="py-2 text-right font-medium">{formatCurrency(cost)}</td>
                      <td className="py-2 text-center">
                        <button onClick={() => handleRemove(item.ingredientId)} className="text-gray-400 hover:text-red-600">
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          
          <div className="mt-6 pt-4 border-t">
            <label className="block text-sm font-medium text-gray-700 mb-2">레시피 메모 / 캡션</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 min-h-[100px]"
              placeholder="레시피에 대한 추가 설명이나 메모를 입력하세요..."
            />
          </div>
        </div>

        <div className="p-4 border-t shrink-0 bg-gray-50 flex justify-between items-center">
          <div className="text-sm">
            총 원가: <span className="text-lg font-bold text-blue-600">{formatCurrency(totalCost)}</span>
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-200 rounded-md">
              취소
            </button>
            <button onClick={handleSave} className="px-4 py-2 text-sm text-white bg-slate-900 hover:bg-slate-800 rounded-md">
              저장
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
