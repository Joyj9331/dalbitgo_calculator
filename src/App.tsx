/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { Menu, Ingredient, Region, RecipeItem, User } from './types';
import { MenuTable } from './components/MenuTable';
import { OverviewTable } from './components/OverviewTable';
import { MenuModal } from './components/MenuModal';
import { RecipeModal } from './components/RecipeModal';
import { IngredientManager } from './components/IngredientManager';
import { ArchiveView } from './components/ArchiveView';
import { Auth, ChangePasswordModal } from './components/Auth';
import { AdminPanel } from './components/AdminPanel';
import { Plus, Settings, Upload, Download, LogOut, KeyRound, Users } from 'lucide-react';
import Papa from 'papaparse';
import { calculateTotalCost, formatPercent } from './utils';
import { auth, db } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, collection, onSnapshot, setDoc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';

type TabType = Region | '전체보기' | '보관함';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);

  const [menus, setMenus] = useState<Menu[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('수도권');
  
  const [isMenuModalOpen, setIsMenuModalOpen] = useState(false);
  const [editingMenu, setEditingMenu] = useState<Menu | undefined>(undefined);
  
  const [isRecipeModalOpen, setIsRecipeModalOpen] = useState(false);
  const [recipeMenu, setRecipeMenu] = useState<Menu | null>(null);
  
  const [isIngredientModalOpen, setIsIngredientModalOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const tabs: TabType[] = ['지방권', '광역권', '수도권', '전체보기', '보관함'];

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user && user.emailVerified) {
        // Fetch user document from Firestore
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data() as User;
          if (userData.isActive) {
            setCurrentUser(userData);
          } else {
            alert('계정이 정지되었습니다. 관리자에게 문의하세요.');
            await signOut(auth);
            setCurrentUser(null);
          }
        } else {
          setCurrentUser(null);
        }
      } else {
        setCurrentUser(null);
      }
      setIsAuthReady(true);
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!currentUser || (!currentUser.isApproved && currentUser.role !== 'admin')) return;

    const unsubscribeMenus = onSnapshot(collection(db, 'menus'), (snapshot) => {
      const menusData: Menu[] = [];
      snapshot.forEach(doc => menusData.push(doc.data() as Menu));
      setMenus(menusData);
    });

    const unsubscribeIngredients = onSnapshot(collection(db, 'ingredients'), (snapshot) => {
      const ingredientsData: Ingredient[] = [];
      snapshot.forEach(doc => ingredientsData.push(doc.data() as Ingredient));
      setIngredients(ingredientsData);
    });

    return () => {
      unsubscribeMenus();
      unsubscribeIngredients();
    };
  }, [currentUser]);

  const handleLogout = async () => {
    await signOut(auth);
    setCurrentUser(null);
  };

  if (!isAuthReady) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50">로딩 중...</div>;
  }

  if (!currentUser) {
    return <Auth />;
  }

  if (!currentUser.isApproved && currentUser.role !== 'admin') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 text-center max-w-md w-full">
          <h2 className="text-xl font-bold text-slate-900 mb-2">승인 대기 중</h2>
          <p className="text-slate-600 mb-6">관리자의 가입 승인을 기다리고 있습니다. 승인 후 이용 가능합니다.</p>
          <button onClick={handleLogout} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200">
            로그아웃
          </button>
        </div>
      </div>
    );
  }

  const activeMenus = menus.filter(m => !m.isArchived);
  const archivedMenus = menus.filter(m => m.isArchived);

  const handleSaveMenu = async (menu: Menu) => {
    try {
      await setDoc(doc(db, 'menus', menu.id), menu);
      setIsMenuModalOpen(false);
      setEditingMenu(undefined);
    } catch (error) {
      console.error('Error saving menu:', error);
      alert('메뉴 저장 실패');
    }
  };

  const handleArchiveMenu = async (id: string) => {
    if (window.confirm('메뉴를 보관함으로 이동하시겠습니까?')) {
      try {
        await updateDoc(doc(db, 'menus', id), { isArchived: true });
      } catch (error) {
        console.error('Error archiving menu:', error);
        alert('메뉴 보관 실패');
      }
    }
  };

  const handleRestoreMenu = async (id: string) => {
    try {
      await updateDoc(doc(db, 'menus', id), { isArchived: false });
    } catch (error) {
      console.error('Error restoring menu:', error);
      alert('메뉴 복구 실패');
    }
  };

  const handleDeleteMenu = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'menus', id));
      setIsMenuModalOpen(false);
      setEditingMenu(undefined);
    } catch (error) {
      console.error('Error deleting menu:', error);
      alert('메뉴 영구 삭제 실패');
    }
  };

  const handleSaveRecipe = async (menuId: string, recipe: RecipeItem[], notes: string) => {
    try {
      await updateDoc(doc(db, 'menus', menuId), { recipe, notes });
      setIsRecipeModalOpen(false);
      setRecipeMenu(null);
    } catch (error) {
      console.error('Error saving recipe:', error);
      alert('레시피 저장 실패');
    }
  };

  const handleSaveIngredients = async (newIngredients: Ingredient[]) => {
    try {
      const batch = writeBatch(db);
      
      // Find deleted ingredients
      const deletedIds = ingredients
        .filter(ing => !newIngredients.find(u => u.id === ing.id))
        .map(ing => ing.id);
        
      deletedIds.forEach(id => {
        batch.delete(doc(db, 'ingredients', id));
      });

      newIngredients.forEach(ing => {
        const ingRef = doc(db, 'ingredients', ing.id);
        batch.set(ingRef, ing);
      });
      
      await batch.commit();
      setIsIngredientModalOpen(false);
    } catch (error) {
      console.error('Error saving ingredients:', error);
      alert('식자재 저장 실패');
    }
  };

  const handleImportCsv = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const newMenus: Menu[] = results.data.map((row: any, index) => ({
            id: `imported-${Date.now()}-${index}`,
            name: row['메뉴명'] || '이름 없음',
            prices: {
              '지방권': parseInt(row['지방권_판매가']) || parseInt(row['지방권']) || 0,
              '광역권': parseInt(row['광역권_판매가']) || parseInt(row['광역권']) || 0,
              '수도권': parseInt(row['수도권_판매가']) || parseInt(row['수도권']) || 0,
            },
            recipe: [],
            isArchived: false,
            createdAt: new Date().toISOString()
          }));
          
          if (newMenus.length > 0) {
            for (const menu of newMenus) {
              await setDoc(doc(db, 'menus', menu.id), menu);
            }
            alert(`${newMenus.length}개의 메뉴가 추가되었습니다.`);
          }
        } catch (error) {
          alert('CSV 파일 형식이 올바르지 않습니다. (필수 헤더: 메뉴명, 지방권_판매가, 광역권_판매가, 수도권_판매가)');
        }
      }
    });
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleExportCsv = () => {
    const data = activeMenus.map(m => {
      const cost = calculateTotalCost(m.recipe, ingredients);
      const row: any = {
        '메뉴명': m.name,
        '원가': cost,
      };
      
      (['지방권', '광역권', '수도권'] as Region[]).forEach(r => {
        const price = m.prices[r] || 0;
        const margin = price - cost;
        const costRate = price > 0 ? cost / price : 0;
        const marginRate = price > 0 ? margin / price : 0;
        
        row[`${r}_판매가`] = price;
        row[`${r}_마진`] = margin;
        row[`${r}_원가율`] = formatPercent(costRate);
        row[`${r}_마진율`] = formatPercent(marginRate);
      });
      
      return row;
    });
    
    const csv = Papa.unparse(data);
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'menu_data.csv';
    link.click();
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">메뉴 원가/마진 대시보드</h1>
            <p className="text-sm text-slate-500 mt-1">권역별 메뉴 가격 및 레시피 원가 관리</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            <input 
              type="file" 
              accept=".csv" 
              className="hidden" 
              ref={fileInputRef}
              onChange={handleImportCsv}
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 flex items-center gap-1.5 text-sm shadow-sm transition-colors"
            >
              <Upload size={16} /> CSV 가져오기
            </button>
            <button 
              onClick={handleExportCsv}
              className="px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 flex items-center gap-1.5 text-sm shadow-sm transition-colors"
            >
              <Download size={16} /> CSV 내보내기
            </button>
            <button 
              onClick={() => setIsIngredientModalOpen(true)}
              className="px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 flex items-center gap-1.5 text-sm shadow-sm transition-colors"
            >
              <Settings size={16} /> 식자재 관리
            </button>
            <button 
              onClick={() => { setEditingMenu(undefined); setIsMenuModalOpen(true); }}
              className="px-3 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 flex items-center gap-1.5 text-sm shadow-sm transition-colors"
            >
              <Plus size={16} /> 메뉴 추가
            </button>
            
            <div className="h-8 w-px bg-slate-200 mx-2 hidden sm:block"></div>
            
            <div className="flex items-center gap-3 ml-2">
              <div className="flex flex-col items-end">
                <span className="text-sm font-medium text-slate-700">{currentUser.name}님</span>
                <span className="text-xs text-slate-500">{currentUser.role === 'admin' ? '관리자' : '사용자'}</span>
              </div>
              
              {currentUser.role === 'admin' && (
                <button 
                  onClick={() => setShowAdminPanel(!showAdminPanel)} 
                  className={`p-1.5 rounded-md transition-colors ${showAdminPanel ? 'bg-purple-100 text-purple-700' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-200'}`}
                  title="관리자 패널"
                >
                  <Users size={18} />
                </button>
              )}
              <button 
                onClick={() => setIsChangePasswordOpen(true)} 
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-md transition-colors"
                title="비밀번호 변경"
              >
                <KeyRound size={18} />
              </button>
              <button 
                onClick={handleLogout} 
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-md transition-colors"
                title="로그아웃"
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </div>

        {showAdminPanel && currentUser.role === 'admin' && (
          <div className="mb-8">
            <AdminPanel />
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white rounded-t-xl shadow-sm border-b border-slate-200">
          <nav className="flex -mb-px overflow-x-auto">
            {tabs.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab
                    ? 'border-slate-900 text-slate-900'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                {tab}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="bg-white shadow-sm rounded-b-xl overflow-hidden border border-t-0 border-slate-200">
          {activeTab === '전체보기' ? (
            <OverviewTable menus={activeMenus} ingredients={ingredients} />
          ) : activeTab === '보관함' ? (
            <ArchiveView menus={archivedMenus} ingredients={ingredients} onRestoreMenu={handleRestoreMenu} onDeleteMenu={handleDeleteMenu} />
          ) : (
            <MenuTable 
              menus={activeMenus} 
              ingredients={ingredients} 
              region={activeTab as Region} 
              onEditMenu={(menu) => { setEditingMenu(menu); setIsMenuModalOpen(true); }}
              onArchiveMenu={handleArchiveMenu}
              onEditRecipe={(menu) => { setRecipeMenu(menu); setIsRecipeModalOpen(true); }}
            />
          )}
        </div>
      </div>

      {/* Modals */}
      {isMenuModalOpen && (
        <MenuModal 
          menu={editingMenu} 
          onSave={handleSaveMenu} 
          onClose={() => { setIsMenuModalOpen(false); setEditingMenu(undefined); }} 
          onArchive={handleArchiveMenu}
          onDelete={handleDeleteMenu}
        />
      )}
      
      {isRecipeModalOpen && recipeMenu && (
        <RecipeModal 
          menu={recipeMenu} 
          ingredients={ingredients}
          onSave={handleSaveRecipe}
          onClose={() => { setIsRecipeModalOpen(false); setRecipeMenu(null); }}
        />
      )}

      {isIngredientModalOpen && (
        <IngredientManager 
          ingredients={ingredients}
          onSave={handleSaveIngredients}
          onClose={() => setIsIngredientModalOpen(false)}
        />
      )}

      {isChangePasswordOpen && (
        <ChangePasswordModal onClose={() => setIsChangePasswordOpen(false)} />
      )}
    </div>
  );
}
