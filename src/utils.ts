import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { Ingredient, RecipeItem } from "./types"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const calculateTotalCost = (recipe: RecipeItem[], ingredients: Ingredient[]) => {
  return recipe.reduce((total, item) => {
    const ingredient = ingredients.find(i => i.id === item.ingredientId);
    return total + (ingredient ? (ingredient.unitSalesPrice || 0) * item.quantity : 0);
  }, 0);
};

export const hasMissingIngredients = (recipe: RecipeItem[], ingredients: Ingredient[]) => {
  return recipe.some(item => !ingredients.find(i => i.id === item.ingredientId));
};

export const checkMenuAlert = (menu: any, ingredients: Ingredient[]) => {
  // If explicitly marked as having an alert, always show it
  if (menu.hasAlert === true) return true;
  
  const currentCost = calculateTotalCost(menu.recipe, ingredients);
  const missing = hasMissingIngredients(menu.recipe, ingredients);
  
  // If it's the first time (no lastAcknowledgedCost) and there's a problem, show alert
  if (menu.lastAcknowledgedCost === undefined) {
    return missing || menu.hasAlert;
  }

  // Check if cost has changed since last acknowledgment
  const costChanged = Math.abs(currentCost - menu.lastAcknowledgedCost) > 0.1;
  
  // If cost changed, it needs a new acknowledgment
  if (costChanged) return true;

  // If cost is same as acknowledged, and hasAlert is false, then no alert
  // even if 'missing' is true (user acknowledged the missing state)
  return false;
};

export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(amount);
};

export const formatPercent = (rate: number) => {
  if (isNaN(rate) || !isFinite(rate)) return '0.0%';
  return `${(rate * 100).toFixed(1)}%`;
};
