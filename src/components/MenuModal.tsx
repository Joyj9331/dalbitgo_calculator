import React, { useState } from 'react';
import { Menu, Region } from '../types';
import { X } from 'lucide-react';

interface Props {
  menu?: Menu;
  onSave: (menu: Menu) => void;
  onClose: () => void;
  onArchive?: (id: string) => void;
  onDelete?: (id: string) => void;
}

export const MenuModal: React.FC<Props> = ({ menu, onSave, onClose, onArchive, onDelete }) => {
  const isEdit = !!menu;
  const [name, setName] = useState(menu?.name || '');
  const [prices, setPrices] = useState<Record<Region, number>>(
    menu?.prices || { '지방권': 0, '광역권': 0, '수도권': 0 }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      id: menu?.id || Date.now().toString(),
      name,
      prices,
      recipe: menu?.recipe || [],
      isArchived: menu?.isArchived || false,
      createdAt: menu?.createdAt || new Date().toISOString(),
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-lg font-semibold">{isEdit ? '메뉴 수정' : '새 메뉴 추가'}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">메뉴명</label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="예: 고등어구이"
            />
          </div>
          
          <div className="pt-2 border-t">
            <h3 className="text-sm font-medium text-gray-700 mb-2">권역별 판매가 설정</h3>
            <div className="space-y-3">
              {(['지방권', '광역권', '수도권'] as Region[]).map(region => (
                <div key={region} className="flex items-center gap-3">
                  <label className="w-16 text-sm text-gray-600">{region}</label>
                  <div className="relative flex-1">
                    <input
                      type="number"
                      required
                      min="0"
                      step="100"
                      value={prices[region]}
                      onChange={e => setPrices({ ...prices, [region]: parseInt(e.target.value) || 0 })}
                      className="w-full border border-gray-300 rounded-md pl-3 pr-8 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 text-right"
                    />
                    <span className="absolute right-3 top-1.5 text-gray-400 text-sm">원</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-between items-center pt-4">
            <div className="flex gap-2">
              {isEdit && onArchive && (
                <button type="button" onClick={() => { onArchive(menu.id); onClose(); }} className="px-4 py-2 text-sm text-orange-600 hover:bg-orange-50 rounded-md transition-colors">
                  보관함으로 이동
                </button>
              )}
              {isEdit && onDelete && (
                <button type="button" onClick={() => { 
                  if (window.confirm('정말로 이 메뉴를 영구 삭제하시겠습니까?')) {
                    onDelete(menu.id); 
                  }
                }} className="px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md transition-colors">
                  영구 삭제
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-md">
                취소
              </button>
              <button type="submit" className="px-4 py-2 text-sm text-white bg-slate-900 hover:bg-slate-800 rounded-md">
                저장
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
