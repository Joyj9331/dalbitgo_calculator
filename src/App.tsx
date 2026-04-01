/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { Menu, Ingredient, Region, RecipeItem, User, IngredientChange } from './types';
import { MenuTable } from './components/MenuTable';
import { OverviewTable } from './components/OverviewTable';
import { MenuModal } from './components/MenuModal';
import { RecipeModal } from './components/RecipeModal';
import { ArchiveView } from './components/ArchiveView';
import { IngredientChangeView } from './components/IngredientChangeView';
import { DatabaseView } from './components/DatabaseView';
import { Auth, ChangePasswordModal } from './components/Auth';
import { AdminPanel } from './components/AdminPanel';
import { 
  Plus, 
  Settings, 
  Upload, 
  Download, 
  LogOut, 
  KeyRound, 
  Users, 
  Sun, 
  Moon,
  LayoutDashboard,
  Archive,
  AlertTriangle,
  Trash2,
  X,
  History
} from 'lucide-react';
import Papa from 'papaparse';
import { calculateTotalCost, formatPercent } from './utils';
import { auth, db } from './firebase';
import { onAuthStateChanged, signOut, signInWithPopup, GoogleAuthProvider, User as FirebaseUser } from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  collection, 
  onSnapshot, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  writeBatch, 
  addDoc,
  query,
  where,
  orderBy,
  limit,
  getDocFromServer,
  deleteField
} from 'firebase/firestore';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

