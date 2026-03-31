import React, { useState, useRef } from 'react';
import { Ingredient, Unit } from '../types';
import { X, Plus, Archive, Edit2, RotateCcw, Trash2, Upload, Search } from 'lucide-react';
import { formatCurrency } from '../utils';
import Papa from 'papaparse';

interface Props {
  ingredients: Ingredient[];
  onSave: (ingredients: Ingredient[]) => void;
  onClose: () => void;
}

export const IngredientManager: React.FC<Props> = ({ ingredients: initialIngredients, onSave, onClose }) => {
  const [ingredients, setIngredients] = useState<Ingredient[]>(initialIngredients);
  const [name, setName] = useState('');
  const [boxCost, setBoxCost] = useState<number>(0);
  const [boxQuantity, setBoxQuantity] = useState<number>(1);
  const [unit, setUnit] = useState<Unit>('kg');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'active' | 'archived'>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const newIngredients: Ingredient[] = [];
        let errorCount = 0;

        results.data.forEach((row: any) => {
          try {
            // CSV 헤더: 출처분류,제품명,규격,총 가격,기준 단위,1단위당 단가(원)
            const name = row['제품명']?.trim();
            const boxCostStr = row['총 가격']?.toString().replace(/,/g, '');
            const boxCost = parseFloat(boxCostStr);
            const unitStr = row['기준 단위']?.trim().toLowerCase();
            
            // 규격에서 숫자만 추출하여 박스당 수량으로 사용 (예: "3kg" -> 3)
            // 규격 파싱이 어려울 경우 기본값 1 사용
            let boxQuantity = 1;
            const specStr = row['규격']?.toString();
            if (specStr) {
               const match = specStr.match(/([\d.]+)/);
               if (match) {
                 boxQuantity = parseFloat(match[1]);
               }
            }

            // 단위 매핑
            let unit: Unit = 'ea';
            if (unitStr === 'kg') unit = 'kg';
            else if (unitStr === 'g') unit = 'g';
            else if (unitStr === '미') unit = '미';

            if (name && !isNaN(boxCost)) {
              // 1단위당 단가가 있으면 사용, 없으면 계산
              let unitCost = 0;
              const unitCostStr = row['1단위당 단가(원)']?.toString().replace(/,/g, '');
              if (unitCostStr && !isNaN(parseFloat(unitCostStr))) {
                unitCost = Math.round(parseFloat(unitCostStr));
              } else {
                unitCost = Math.round(boxCost / boxQuantity);
              }

              newIngredients.push({
                id: Date.now().toString() + Math.random().toString(36).substring(7),
                name,
                boxCost,
                boxQuantity,
                unitCost,
                unit,
                isArchived: false,
                createdAt: new Date().toISOString()
              });
            } else {
              errorCount++;
            }
          } catch (e) {
            errorCount++;
          }
        });

        if (newIngredients.length > 0) {
          setIngredients(prev => [...prev, ...newIngredients]);
          alert(`성공적으로 ${newIngredients.length}개의 식자재를 불러왔습니다.${errorCount > 0 ? `\n(${errorCount}개의 행은 형식이 맞지 않아 제외되었습니다.)` : ''}`);
        } else {
          alert('불러올 수 있는 유효한 데이터가 없습니다. CSV 파일 형식을 확인해주세요.');
        }
        
        // 파일 입력 초기화
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      },
      error: (error) => {
        alert(`CSV 파일 읽기 오류: ${error.message}`);
      }
    });
  };

  const handleAddOrUpdate = () => {
    if (!name || boxCost < 0 || boxQuantity <= 0) return;

    const unitCost = Math.round(boxCost / boxQuantity);

    if (editingId) {
      setIngredients(ingredients.map(ing => 
        ing.id === editingId ? { ...ing, name, boxCost, boxQuantity, unitCost, unit } : ing
      ));
      setEditingId(null);
    } else {
      setIngredients([...ingredients, { 
        id: Date.now().toString(), 
        name, 
        boxCost, 
        boxQuantity, 
        unitCost, 
        unit, 
        isArchived: false,
        createdAt: new Date().toISOString()
      }]);
    }
    setName('');
    setBoxCost(0);
    setBoxQuantity(1);
    setUnit('kg');
  };

  const handleEdit = (ing: Ingredient) => {
    setEditingId(ing.id);
    setName(ing.name);
    setBoxCost(ing.boxCost);
    setBoxQuantity(ing.boxQuantity);
    setUnit(ing.unit);
  };

  const handleArchive = (id: string) => {
    setIngredients(ingredients.map(ing => ing.id === id ? { ...ing, isArchived: true } : ing));
  };

  const handleRestore = (id: string) => {
    setIngredients(ingredients.map(ing => ing.id === id ? { ...ing, isArchived: false } : ing));
  };

  const handlePermanentDelete = (id: string) => {
    if (window.confirm('정말로 이 식자재를 영구 삭제하시겠습니까?')) {
      setIngredients(ingredients.filter(ing => ing.id !== id));
    }
  };

  const activeIngredients = ingredients.filter(ing => !ing.isArchived);
  const archivedIngredients = ingredients.filter(ing => ing.isArchived);

  const displayedIngredients = (activeTab === 'active' ? activeIngredients : archivedIngredients)
    .filter(ing => ing.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-4 border-b shrink-0">
          <h2 className="text-lg font-semibold">식자재 관리</h2>
          <div className="flex items-center gap-4">
            <input
              type="file"
              accept=".csv"
              ref={fileInputRef}
              onChange={handleFileUpload}
              className="hidden"
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-50 text-green-700 hover:bg-green-100 rounded-md transition-colors font-medium border border-green-200"
              title="CSV 파일 업로드 (형식: 출처분류,제품명,규격,총 가격,기준 단위,1단위당 단가(원))"
            >
              <Upload size={16} />
              CSV 불러오기
            </button>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex border-b bg-gray-50 px-4 pt-2 shrink-0 items-center">
          <button 
            onClick={() => setActiveTab('active')}
            className={`px-4 py-2 text-sm font-medium border-b-2 ${activeTab === 'active' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            활성 식자재
          </button>
          <button 
            onClick={() => setActiveTab('archived')}
            className={`px-4 py-2 text-sm font-medium border-b-2 ${activeTab === 'archived' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            보관함
          </button>
          <div className="ml-auto pb-2 relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="식자재 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 w-64"
            />
          </div>
        </div>

        {activeTab === 'active' && (
          <div className="p-4 border-b shrink-0 bg-gray-50 flex flex-wrap gap-2 items-end">
            <div className="flex-1 min-w-[150px]">
              <label className="block text-xs font-medium text-gray-700 mb-1">재료명</label>
              <input 
                type="text" 
                value={name} 
                onChange={e => setName(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm"
                placeholder="예: 고등어"
              />
            </div>
            <div className="w-28">
              <label className="block text-xs font-medium text-gray-700 mb-1">박스당단가</label>
              <input 
                type="number" 
                min="0" 
                step="100"
                value={boxCost} 
                onChange={e => setBoxCost(parseInt(e.target.value) || 0)}
                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm text-right"
              />
            </div>
            <div className="w-24">
              <label className="block text-xs font-medium text-gray-700 mb-1">박스당 수량</label>
              <input 
                type="number" 
                min="0.1" 
                step="0.1"
                value={boxQuantity} 
                onChange={e => setBoxQuantity(parseFloat(e.target.value) || 0)}
                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm text-right"
              />
            </div>
            <div className="w-20">
              <label className="block text-xs font-medium text-gray-700 mb-1">단위</label>
              <select 
                value={unit} 
                onChange={e => setUnit(e.target.value as Unit)}
                className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
              >
                <option value="kg">kg</option>
                <option value="g">g</option>
                <option value="ea">ea</option>
                <option value="미">미</option>
              </select>
            </div>
            <div className="w-24 bg-gray-100 px-3 py-1.5 rounded-md border border-gray-200 text-right">
              <label className="block text-xs font-medium text-gray-500 mb-1 text-left">단가(원)</label>
              <span className="text-sm font-semibold text-blue-600">
                {formatCurrency(boxQuantity > 0 ? Math.round(boxCost / boxQuantity) : 0)}
              </span>
            </div>
            <button 
              onClick={handleAddOrUpdate}
              disabled={!name || boxQuantity <= 0}
              className="px-3 py-1.5 bg-slate-900 text-white rounded-md hover:bg-slate-800 disabled:opacity-50 flex items-center gap-1 text-sm h-[34px]"
            >
              {editingId ? '수정' : <><Plus size={16} /> 추가</>}
            </button>
            {editingId && (
              <>
                <button 
                  onClick={() => {
                    handleArchive(editingId);
                    setEditingId(null);
                    setName('');
                    setBoxCost(0);
                    setBoxQuantity(1);
                    setUnit('kg');
                  }}
                  className="px-3 py-1.5 bg-orange-100 text-orange-700 rounded-md hover:bg-orange-200 text-sm h-[34px]"
                >
                  보관함 이동
                </button>
                <button 
                  onClick={() => {
                    setEditingId(null);
                    setName('');
                    setBoxCost(0);
                    setBoxQuantity(1);
                    setUnit('kg');
                  }}
                  className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 text-sm h-[34px]"
                >
                  취소
                </button>
              </>
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-500 uppercase border-b">
              <tr>
                <th className="pb-2">재료명</th>
                <th className="pb-2 text-right">박스당단가</th>
                <th className="pb-2 text-right">박스당 수량</th>
                <th className="pb-2 text-center">단위</th>
                <th className="pb-2 text-right">단가(원)</th>
                <th className="pb-2 text-center w-20">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {displayedIngredients.map(ing => (
                <tr key={ing.id} className={editingId === ing.id ? 'bg-blue-50' : ''}>
                  <td className="py-2">{ing.name}</td>
                  <td className="py-2 text-right text-gray-500">{formatCurrency(ing.boxCost)}</td>
                  <td className="py-2 text-right text-gray-500">{ing.boxQuantity}</td>
                  <td className="py-2 text-center text-gray-500">{ing.unit}</td>
                  <td className="py-2 text-right font-medium text-blue-600">{formatCurrency(ing.unitCost)}</td>
                  <td className="py-2 text-center space-x-1">
                    {activeTab === 'active' ? (
                      <>
                        <button onClick={() => handleEdit(ing)} className="p-1 text-gray-400 hover:text-blue-600 rounded" title="수정">
                          <Edit2 size={16} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => handleRestore(ing.id)} className="p-1 text-gray-400 hover:text-green-600 rounded" title="복구">
                          <RotateCcw size={16} />
                        </button>
                        <button onClick={() => handlePermanentDelete(ing.id)} className="p-1 text-gray-400 hover:text-red-600 rounded" title="영구 삭제">
                          <Trash2 size={16} />
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {displayedIngredients.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-500">
                    {searchQuery 
                      ? '검색 결과가 없습니다.' 
                      : (activeTab === 'active' ? '등록된 식자재가 없습니다.' : '보관된 식자재가 없습니다.')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t shrink-0 bg-gray-50 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-200 rounded-md">
            취소
          </button>
          <button onClick={() => onSave(ingredients)} className="px-4 py-2 text-sm text-white bg-slate-900 hover:bg-slate-800 rounded-md">
            저장
          </button>
        </div>
      </div>
    </div>
  );
};
