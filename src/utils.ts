import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { Ingredient, RecipeItem } from "./types"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const calculateTotalCost = (recipe: RecipeItem[], ingredients: Ingredient[]) => {
  return recipe.reduce((total, item) => {
    const ingredient = ingredients.find(i => i.id === item.ingredientId);
    return total + (ingredient ? ingredient.unitCost * item.quantity : 0);
  }, 0);
};

export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(amount);
};

export const formatPercent = (rate: number) => {
  if (isNaN(rate) || !isFinite(rate)) return '0.0%';
  return `${(rate * 100).toFixed(1)}%`;
};