type TabType = Region | '전체보기' | '메뉴 관리' | '데이터 베이스' | '변동사항';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  const [menus, setMenus] = useState<Menu[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [ingredientChanges, setIngredientChanges] = useState<IngredientChange[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('수도권');
  
  const [isMenuModalOpen, setIsMenuModalOpen] = useState(false);
  const [editingMenu, setEditingMenu] = useState<Menu | undefined>(undefined);
  
  const [isRecipeModalOpen, setIsRecipeModalOpen] = useState(false);
  const [recipeMenu, setRecipeMenu] = useState<Menu | null>(null);
  const [showDeleteAllMenusConfirm, setShowDeleteAllMenusConfirm] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const ingredientFileInputRef = useRef<HTMLInputElement>(null);

  const tabs: TabType[] = ['지방권', '광역권', '수도권', '전체보기', '메뉴 관리', '데이터 베이스', '변동사항'];

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user && user.emailVerified) {
        // Fetch user document from Firestore
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          const userData = userDoc.data() as User;
          const isAdminEmail = user.email === 'saemoyang_official@naver.com' || user.email === 'wnsdl9331@gmail.com';
          
          if (userData.isActive) {
            // Force admin role for hardcoded emails if not already set
            if (isAdminEmail && (userData.role !== 'admin' || !userData.isApproved)) {
              const updatedUser = { ...userData, role: 'admin' as const, isApproved: true };
              await setDoc(userDocRef, updatedUser, { merge: true });
              setCurrentUser(updatedUser);
            } else {
              setCurrentUser(userData);
            }
            if (userData.theme) setTheme(userData.theme);
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
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = async () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    if (currentUser) {
      try {
        await updateDoc(doc(db, 'users', currentUser.uid), { theme: newTheme });
      } catch (error) {
        console.error('Error updating theme preference:', error);
      }
    }
  };

  useEffect(() => {
    if (!currentUser || (!currentUser.isApproved && currentUser.role !== 'admin')) return;

    const unsubscribeMenus = onSnapshot(collection(db, 'menus'), (snapshot) => {
      const menusData: Menu[] = [];
      snapshot.forEach(doc => menusData.push(doc.data() as Menu));
      setMenus(menusData);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'menus');
    });

    const unsubscribeIngredients = onSnapshot(collection(db, 'ingredients'), (snapshot) => {
      const ingredientsData: Ingredient[] = [];
      snapshot.forEach(doc => ingredientsData.push(doc.data() as Ingredient));
      setIngredients(ingredientsData);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'ingredients');
    });

    // Fetch changes from last 3 months
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    
    const qChanges = query(
      collection(db, 'ingredient_changes'),
      where('timestamp', '>=', threeMonthsAgo.toISOString())
    );

    const unsubscribeChanges = onSnapshot(qChanges, (snapshot) => {
      const changesData: IngredientChange[] = [];
      snapshot.forEach(doc => changesData.push(doc.data() as IngredientChange));
      setIngredientChanges(changesData);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'ingredient_changes');
    });

    return () => {
      unsubscribeMenus();
      unsubscribeIngredients();
      unsubscribeChanges();
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

  const handleDeleteAllMenus = async () => {
    try {
      const batch = writeBatch(db);
      menus.forEach(menu => {
        batch.delete(doc(db, 'menus', menu.id));
      });
      await batch.commit();
      setShowDeleteAllMenusConfirm(false);
    } catch (error) {
      console.error('Error deleting all menus:', error);
      alert('메뉴 전체 삭제 실패');
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

  const handleAcknowledgeAlert = async (menuId: string) => {
    if (currentUser.role !== 'admin') {
      alert('관리자만 알림을 해결할 수 있습니다.');
      return;
    }

    const menu = menus.find(m => m.id === menuId);
    if (!menu) return;

    const currentCost = calculateTotalCost(menu.recipe, ingredients);
    
    try {
      await updateDoc(doc(db, 'menus', menuId), {
        lastAcknowledgedCost: currentCost,
        hasAlert: false
      });
    } catch (error) {
      console.error('Error acknowledging alert:', error);
      alert('알림 해결 실패');
    }
  };

  const handleDeleteAllIngredients = async () => {
    try {
      const batch = writeBatch(db);
      
      // Delete all ingredients
      ingredients.forEach(ing => {
        batch.delete(doc(db, 'ingredients', ing.id));
      });
      
      // Delete all ingredient changes
      ingredientChanges.forEach(change => {
        batch.delete(doc(db, 'ingredient_changes', change.id));
      });
      
      // Reset all menus (clear alerts and acknowledged cost)
      menus.forEach(menu => {
        batch.update(doc(db, 'menus', menu.id), { 
          hasAlert: false,
          lastAcknowledgedCost: deleteField()
        });
      });
      
      await batch.commit();
      alert('전체 데이터가 초기화되었습니다. 이제 새로운 데이터를 등록할 수 있습니다.');
    } catch (error) {
      console.error('Error resetting data:', error);
      alert('데이터 초기화 실패');
    }
  };

  const handleUnselectAllIngredients = async () => {
    if (!window.confirm('메뉴용 식자재 선택을 모두 해제하시겠습니까?')) return;
    try {
      const batch = writeBatch(db);
      ingredients.forEach(ing => {
        if (ing.isSelectedForMenu) {
          batch.update(doc(db, 'ingredients', ing.id), { isSelectedForMenu: false });
        }
      });
      // Mark all menus with recipes as having alerts
      menus.forEach(menu => {
        if (menu.recipe.length > 0) {
          batch.update(doc(db, 'menus', menu.id), { hasAlert: true });
        }
      });
      await batch.commit();
      alert('메뉴용 식자재 선택이 모두 해제되었습니다.');
    } catch (error) {
      console.error('Error unselecting all ingredients:', error);
      alert('메뉴용 식자재 선택 해제 실패');
    }
  };

  const handleSaveIngredients = async (newIngredients: Ingredient[]) => {
    try {
      const batch = writeBatch(db);
      const timestamp = new Date().toISOString();
      
      // Find deleted ingredients
      const deletedIngredients = ingredients.filter(ing => !newIngredients.find(u => u.id === ing.id));
      
      deletedIngredients.forEach(ing => {
        batch.delete(doc(db, 'ingredients', ing.id));
        
        // Record deletion change
        const changeId = `change-${Date.now()}-${ing.id}`;
        const change: IngredientChange = {
          id: changeId,
          ingredientId: ing.id,
          name: ing.name,
          spec: ing.spec || '',
          type: 'deleted',
          prevPurchasePrice: ing.unitCost || 0,
          prevSalesPrice: ing.salesPrice || 0,
          timestamp
        };
        batch.set(doc(db, 'ingredient_changes', changeId), change);
      });

      newIngredients.forEach(ing => {
        const ingRef = doc(db, 'ingredients', ing.id);
        const prevIng = ingredients.find(p => p.id === ing.id);
        
        if (!prevIng) {
          // New registration
          const changeId = `change-${Date.now()}-${ing.id}`;
          const change: IngredientChange = {
            id: changeId,
            ingredientId: ing.id,
            name: ing.name,
            spec: ing.spec || '',
            type: 'new',
            currPurchasePrice: ing.unitCost || 0,
            currSalesPrice: ing.salesPrice || 0,
            timestamp
          };
          batch.set(doc(db, 'ingredient_changes', changeId), change);
        } else if (Math.abs(prevIng.unitCost - ing.unitCost) > 0.01 || prevIng.salesPrice !== ing.salesPrice) {
          // Price change
          const changeId = `change-${Date.now()}-${ing.id}`;
          const change: IngredientChange = {
            id: changeId,
            ingredientId: ing.id,
            name: ing.name,
            spec: ing.spec || '',
            type: 'price_change',
            prevPurchasePrice: prevIng.unitCost || 0,
            currPurchasePrice: ing.unitCost || 0,
            prevSalesPrice: prevIng.salesPrice || 0,
            currSalesPrice: ing.salesPrice || 0,
            timestamp
          };
          batch.set(doc(db, 'ingredient_changes', changeId), change);

          // Mark menus using this ingredient as having an alert
          menus.forEach(menu => {
            if (menu.recipe.some(item => item.ingredientId === ing.id)) {
              batch.update(doc(db, 'menus', menu.id), { hasAlert: true });
            }
          });
        }
        
        batch.set(ingRef, ing);
      });

      // Also mark menus with deleted ingredients as having an alert
      deletedIngredients.forEach(ing => {
        menus.forEach(menu => {
          if (menu.recipe.some(item => item.ingredientId === ing.id)) {
            batch.update(doc(db, 'menus', menu.id), { hasAlert: true });
          }
        });
      });
      
      await batch.commit();
    } catch (error) {
      console.error('Error saving ingredients:', error);
      alert('식자재 저장 실패');
    }
  };

  const handleImportMenuCsv = (e: React.ChangeEvent<HTMLInputElement>) => {
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
              '지방권': parseInt(row['지방권_판매가']?.replace(/,/g, '')) || 0,
              '광역권': parseInt(row['광역권_판매가']?.replace(/,/g, '')) || 0,
              '수도권': parseInt(row['수도권_판매가']?.replace(/,/g, '')) || 0,
            },
            recipe: [],
            isArchived: false,
            createdAt: new Date().toISOString()
          }));
          
          if (newMenus.length > 0) {
            const batch = writeBatch(db);
            newMenus.forEach(menu => {
              batch.set(doc(db, 'menus', menu.id), menu);
            });
            await batch.commit();
            alert(`${newMenus.length}개의 메뉴가 추가되었습니다.`);
          }
        } catch (error) {
          alert('CSV 파일 형식이 올바르지 않습니다. (필수 헤더: 메뉴명, 지방권_판매가, 광역권_판매가, 수도권_판매가)');
        }
      }
    });
    
    if (e.target) e.target.value = '';
  };

  const handleImportIngredientCsv = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const batch = writeBatch(db);
          const timestamp = new Date().toISOString();
          let count = 0;

          for (const row of results.data) {
            const name = row['상품명'];
            if (!name) continue;

            const spec = row['규격'] || '';
            const unit = (row['단위'] || 'EA') as any;
            const purchasePrice = parseFloat(row['매입가']?.replace(/,/g, '')) || 0;
            const salesPrice = parseFloat(row['매출가']?.replace(/,/g, '')) || 0;
            const boxQuantity = parseFloat(row['내품수량']) || 1;
            
            // Generate a stable ID based on name and spec
            const id = `ing-${name}-${spec}`.replace(/\s+/g, '-');
            const prevIng = ingredients.find(p => p.id === id);
            
            const newIng: Ingredient = {
              id,
              name,
              spec,
              unit,
              boxCost: purchasePrice,
              boxQuantity: boxQuantity,
              unitCost: boxQuantity > 0 ? purchasePrice / boxQuantity : purchasePrice,
              salesPrice,
              isArchived: false,
              isSelectedForMenu: prevIng?.isSelectedForMenu || false,
              createdAt: timestamp
            };
            
            if (!prevIng) {
              const changeId = `change-${Date.now()}-${id}`;
              batch.set(doc(db, 'ingredient_changes', changeId), {
                id: changeId,
                ingredientId: id,
                name,
                spec: spec || '',
                type: 'new',
                currPurchasePrice: newIng.unitCost,
                currSalesPrice: salesPrice,
                timestamp
              });
            } else if (Math.abs(prevIng.unitCost - newIng.unitCost) > 0.01 || prevIng.salesPrice !== salesPrice) {
              const changeId = `change-${Date.now()}-${id}`;
              batch.set(doc(db, 'ingredient_changes', changeId), {
                id: changeId,
                ingredientId: id,
                name,
                spec: spec || '',
                type: 'price_change',
                prevPurchasePrice: prevIng.unitCost,
                currPurchasePrice: newIng.unitCost,
                prevSalesPrice: prevIng.salesPrice,
                currSalesPrice: salesPrice,
                timestamp
              });
            }

            batch.set(doc(db, 'ingredients', id), newIng);
            count++;
          }

          await batch.commit();
          alert(`${count}개의 식자재 데이터가 업데이트되었습니다.`);
        } catch (error) {
          console.error('CSV Import Error:', error);
          alert('CSV 파일 처리 중 오류가 발생했습니다.');
        }
      }
    });
    
    if (e.target) e.target.value = '';
  };

  const handleDeleteChange = async (id: string) => {
    if (!window.confirm('이 변동 내역을 삭제하시겠습니까?')) return;
    try {
      await deleteDoc(doc(db, 'ingredient_changes', id));
    } catch (error) {
      console.error('Error deleting change:', error);
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans transition-colors duration-300">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">메뉴 원가/마진 대시보드</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">권역별 메뉴 가격 및 레시피 원가 관리</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            <button 
              onClick={toggleTheme}
              className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm transition-colors mr-2"
              title={theme === 'light' ? '다크 모드로 전환' : '라이트 모드로 전환'}
            >
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>

            <button 
              onClick={handleExportCsv}
              className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-1.5 text-sm shadow-sm transition-colors"
            >
              <Download size={16} /> 내보내기
            </button>
            
            <div className="h-8 w-px bg-slate-200 dark:bg-slate-700 mx-2 hidden sm:block"></div>
            
            <div className="flex items-center gap-3 ml-2">
              <div className="flex flex-col items-end">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{currentUser.name}님</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">{currentUser.role === 'admin' ? '관리자' : '사용자'}</span>
              </div>
              
              {currentUser.role === 'admin' && (
                <button 
                  onClick={() => setShowAdminPanel(!showAdminPanel)} 
                  className={`p-1.5 rounded-md transition-colors ${showAdminPanel ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400' : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                  title="관리자 패널"
                >
                  <Users size={18} />
                </button>
              )}
              <button 
                onClick={() => setIsChangePasswordOpen(true)} 
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors"
                title="비밀번호 변경"
              >
                <KeyRound size={18} />
              </button>
              <button 
                onClick={handleLogout} 
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors"
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
        <div className="bg-white dark:bg-slate-900 rounded-t-xl shadow-sm border-b border-slate-200 dark:border-slate-800">
          <nav className="flex -mb-px overflow-x-auto">
            {tabs.filter(tab => tab !== '변동사항' || currentUser.role === 'admin').map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab
                    ? 'border-slate-900 dark:border-blue-500 text-slate-900 dark:text-white'
                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                {tab}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="bg-white dark:bg-slate-900 shadow-sm rounded-b-xl overflow-hidden border border-t-0 border-slate-200 dark:border-slate-800">
          {activeTab === '전체보기' ? (
            <OverviewTable 
              menus={activeMenus} 
              ingredients={ingredients} 
              isAdmin={currentUser.role === 'admin'}
              onAcknowledgeAlert={handleAcknowledgeAlert}
              onNavigateToTab={setActiveTab}
            />
          ) : activeTab === '메뉴 관리' ? (
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">메뉴 관리</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">새로운 메뉴를 추가하거나 보관된 메뉴를 관리합니다.</p>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setShowDeleteAllMenusConfirm(true)}
                    className="px-4 py-2 bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/40 rounded-lg flex items-center gap-2 text-sm shadow-sm transition-colors border border-rose-200 dark:border-rose-800"
                  >
                    <Trash2 size={18} /> 메뉴 전체 삭제
                  </button>
                  <button 
                    onClick={() => { setEditingMenu(undefined); setIsMenuModalOpen(true); }}
                    className="px-4 py-2 bg-slate-900 dark:bg-blue-600 text-white rounded-lg hover:bg-slate-800 dark:hover:bg-blue-700 flex items-center gap-2 text-sm shadow-sm transition-colors"
                  >
                    <Plus size={18} /> 메뉴 추가
                  </button>
                </div>
              </div>
              
              <div className="space-y-6">
                <div className="bg-slate-50 dark:bg-slate-800/30 rounded-xl p-6 border border-slate-200 dark:border-slate-800">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <Archive size={16} className="text-slate-400" />
                    보관된 메뉴 목록
                  </h3>
                  <ArchiveView 
                    menus={archivedMenus} 
                    ingredients={ingredients} 
                    onRestoreMenu={handleRestoreMenu} 
                    onDeleteMenu={handleDeleteMenu} 
                  />
                </div>
              </div>
            </div>
          ) : activeTab === '데이터 베이스' ? (
            <DatabaseView 
              ingredients={ingredients}
              ingredientChanges={ingredientChanges}
              onSave={handleSaveIngredients}
              onDeleteAll={handleDeleteAllIngredients}
              onUnselectAll={handleUnselectAllIngredients}
              isAdmin={currentUser.role === 'admin'}
            />
          ) : activeTab === '변동사항' ? (
            <IngredientChangeView 
              changes={ingredientChanges}
              ingredients={ingredients}
              currentUser={currentUser}
              onDeleteChange={handleDeleteChange}
            />
          ) : (
            <MenuTable 
              menus={activeMenus} 
              ingredients={ingredients} 
              region={activeTab as Region} 
              onEditMenu={(menu) => { setEditingMenu(menu); setIsMenuModalOpen(true); }}
              onArchiveMenu={handleArchiveMenu}
              onEditRecipe={(menu) => { setRecipeMenu(menu); setIsRecipeModalOpen(true); }}
              isAdmin={currentUser.role === 'admin'}
              onAcknowledgeAlert={handleAcknowledgeAlert}
              onNavigateToTab={setActiveTab}
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

      {isChangePasswordOpen && (
        <ChangePasswordModal onClose={() => setIsChangePasswordOpen(false)} />
      )}

      {showDeleteAllMenusConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400 mb-4">
              <AlertTriangle size={24} />
              <h3 className="text-lg font-bold">메뉴 전체 삭제</h3>
            </div>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              정말로 모든 메뉴를 영구 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteAllMenusConfirm(false)}
                className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleDeleteAllMenus}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors"
              >
                삭제하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
