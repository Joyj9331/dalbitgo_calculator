export type Region = '지방권' | '광역권' | '수도권';
export type Unit = 'kg' | 'g' | 'ea' | '미';

export interface User {
  uid: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
  isApproved: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface Ingredient {
  id: string;
  name: string;
  boxCost: number;
  boxQuantity: number;
  unitCost: number;
  unit: Unit;
  isArchived?: boolean;
  createdAt?: string;
}

export interface RecipeItem {
  ingredientId: string;
  quantity: number;
}

export interface Menu {
  id: string;
  name: string;
  prices: Record<Region, number>;
  recipe: RecipeItem[];
  notes?: string;
  isArchived?: boolean;
  createdAt?: string;
}
