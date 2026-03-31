import { Menu, Ingredient, User } from './types';

export const companyUsers: User[] = [
  { id: 'admin', password: 'admin123', name: '최고관리자', isActive: true },
  { id: 'user1', password: 'user123', name: '홍길동 과장', isActive: true },
  { id: 'ex_user', password: 'ex123', name: '김퇴사 대리', isActive: false },
];

export const initialIngredients: Ingredient[] = [
  { id: 'i1', name: '고등어(반마리)', boxCost: 40000, boxQuantity: 10, unitCost: 4000, unit: 'ea' },
  { id: 'i2', name: '삼치(반마리)', boxCost: 45000, boxQuantity: 10, unitCost: 4500, unit: 'ea' },
  { id: 'i3', name: '임연수', boxCost: 60000, boxQuantity: 10, unitCost: 6000, unit: 'ea' },
  { id: 'i4', name: '볼락', boxCost: 55000, boxQuantity: 10, unitCost: 5500, unit: 'ea' },
  { id: 'i5', name: '갈치', boxCost: 80000, boxQuantity: 10, unitCost: 8000, unit: 'ea' },
  { id: 'i6', name: '보리굴비', boxCost: 100000, boxQuantity: 10, unitCost: 10000, unit: 'ea' },
  { id: 'i7', name: '돼지고기', boxCost: 12000, boxQuantity: 1000, unitCost: 12, unit: 'g' },
  { id: 'i8', name: '소고기', boxCost: 25000, boxQuantity: 1000, unitCost: 25, unit: 'g' },
  { id: 'i9', name: '새우', boxCost: 40000, boxQuantity: 100, unitCost: 400, unit: '미' },
  { id: 'i10', name: '홍시', boxCost: 80000, boxQuantity: 100, unitCost: 800, unit: 'ea' },
  { id: 'i11', name: '쌀', boxCost: 30000, boxQuantity: 10, unitCost: 3000, unit: 'kg' },
  { id: 'i12', name: '주류', boxCost: 28000, boxQuantity: 20, unitCost: 1400, unit: 'ea' },
  { id: 'i13', name: '음료', boxCost: 21000, boxQuantity: 30, unitCost: 700, unit: 'ea' },
];

export const initialMenus: Menu[] = [
  {
    id: 'm1', name: '모듬구이 한상 2인',
    prices: { '지방권': 35000, '광역권': 37000, '수도권': 39000 },
    recipe: [{ ingredientId: 'i1', quantity: 1 }, { ingredientId: 'i2', quantity: 1 }, { ingredientId: 'i9', quantity: 2 }]
  },
  {
    id: 'm4', name: '고등어구이 (반마리)',
    prices: { '지방권': 11000, '광역권': 12000, '수도권': 13000 },
    recipe: [{ ingredientId: 'i1', quantity: 1 }]
  },
  {
    id: 'm11', name: '석쇠 고추장불고기',
    prices: { '지방권': 12000, '광역권': 13000, '수도권': 14000 },
    recipe: [{ ingredientId: 'i7', quantity: 200 }]
  },
  {
    id: 'm12', name: '소뚝불고기',
    prices: { '지방권': 13500, '광역권': 14500, '수도권': 15500 },
    recipe: [{ ingredientId: 'i8', quantity: 200 }]
  },
];
