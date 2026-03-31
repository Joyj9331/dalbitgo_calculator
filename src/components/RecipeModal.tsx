import React, { useState } from 'react';
import { Menu, Ingredient, RecipeItem } from '../types';
import { X, Plus, Trash2 } from 'lucide-react';
import { calculateTotalCost, formatCurrency } from '../utils';

interface Props {
  menu: Menu;
  ingredients: Ingredient[];
  onSave: (menuId: string, recipe: RecipeItem[]) => void;
  onClose: () => void;
}

export const RecipeModal: React.FC<Props> = ({ menu, ingredients, onSave, onClose }) => {
  const [recipe, setRecipe] = useState<RecipeItem[]>(menu.recipe);
  const [selectedIngredient, setSelectedIngredient] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);

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
    onSave(menu.id, recipe);
  };

  const totalCost = calculateTotalCost(recipe, ingredients);

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
        
        <div className="p-4 border-b shrink-0 bg-gray-50 flex gap-2 items-end">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-700 mb-1">재료 선택</label>
            <select 
              value={selectedIngredient} 
              onChange={e => setSelectedIngredient(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm"
            >
              <option value="">재료를 선택하세요</option>
              {ingredients.map(ing => (
                <option key={ing.id} value={ing.id}>
                  {ing.name} ({formatCurrency(ing.unitCost)}/{ing.unit})
                </option>
              ))}
            </select>
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
            className="px-3 py-1.5 bg-slate-900 text-white rounded-md hover:bg-slate-800 disabled:opacity-50 flex items-center gap-1 text-sm"
          >
            <Plus size={16} /> 추가
          </button>
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
